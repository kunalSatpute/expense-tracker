import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppState,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  TextInput,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "../../services/firebaseConfig";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { getBuckets, syncBucketsToCloud } from "../../services/bucketService";
import { saveSpendToExcel, downloadExcel, deleteExcel } from "../../services/excelService";
import {
  fetchRecentTransactions,
  filterUnsavedTransactions,
  markTransactionSaved,
  ParsedTransaction,
} from "../../services/smsService";

const { width } = Dimensions.get("window");

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [buckets, setBuckets] = useState<any[]>([]);
  
  // SMS Tracking State
  const [pendingTransactions, setPendingTransactions] = useState<ParsedTransaction[]>([]);
  const [currentPopupTxn, setCurrentPopupTxn] = useState<ParsedTransaction | null>(null);
  const [smsAmount, setSmsAmount] = useState("");
  const [smsBucket, setSmsBucket] = useState("");

  // Manual Log State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [manualMerchant, setManualMerchant] = useState("");
  const [manualBucket, setManualBucket] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        if (initializing) setInitializing(false);
        
        if (currentUser) {
            syncBucketsToCloud();
        } else if (!initializing) {
            router.replace("/login");
        }
    });

    return unsubscribe;
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
        checkNewSms();

        const subscription = AppState.addEventListener("change", (nextState) => {
          if (nextState === "active") {
            checkNewSms();
          }
        });

        return () => subscription.remove();
    }
  }, [user]);

  const checkNewSms = async () => {
    const freshTxns = await fetchRecentTransactions();
    const unsaved = await filterUnsavedTransactions(freshTxns);
    
    if (unsaved.length > 0) {
      setPendingTransactions(unsaved);
      setCurrentPopupTxn(unsaved[0]);
      setSmsAmount(unsaved[0].amount);
    }
  };

  const processNextSms = async (smsId: string, txnId: string) => {
    await markTransactionSaved(smsId, txnId);
    setPendingTransactions((prev) => {
      const nextList = prev.filter((t) => t.id !== smsId);
      if (nextList.length > 0) {
        setCurrentPopupTxn(nextList[0]);
        setSmsAmount(nextList[0].amount);
        setSmsBucket("");
      } else {
        setCurrentPopupTxn(null);
      }
      return nextList;
    });
  };

  const handleSaveSmsTxn = async () => {
    if (!currentPopupTxn) return;
    if (!smsAmount) return Alert.alert("Enter amount");
    if (!smsBucket) return Alert.alert("Select a bucket");

    await saveSpendToExcel(
      smsBucket,
      "Auto: " + currentPopupTxn.merchant,
      smsAmount,
      currentPopupTxn.transactionId
    );
    Alert.alert("Saved", `Logged ₹${smsAmount} to ${smsBucket}`);
    processNextSms(currentPopupTxn.id, currentPopupTxn.transactionId);
  };

  const handleIgnoreSmsTxn = () => {
    if (currentPopupTxn) processNextSms(currentPopupTxn.id, currentPopupTxn.transactionId);
  };

  const handleManualSave = async () => {
      if (!manualAmount) return Alert.alert("Missing Info", "Please enter an amount.");
      if (!manualMerchant) return Alert.alert("Missing Info", "Please enter a title (e.g. Coffee).");
      if (!manualBucket) return Alert.alert("Missing Info", "Please select a category.");

      await saveSpendToExcel(
          manualBucket,
          "Manual: " + manualMerchant,
          manualAmount,
          `man_${Date.now()}`
      );

      Alert.alert("Success", "Manual entry saved to sheet.");
      setManualAmount("");
      setManualMerchant("");
      setManualBucket("");
      setShowManualModal(false);
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", onPress: async () => {
            try {
                await signOut(auth);
                // Navigation is handled by onAuthStateChanged
            } catch (error) {
                Alert.alert("Logout Failed", "Please try again.");
            }
        }}
    ]);
  };

  const loadBuckets = async () => {
    const data = await getBuckets();
    setBuckets(data);
  };

  const ActionCard = ({ title, icon, color, onPress }: any) => (
    <TouchableOpacity style={styles.card} onPress={onPress}>
        <View style={[styles.cardIcon, { backgroundColor: color + "20" }]}>
            <Ionicons name={icon} size={32} color={color} />
        </View>
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
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.userName}>{user?.displayName || "Expense Tracker"}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Main Actions</Text>
        <View style={styles.grid}>
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
                    ? "The app automatically detects bank SMS and prompts you to categorize them."
                    : "On iOS, use 'Add Custom Log' to track your expenses manually."}
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
            
            <View style={styles.modalBody}>
                <Text style={styles.label}>Amount (₹)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={manualAmount}
                    onChangeText={setManualAmount}
                />

                <Text style={styles.label}>Title / Merchant</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. Starbucks, Rent..."
                    value={manualMerchant}
                    onChangeText={setManualMerchant}
                />
                
                <Text style={styles.label}>Select Category</Text>
                <View style={styles.bucketListContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {buckets.length === 0 ? (
                        <Text style={styles.noBuckets}>No buckets found.</Text>
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

                <TouchableOpacity style={[styles.saveButton, { width: "100%" }]} onPress={handleManualSave}>
                    <Text style={styles.saveButtonText}>Save Transaction</Text>
                </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SMS Popup Modal */}
      <Modal visible={!!currentPopupTxn} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
                <View style={styles.smsIcon}>
                    <Ionicons name="notifications" size={24} color="#fff" />
                </View>
                <Text style={styles.modalTitle}>Expense Detected</Text>
            </View>
            
            {currentPopupTxn && (
              <View style={styles.modalBody}>
                <View style={styles.txnSummary}>
                    <Text style={styles.txnMerchant}>{currentPopupTxn.merchant}</Text>
                    <Text style={styles.txnAmount}>₹{currentPopupTxn.amount}</Text>
                </View>
                
                <Text style={styles.label}>Select Category (Bucket)</Text>
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
                                    smsBucket === bucket.name && styles.bucketChipSelected,
                                ]}
                                onPress={() => setSmsBucket(bucket.name)}
                            >
                                <Text style={[
                                    styles.bucketChipText,
                                    smsBucket === bucket.name && styles.bucketChipTextSelected
                                ]}>{bucket.name}</Text>
                            </TouchableOpacity>
                        ))
                    )}
                    </ScrollView>
                </View>

                <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.ignoreButton} onPress={handleIgnoreSmsTxn}>
                        <Text style={styles.ignoreButtonText}>Ignore</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveButton} onPress={handleSaveSmsTxn}>
                        <Text style={styles.saveButtonText}>Add to Sheet</Text>
                    </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: "#fff",
  },
  greeting: {
    fontSize: 16,
    color: "#64748B",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1E293B",
  },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: (width - 64) / 2,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    alignItems: "flex-start",
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
    color: "#1E293B",
  },
  input: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#1E293B",
    marginBottom: 20,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    alignItems: "center",
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
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
    color: "#1E293B",
  },
  modalBody: {
    width: "100%",
  },
  txnSummary: {
    padding: 20,
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    marginBottom: 24,
    alignItems: "center",
  },
  txnMerchant: {
    fontSize: 16,
    color: "#64748B",
    marginBottom: 4,
    textAlign: "center",
  },
  txnAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1E293B",
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 12,
  },
  bucketListContainer: {
    marginBottom: 32,
  },
  bucketChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F1F5F9",
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
    color: "#1E293B",
    fontWeight: "500",
  },
  bucketChipTextSelected: {
    color: "#fff",
  },
  noBuckets: {
    color: "#64748B",
    fontSize: 14,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ignoreButton: {
    flex: 1,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  ignoreButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
  },
  saveButton: {
    flex: 2,
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
