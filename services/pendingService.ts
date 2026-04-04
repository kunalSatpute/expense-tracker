import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where
} from "firebase/firestore";
import { auth, db } from "./firebaseConfig";

export interface PendingTransaction {
  id?: string;
  smsId: string;
  transactionId: string;
  amount: string;
  merchant: string;
  timestamp: number;
  source: "sms" | "email" | "api";
  status: "pending";
  balanceAfter?: string;
}

/**
 * Adds a new transaction to the user's pending collection.
 */
export const addPendingTransaction = async (txn: Omit<PendingTransaction, "status">) => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const pendingRef = collection(db, "users", user.uid, "pending");

    // Check if it already exists in pending to avoid duplicates
    const q = query(pendingRef, where("transactionId", "==", txn.transactionId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Create a clean object without undefined values
      const dataToSave: any = {
        ...txn,
        status: "pending",
        createdAt: serverTimestamp()
      };

      // Firebase doesn't like 'undefined'
      if (dataToSave.balanceAfter === undefined) {
        delete dataToSave.balanceAfter;
      }

      await addDoc(pendingRef, dataToSave);
      console.log(`[Pending] Added transaction: ${txn.transactionId} (Bal: ${txn.balanceAfter || 'N/A'})`);
    }
  } catch (error) {
    console.error("Error adding pending transaction:", error);
  }
};

/**
 * Subscribes to the pending transaction count for the tab badge.
 */
export const subscribeToPendingCount = (callback: (count: number) => void) => {
  const user = auth.currentUser;
  if (!user) {
    callback(0);
    return () => { };
  }

  const pendingRef = collection(db, "users", user.uid, "pending");
  const unsubscribe = onSnapshot(pendingRef, (snapshot) => {
    callback(snapshot.size);
  }, (error) => {
    console.error("Error subscribing to pending count:", error);
    callback(0);
  });

  return unsubscribe;
};

/**
 * Fetches all pending transactions.
 */
export const getPendingTransactions = async (): Promise<PendingTransaction[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const pendingRef = collection(db, "users", user.uid, "pending");
    const q = query(pendingRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as PendingTransaction[];
  } catch (error) {
    console.error("Error fetching pending transactions:", error);
    return [];
  }
};

/**
 * Deletes a transaction from pending once it's bucketed or ignored.
 */
export const deletePendingTransaction = async (docId: string) => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const docRef = doc(db, "users", user.uid, "pending", docId);
    await deleteDoc(docRef);
    console.log(`[Pending] Deleted transaction: ${docId}`);
  } catch (error) {
    console.error("Error deleting pending transaction:", error);
  }
};
