import { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { getBuckets, saveBuckets, deleteBucketFromCloud } from "../../services/bucketService";

export default function Buckets() {
  const [buckets, setBuckets] = useState<any[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    loadBuckets();
  }, []);

  const loadBuckets = async () => {
    const data = await getBuckets();
    setBuckets(data);
  };

  const addBucket = async () => {
    if (!name.trim()) return;

    // Check if bucket already exists
    if (buckets.some(b => b.name.toLowerCase() === name.trim().toLowerCase())) {
        return Alert.alert("Duplicate", "A bucket with this name already exists.");
    }

    const newBucket = {
      id: Date.now().toString(),
      name: name.trim(),
    };

    const updated = [...buckets, newBucket];
    setBuckets(updated);
    await saveBuckets(updated);
    setName("");
  };

  const confirmDelete = (id: string, bucketName: string) => {
    Alert.alert("Delete Bucket", `Are you sure you want to delete "${bucketName}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteBucket(id) }
    ]);
  };

  const deleteBucket = async (id: string) => {
    const updated = buckets.filter((b) => b.id !== id);
    setBuckets(updated);
    await deleteBucketFromCloud(id);
    await saveBuckets(updated);
  };

  return (
    <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
    >
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Buckets</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Create New Category</Text>
        <View style={styles.inputContainer}>
            <TextInput
                placeholder="e.g. Groceries, Rent, Fun"
                value={name}
                onChangeText={setName}
                style={styles.input}
                placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addBucket}>
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Your Categories ({buckets.length})</Text>
        
        {buckets.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>No buckets created yet.</Text>
            <Text style={styles.emptySubtext}>Add categories to track your expenses better.</Text>
          </View>
        ) : (
            <FlatList
                data={buckets}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => (
                  <View style={styles.bucketItem}>
                      <View style={styles.bucketInfo}>
                          <View style={styles.bucketIcon}>
                              <Ionicons name="pricetag-outline" size={20} color="#3B82F6" />
                          </View>
                          <Text style={styles.bucketText}>{item.name}</Text>
                      </View>
                      <TouchableOpacity 
                          onPress={() => confirmDelete(item.id, item.name)}
                          style={styles.deleteBtn}
                      >
                          <Ionicons name="trash-outline" size={22} color="#EF4444" />
                      </TouchableOpacity>
                  </View>
                )}
            />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#fff",
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
  },
  content: {
    flex: 1,
    padding: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    marginBottom: 32,
  },
  input: {
    flex: 1,
    height: 56,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    color: "#1E293B",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginRight: 12,
  },
  addBtn: {
    width: 56,
    height: 56,
    backgroundColor: "#3B82F6",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 16,
  },
  bucketItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  bucketInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  bucketIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  bucketText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1E293B",
  },
  deleteBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 8,
    textAlign: "center",
  },
});
