import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getBuckets, syncBucketsToCloud } from "../../services/bucketService";
import { deleteExcel, downloadExcel, saveSpendToExcel } from "../../services/excelService";
import { auth } from "../../services/firebaseConfig";
import { addPendingTransaction, subscribeToPendingCount } from "../../services/pendingService";
import { checkBalanceGap } from "../../services/reconciliationService";
import {
  fetchRecentTransactions,
  filterUnsavedTransactions,
} from "../../services/smsService";

const { width } = Dimensions.get("window");

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [buckets, setBuckets] = useState<any[]>([]);

  // Manual Log State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [manualMerchant, setManualMerchant] = useState("");
  const [manualBucket, setManualBucket] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (initializing) setInitializing(false);

      if (currentUser) {
        syncBucketsToCloud();
      }
    });

    const unsubPending = subscribeToPendingCount((count) => {
      setPendingCount(count);
    });

    return () => {
      unsubAuth();
      unsubPending();
    };
  }, [initializing]);

  useFocusEffect(
    useCallback(() => {
      loadBuckets();
    }, []),
  );

  useEffect(() => {
    if (!user) return;

    // Only check SMS on Android
    if (Platform.OS === "android") {
      setIsSyncing(true);
      checkNewSms().finally(() => setIsSyncing(false));

      const subscription = AppState.addEventListener("change", (nextState) => {
        if (nextState === "active") {
          setIsSyncing(true);
          checkNewSms().finally(() => setIsSyncing(false));
        }
      });

      return () => subscription.remove();
    }
  }, [user]);
  const checkNewSms = async () => {
    try {
      const freshTxns = await fetchRecentTransactions();
      const unsaved = await filterUnsavedTransactions(freshTxns);

      setIsOffline(false); // Success = we are online
      if (unsaved.length > 0) {
        console.log(`[Dashboard] Syncing ${unsaved.length} new transactions to Pending...`);
        for (const txn of unsaved) {
          // Trigger Reconciliation Check if balance is present
          if (txn.balanceAfter) {
            await checkBalanceGap(
              Number(txn.amount),
              Number(txn.balanceAfter),
              txn.transactionId
            );
          }

          await addPendingTransaction({
            smsId: txn.id,
            transactionId: txn.transactionId,
            amount: txn.amount,
            merchant: txn.merchant,
            timestamp: txn.timestamp,
            source: "sms",
            balanceAfter: txn.balanceAfter
          });
        }
      }
    } catch (e: any) {
      if (e?.code === 'unavailable' || e?.message?.includes('offline')) {
        setIsOffline(true);
      }
      console.log("[Dashboard Sync] " + (isOffline ? "Offline Mode" : "Sync Error"), e);
    }
  };

  const handleManualSave = async () => {
    if (!manualAmount) return Alert.alert("Missing Info", "Please enter an amount.");
    if (!manualMerchant) return Alert.alert("Missing Info", "Please enter a title (e.g. Coffee).");
    if (!manualBucket) return Alert.alert("Missing Info", "Please select a category.");

    setIsSaving(true);
    try {
      await saveSpendToExcel(
        manualBucket,
        "Manual: " + manualMerchant,
        manualAmount,
        `man_${Date.now()}`,
        Date.now()
      );
      Alert.alert("Success", "Manual entry saved to sheet.");
      setManualAmount("");
      setManualMerchant("");
      setManualBucket("");
      setShowManualModal(false);
    } catch (e) {
      Alert.alert("Error", "Failed to save entry.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout", onPress: async () => {
          try {
            await signOut(auth);
          } catch (error) {
            Alert.alert("Logout Failed", "Please try again.");
          }
        }
      }
    ]);
  };

  const loadBuckets = async () => {
    const data = await getBuckets();
    setBuckets(data);
  };

  const ActionCard = ({ title, icon, color, onPress, badge }: any) => (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={[styles.cardIcon, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={32} color={color} />
      </View>
      {badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <Text style={styles.cardTitle}>{title}</Text>
    </TouchableOpacity>
  );

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.userName}>{user?.displayName || "Expense Tracker"}</Text>
        </View>
        <View style={styles.headerRight}>
          {isOffline && (
            <View style={[styles.syncIndicator, styles.offlineIndicator]}>
              <Ionicons name="cloud-offline-outline" size={14} color="#F59E0B" />
              <Text style={[styles.syncText, { color: "#F59E0B" }]}>Local Mode</Text>
            </View>
          )}
          {isSyncing && !isOffline && (
            <View style={styles.syncIndicator}>
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text style={styles.syncText}>Syncing...</Text>
            </View>
          )}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Main Actions</Text>
        <View style={styles.grid}>
          <ActionCard
            title="Pending Review"
            icon="time-outline"
            color="#EF4444"
            onPress={() => router.push("/pending")}
            badge={pendingCount}
          />
          <ActionCard
            title="Add Custom Log"
            icon="add-circle-outline"
            color="#10B981"
            onPress={() => setShowManualModal(true)}
          />
          <ActionCard
            title="Download Excel"
            icon="download-outline"
            color="#3B82F6"
            onPress={downloadExcel}
          />
          <ActionCard
            title="Manage Buckets"
            icon="grid-outline"
            color="#8B5CF6"
            onPress={() => router.push("/buckets")}
          />
          <ActionCard
            title="Delete Excel"
            icon="trash-outline"
            color="#F59E0B"
            onPress={() => {
              Alert.alert("Delete file", "Are you sure you want to delete the current Excel file?", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: deleteExcel }
              ]);
            }}
          />
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={24} color="#64748B" />
          <Text style={styles.infoText}>
            {Platform.OS === "android"
              ? "The app automatically detects bank SMS and saves them to 'Pending' for your review."
              : "Use 'Add Custom Log' to track your expenses manually."}
          </Text>
        </View>
      </ScrollView>

      {/* Manual Entry Modal */}
      <Modal visible={showManualModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.smsIcon, { backgroundColor: "#10B981" }]}>
                <Ionicons name="create" size={24} color="#fff" />
              </View>
              <Text style={styles.modalTitle}>Manual Log</Text>
              <TouchableOpacity style={{ marginLeft: "auto" }} onPress={() => setShowManualModal(false)}>
                <Ionicons name="close" size={28} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.modalBody}>
                <Text style={styles.label}>Amount (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={manualAmount}
                  onChangeText={setManualAmount}
                />

                <Text style={styles.label}>Title / Merchant</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Starbucks, Rent..."
                  placeholderTextColor="#94A3B8"
                  value={manualMerchant}
                  onChangeText={setManualMerchant}
                />

                <Text style={styles.label}>Select Category</Text>
                <View style={styles.bucketListContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {buckets.length === 0 ? (
                      <Text style={styles.noBuckets}>No buckets found. Create one in Manage Buckets.</Text>
                    ) : (
                      buckets.map((bucket) => (
                        <TouchableOpacity
                          key={bucket.id}
                          style={[
                            styles.bucketChip,
                            manualBucket === bucket.name && styles.bucketChipSelected,
                          ]}
                          onPress={() => setManualBucket(bucket.name)}
                        >
                          <Text style={[
                            styles.bucketChipText,
                            manualBucket === bucket.name && styles.bucketChipTextSelected
                          ]}>{bucket.name}</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>

                <TouchableOpacity style={[styles.saveButton, isSaving && { opacity: 0.7 }]} onPress={handleManualSave} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Transaction</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: "#0F172A",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  syncIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  offlineIndicator: {
    borderColor: "#F59E0B40",
    backgroundColor: "#F59E0B10",
  },
  syncText: {
    fontSize: 10,
    color: "#3B82F6",
    fontWeight: "700",
    marginLeft: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  greeting: {
    fontSize: 16,
    color: "#94A3B8",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: (width - 64) / 2,
    backgroundColor: "#1E293B",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    alignItems: "flex-start",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#EF4444",
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: "#1E293B",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  input: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 20,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    alignItems: "center",
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: "#94A3B8",
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContent: {
    backgroundColor: "#1E293B",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  smsIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  modalBody: {
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 12,
  },
  bucketListContainer: {
    marginBottom: 32,
  },
  bucketChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#0F172A",
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  bucketChipSelected: {
    backgroundColor: "#3B82F6",
    borderColor: "#2563EB",
  },
  bucketChipText: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "500",
  },
  bucketChipTextSelected: {
    color: "#fff",
  },
  noBuckets: {
    color: "#94A3B8",
    fontSize: 14,
  },
  saveButton: {
    height: 56,
    backgroundColor: "#3B82F6",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
