import { useEffect, useState } from "react";
import {
  Button,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getBuckets, saveBuckets } from "../services/bucketService";

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
    if (!name) return;

    const newBucket = {
      id: Date.now().toString(),
      name,
    };

    const updated = [...buckets, newBucket];

    setBuckets(updated);

    await saveBuckets(updated);

    setName("");
  };

  const deleteBucket = async (id: string) => {
    const updated = buckets.filter((b) => b.id !== id);

    setBuckets(updated);

    await saveBuckets(updated);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buckets</Text>

      <TextInput
        placeholder="New Bucket"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />

      <Button title="Add Bucket" onPress={addBucket} />

      <FlatList
        data={buckets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.bucketItem}>
            <Text style={styles.bucketText}>{item.name}</Text>

            <TouchableOpacity onPress={() => deleteBucket(item.id)}>
              <Text style={styles.delete}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },

  title: {
    fontSize: 24,
    marginBottom: 20,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 10,
  },

  bucketItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },

  bucketText: {
    fontSize: 16,
  },

  delete: {
    color: "red",
  },
});
