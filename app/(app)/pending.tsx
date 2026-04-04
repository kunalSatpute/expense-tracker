import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { getBuckets } from "../../services/bucketService";
import { saveSpendToExcel } from "../../services/excelService";
import {
  deletePendingTransaction,
  getPendingTransactions,
  PendingTransaction
} from "../../services/pendingService";
import { clearDiscrepancy, Discrepancy, getBalanceStatus } from "../../services/reconciliationService";
import { markTransactionSaved } from "../../services/smsService";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function PendingScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingTransaction[]>([]);
  const [buckets, setBuckets] = useState<any[]>([]);

  // Standard Approval State
  const [selectedItem, setSelectedItem] = useState<PendingTransaction | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Reconciliation / Discrepancy State
  const [discrepancy, setDiscrepancy] = useState<Discrepancy | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveAmount, setResolveAmount] = useState("");
  const [resolveMerchant, setResolveMerchant] = useState("");
  const [resolveBucket, setResolveBucket] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [txns, bks, status] = await Promise.all([
      getPendingTransactions(),
      getBuckets(),
      getBalanceStatus()
    ]);

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPendingItems(txns);
    setBuckets(bks);

    if (status && (status as any).pendingDiscrepancy) {
      const disc = (status as any).pendingDiscrepancy;
      setDiscrepancy(disc);
      setResolveAmount(disc.amount.toString());
    } else {
      setDiscrepancy(null);
    }

    setLoading(false);
    setRefreshing(false);
  };

  const handleApprove = async () => {
    if (!selectedItem || !selectedBucket) return;

    setIsApproving(true);
    try {
      await saveSpendToExcel(
        selectedBucket,
        (selectedItem.merchant === "ATM Withdrawal" ? "ATM: " : "Auto: ") + selectedItem.merchant,
        selectedItem.amount as string,
        selectedItem.transactionId,
        selectedItem.timestamp
      );

      await markTransactionSaved(selectedItem.smsId, selectedItem.transactionId);

      if (selectedItem.id) {
        await deletePendingTransaction(selectedItem.id);
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setPendingItems(prev => prev.filter(i => i.id !== selectedItem.id));
      setSelectedItem(null);
      setSelectedBucket(null);

      Alert.alert("Success", "Transaction approved and saved.");
    } catch (error) {
      Alert.alert("Error", "Failed to save transaction.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleResolveDiscrepancy = async () => {
    if (!resolveAmount || !resolveMerchant || !resolveBucket) {
      return Alert.alert("Missing Info", "Please fill all details.");
    }

    try {
      await saveSpendToExcel(
        resolveBucket,
        "Gap Resolve: " + resolveMerchant,
        resolveAmount,
        `adj_${Date.now()}`,
        Date.now()
      );
      await clearDiscrepancy();
      setShowResolveModal(false);
      loadData(true);
      Alert.alert("Success", "Gap resolved and saved to sheet.");
    } catch (e) {
      Alert.alert("Error", "Failed to resolve discrepancy.");
    }
  };

  const handleIgnore = async (item: PendingTransaction) => {
    Alert.alert("Ignore?", "It won't be saved to Excel.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Ignore",
        style: "destructive",
        onPress: async () => {
          await markTransactionSaved(item.smsId, item.transactionId);
          if (item.id) await deletePendingTransaction(item.id);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setPendingItems(prev => prev.filter(i => i.id !== item.id));
        }
      }
    ]);
  };

  const renderItem = ({ item }: { item: PendingTransaction }) => {
    const isWithdrawal = item.merchant === "ATM Withdrawal";

    return (
      <TouchableOpacity style={[styles.txnCard, isWithdrawal && styles.withdrawalCard]} onPress={() => setSelectedItem(item)}>
        <View style={styles.txnHeader}>
          <View style={[styles.sourceTag, isWithdrawal && styles.withdrawalTag]}>
            <Text style={[styles.sourceText, isWithdrawal && styles.withdrawalTabText]}>
              {isWithdrawal ? "CASH" : item.source.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.txnDate}>{new Date(item.timestamp).toLocaleDateString()}</Text>
        </View>
        <View style={styles.txnBody}>
          <View style={styles.merchantContainer}>
            <Text style={styles.merchantName}>{item.merchant}</Text>
            <Text style={styles.txnId}>Ref: {item.transactionId}</Text>
          </View>
          <Text style={styles.txnAmount}>₹{item.amount}</Text>
        </View>
        <View style={styles.txnActions}>
          <TouchableOpacity onPress={() => handleIgnore(item)}>
            <Text style={styles.ignoreText}>Ignore</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.reviewBtn, isWithdrawal && styles.withdrawalBtn]} onPress={() => setSelectedItem(item)}>
            <Text style={styles.reviewBtnText}>Assign Bucket</Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Review</Text>
        <TouchableOpacity onPress={() => loadData(true)} style={styles.refreshBtn}>
          {refreshing ? <ActivityIndicator size="small" color="#3B82F6" /> : <Ionicons name="refresh" size={24} color="#3B82F6" />}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>
      ) : pendingItems.length === 0 && !discrepancy ? (
        <View style={styles.center}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="sparkles" size={60} color="#3B82F6" />
          </View>
          <Text style={styles.emptyTitle}>All Caught Up!</Text>
          <Text style={styles.emptySub}>Your inbox is clean. Every expense has its place.</Text>
        </View>
      ) : (
        <FlatList
          data={pendingItems}
          onRefresh={() => loadData(true)}
          refreshing={refreshing}
          ListHeaderComponent={
            discrepancy ? (
              <TouchableOpacity style={styles.discrepancyCard} onPress={() => setShowResolveModal(true)}>
                <View style={styles.discrepancyHeader}>
                  <Ionicons name="alert-circle" size={24} color="#F59E0B" />
                  <Text style={styles.discrepancyTitle}>Balance Mismatch</Text>
                </View>
                <Text style={styles.discrepancyText}>
                  Your bank reports ₹{discrepancy.amount} more spent than we have recorded.
                </Text>
                <View style={styles.discrepancyAction}>
                  <Text style={styles.discrepancyActionText}>Reconcile Now</Text>
                  <Ionicons name="arrow-forward" size={16} color="#F59E0B" />
                </View>
              </TouchableOpacity>
            ) : null
          }
          renderItem={renderItem}
          keyExtractor={(item) => item.id || item.transactionId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Approve Transaction Modal */}
      <Modal visible={!!selectedItem} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}><Ionicons name="color-filter" size={24} color="#fff" /></View>
              <Text style={styles.modalTitle}>Categorize Expense</Text>
              <TouchableOpacity style={{ marginLeft: "auto" }} onPress={() => setSelectedItem(null)}>
                <Ionicons name="close" size={28} color="#64748B" />
              </TouchableOpacity>
            </View>
            {selectedItem && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryMerchant}>{selectedItem.merchant}</Text>
                  <Text style={styles.summaryAmount}>₹{selectedItem.amount}</Text>
                </View>
                <Text style={styles.label}>Select Bucket</Text>
                <View style={styles.bucketGrid}>
                  {buckets.map(b => (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.bucketChip, selectedBucket === b.name && styles.bucketChipSelected]}
                      onPress={() => setSelectedBucket(b.name)}
                    >
                      <Text style={[styles.bucketChipText, selectedBucket === b.name && styles.bucketChipTextSelected]}>{b.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity 
                  style={[styles.approveBtn, (!selectedBucket || isApproving) && styles.approveBtnDisabled]} 
                  onPress={handleApprove} 
                  disabled={!selectedBucket || isApproving}
                >
                  {isApproving ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveBtnText}>Approve & Save</Text>}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Resolve Discrepancy Modal */}
      <Modal visible={showResolveModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: "#F59E0B" }]}><Ionicons name="bandage" size={24} color="#fff" /></View>
              <Text style={styles.modalTitle}>Fix Balance Gap</Text>
              <TouchableOpacity style={{ marginLeft: "auto" }} onPress={() => setShowResolveModal(false)}>
                <Ionicons name="close" size={28} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalBody}>
                <Text style={styles.label}>Missing Amount (₹)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={resolveAmount}
                  onChangeText={setResolveAmount}
                  placeholderTextColor="#94A3B8"
                />
                <Text style={styles.label}>Merchant / Description</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Where was this spent?"
                  value={resolveMerchant}
                  onChangeText={setResolveMerchant}
                  placeholderTextColor="#94A3B8"
                />
                <Text style={styles.label}>Category</Text>
                <View style={styles.bucketGrid}>
                  {buckets.map(b => (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.bucketChip, resolveBucket === b.name && styles.bucketChipSelected]}
                      onPress={() => setResolveBucket(b.name)}
                    >
                      <Text style={[styles.bucketChipText, resolveBucket === b.name && styles.bucketChipTextSelected]}>{b.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[styles.approveBtn, { backgroundColor: "#F59E0B" }]} onPress={handleResolveDiscrepancy}>
                  <Text style={styles.approveBtnText}>Finalize Reconciliation</Text>
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
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#1E293B", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#FFFFFF" },
  refreshBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#1E293B", justifyContent: "center", alignItems: "center" },
  listContent: { padding: 20, paddingBottom: 40 },
  txnCard: { backgroundColor: "#1E293B", borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: "#334155" },
  withdrawalCard: { borderColor: "#10B981" },
  txnHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sourceTag: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#3B82F620", borderRadius: 8 },
  withdrawalTag: { backgroundColor: "#10B98120" },
  sourceText: { fontSize: 10, fontWeight: "800", color: "#3B82F6", letterSpacing: 1 },
  withdrawalTabText: { color: "#10B981" },
  txnDate: { fontSize: 12, color: "#64748B" },
  txnBody: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  merchantContainer: { flex: 1, marginRight: 10 },
  merchantName: { fontSize: 18, fontWeight: "bold", color: "#FFFFFF", marginBottom: 4 },
  txnId: { fontSize: 11, color: "#64748B", fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  txnAmount: { fontSize: 26, fontWeight: "800", color: "#FFFFFF" },
  txnActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTopWidth: 1, borderTopColor: "#334155" },
  ignoreText: { color: "#EF4444", fontWeight: "700", fontSize: 14 },
  reviewBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#3B82F6", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  withdrawalBtn: { backgroundColor: "#10B981" },
  reviewBtnText: { color: "#FFFFFF", fontWeight: "700", marginRight: 4, fontSize: 14 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  emptyIconContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#1E293B", justifyContent: "center", alignItems: "center", marginBottom: 24 },
  emptyTitle: { fontSize: 24, fontWeight: "800", color: "#FFFFFF", marginBottom: 8 },
  emptySub: { fontSize: 16, color: "#94A3B8", textAlign: "center", lineHeight: 24 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.85)" },
  modalContent: { backgroundColor: "#1E293B", borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  modalIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#3B82F6", justifyContent: "center", alignItems: "center", marginRight: 14 },
  modalTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
  label: { fontSize: 14, fontWeight: "700", color: "#94A3B8", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 },
  summaryBox: { padding: 32, backgroundColor: "#0F172A", borderRadius: 28, marginBottom: 28, alignItems: "center", borderWidth: 1, borderColor: "#334155" },
  summaryMerchant: { fontSize: 20, color: "#94A3B8", marginBottom: 12, textAlign: "center", fontWeight: "600" },
  summaryAmount: { fontSize: 48, fontWeight: "900", color: "#FFFFFF" },
  bucketGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 24 },
  bucketChip: { paddingHorizontal: 18, paddingVertical: 12, backgroundColor: "#0F172A", borderRadius: 16, marginRight: 10, marginBottom: 10, borderWidth: 1, borderColor: "#334155" },
  bucketChipSelected: { backgroundColor: "#3B82F6", borderColor: "#3B82F6" },
  bucketChipText: { fontSize: 14, color: "#94A3B8", fontWeight: "600" },
  bucketChipTextSelected: { color: "#FFFFFF" },
  approveBtn: { height: 64, backgroundColor: "#3B82F6", borderRadius: 20, justifyContent: "center", alignItems: "center", width: "100%", elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  approveBtnDisabled: { opacity: 0.3 },
  approveBtnText: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  discrepancyCard: { backgroundColor: "#F59E0B15", borderRadius: 24, padding: 24, marginBottom: 24, borderWidth: 1.5, borderColor: "#F59E0B40" },
  discrepancyHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  discrepancyTitle: { fontSize: 20, fontWeight: "900", color: "#F59E0B", marginLeft: 12 },
  discrepancyText: { fontSize: 15, color: "#FFFFFF", lineHeight: 22, marginBottom: 20, fontWeight: "500" },
  discrepancyAction: { flexDirection: "row", alignItems: "center", backgroundColor: "#F59E0B20", alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  discrepancyActionText: { fontSize: 14, fontWeight: "800", color: "#F59E0B", marginRight: 8 },
  input: { backgroundColor: "#0F172A", borderRadius: 18, padding: 20, fontSize: 18, color: "#FFFFFF", marginBottom: 24, borderWidth: 1, borderColor: "#334155", fontWeight: "600" },
  modalBody: { width: "100%" }
});
