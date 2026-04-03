import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "./firebaseConfig";
import { collection, getDocs, setDoc, doc, writeBatch, deleteDoc } from "firebase/firestore";

const BUCKET_KEY = "BUCKETS";

export const getBuckets = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      // Fetch from Firestore
      const querySnapshot = await getDocs(collection(db, "users", user.uid, "buckets"));
      const buckets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Update local cache
      await AsyncStorage.setItem(BUCKET_KEY, JSON.stringify(buckets));
      return buckets;
    }
    
    // Fallback to local storage
    const data = await AsyncStorage.getItem(BUCKET_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting buckets:", error);
    const data = await AsyncStorage.getItem(BUCKET_KEY);
    return data ? JSON.parse(data) : [];
  }
};

export const saveBuckets = async (buckets: any[]) => {
  try {
    // 1. Save to Local Storage FIRST for intermediate UI responsiveness
    await AsyncStorage.setItem(BUCKET_KEY, JSON.stringify(buckets));

    const user = auth.currentUser;
    if (user) {
      // 2. Sync to Firestore
      const batch = writeBatch(db);
      
      // Upsert current local buckets to cloud
      for (const bucket of buckets) {
        const bucketRef = doc(db, "users", user.uid, "buckets", bucket.id);
        batch.set(bucketRef, { name: bucket.name }, { merge: true });
      }
      
      await batch.commit();
    }
  } catch (error) {
    console.error("Error saving buckets:", error);
  }
};

/**
 * Migration helper to move local buckets to cloud on first login
 */
export const syncBucketsToCloud = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const localData = await AsyncStorage.getItem(BUCKET_KEY);
    if (!localData) return;

    try {
        const buckets = JSON.parse(localData);
        await saveBuckets(buckets);
    } catch (e) {
        console.error("Sync error:", e);
    }
};

export const deleteBucketFromCloud = async (id: string) => {
    try {
        const user = auth.currentUser;
        if (user) {
            await deleteDoc(doc(db, "users", user.uid, "buckets", id));
        }
    } catch (error) {
        console.error("Error deleting bucket from cloud:", error);
    }
};
