import AsyncStorage from "@react-native-async-storage/async-storage";
import { PermissionsAndroid, Platform } from "react-native";
import SmsAndroid from "react-native-get-sms-android";
import { auth, db } from "./firebaseConfig";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, getDocs } from "firebase/firestore";

export interface ParsedTransaction {
  id: string; // The SMS ID
  transactionId: string; // Extracted Txn Ref
  amount: string;
  merchant: string;
  timestamp: number;
  balanceAfter?: string; // Captured balance from SMS
}

export const requestSmsPermission = async () => {
  if (Platform.OS !== "android") return false;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: "SMS Permission",
        message:
          "App needs access to read your SMS to automatically track expenses.",
        buttonNeutral: "Ask Me Later",
        buttonNegative: "Cancel",
        buttonPositive: "OK",
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn(err);
    return false;
  }
};

const extractTransactionDetails = (body: string): { amount: string; merchant: string; transactionId: string; balance: string } | null => {
  const lowerBody = body.toLowerCase();

  // Look for debit/spent keywords
  const keywords = ["debited", "spent", "sent", "withdrawn", "paid", "transfer", "txn"];
  if (!keywords.some(k => lowerBody.includes(k))) {
    return null;
  }

  // 1. Extract Amount
  const amountMatch = body.match(/(?:RS|INR|Rs\.?|INR\.?)\s*(\d+(?:\.\d+)?)/i);
  if (!amountMatch) return null;
  const amount = amountMatch[1];

  // 2. Extract Merchant / Label ATM
  let merchant = "Unknown";
  if (lowerBody.includes("atm") || lowerBody.includes("withdrawn")) {
    merchant = "ATM Withdrawal";
  } else {
    // Matches "to ANIL UIKEY on" or "To HEMANT \n"
    const toMatch = body.match(/to\s+(?:vpa\s+)?([A-Za-z0-9.\-@\s]+?)(?=\s+on\b|\s+ref\b|\n|$)/i);
    if (toMatch && toMatch[1]) {
      merchant = toMatch[1].trim().replace(/\n/g, ' ');
    } else {
      const toIndex = lowerBody.indexOf(" to ");
      if (toIndex !== -1) {
        merchant = body.substring(toIndex + 4, toIndex + 20).trim().split('\n')[0];
      }
    }
  }

  // 3. Extract Transaction ID
  let transactionId = "";
  const refMatch = body.match(/(?:RRN:?|Ref(?:\.|\sNo\.?|:)?|UPI Ref|Txn|txn id)\s*(\d{6,})/i);
  if (refMatch && refMatch[1]) {
    transactionId = refMatch[1].trim();
  } else {
    transactionId = `unknown_${amount}_${merchant.replace(/\s/g, '').substring(0, 5)}`;
  }

  // 4. Extract Available Balance (New)
  let balance = "";
  const balMatch = body.match(/(?:Avl Bal|Bal:?|Balance:?|Avl:?)\s*(?:RS|INR|Rs\.?|INR\.?)?\s*(\d+(?:\.\d+)?)/i);
  if (balMatch && balMatch[1]) {
    balance = balMatch[1].trim();
  }

  return { amount, merchant, transactionId, balance };
};

export const fetchRecentTransactions = async (): Promise<ParsedTransaction[]> => {
  if (Platform.OS !== "android") return [];
  const hasPermission = await requestSmsPermission();
  if (!hasPermission) return [];

  return new Promise((resolve, reject) => {
    const filter = {
      box: 'inbox',
      // Get messages from last 7 days
      minDate: Date.now() - (7 * 24 * 60 * 60 * 1000),
      maxCount: 50,
    };

    SmsAndroid.list(
      JSON.stringify(filter),
      (fail: string) => {
        console.log("Failed with this error: " + fail);
        resolve([]);
      },
      (count: number, smsList: string) => {
        try {
          const messages = JSON.parse(smsList);
          const parsedTransactions: ParsedTransaction[] = [];

          messages.forEach((msg: any) => {
            const extracted = extractTransactionDetails(msg.body);
            // Only add if it's a debit and not already processed
            if (extracted) {
              parsedTransactions.push({
                id: msg._id.toString(),
                transactionId: extracted.transactionId,
                amount: extracted.amount,
                merchant: extracted.merchant,
                timestamp: msg.date,
                balanceAfter: extracted.balance || undefined,
              });
            }
          });

          resolve(parsedTransactions);
        } catch (e) {
          console.error(e);
          resolve([]);
        }
      }
    );
  });
};

export const filterUnsavedTransactions = async (transactions: ParsedTransaction[]): Promise<ParsedTransaction[]> => {
  if (transactions.length === 0) return [];

  // 1. Get Local IDs
  const storedIds = await AsyncStorage.getItem("SAVED_SMS_IDS");
  let savedIdsArray: string[] = storedIds ? JSON.parse(storedIds) : [];

  const storedTxnRefs = await AsyncStorage.getItem("SAVED_TXN_REFS");
  let savedTxnRefsArray: string[] = storedTxnRefs ? JSON.parse(storedTxnRefs) : [];

  // 2. Get Cloud IDs (Saved and Pending) if logged in
  const user = auth.currentUser;
  if (user) {
    try {
      // Check Saved Transactions
      const docRef = doc(db, "users", user.uid, "data", "transactions");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const cloudData = docSnap.data();
        const cloudSmsIds = cloudData.savedSmsIds || [];
        const cloudTxnRefs = cloudData.savedTxnRefs || [];

        savedIdsArray = Array.from(new Set([...savedIdsArray, ...cloudSmsIds]));
        savedTxnRefsArray = Array.from(new Set([...savedTxnRefsArray, ...cloudTxnRefs]));
      }

      // Check Pending Transactions
      const pendingRef = collection(db, "users", user.uid, "pending");
      const pendingSnap = await getDocs(pendingRef);
      const pendingSmsIds = pendingSnap.docs.map(d => d.data().smsId);
      const pendingTxnRefs = pendingSnap.docs.map(d => d.data().transactionId);

      savedIdsArray = Array.from(new Set([...savedIdsArray, ...pendingSmsIds]));
      savedTxnRefsArray = Array.from(new Set([...savedTxnRefsArray, ...pendingTxnRefs]));
    } catch (e: any) {
      // Silent fail for offline/cloud issues during background filter
      if (e?.code === 'unavailable' || e?.message?.includes('offline')) {
          console.log("[SMS Sync] Cloud unreachable (Offline). Using local cache only.");
      } else {
          console.error("Cloud filter error:", e);
      }
    }
  }

  return transactions.filter(t =>
    !savedIdsArray.includes(t.id) &&
    !savedTxnRefsArray.includes(t.transactionId)
  );
};

export const markTransactionSaved = async (smsId: string, transactionId: string) => {
  // 1. Save Locally
  const storedSmsIds = await AsyncStorage.getItem("SAVED_SMS_IDS");
  const savedSmsIdsArray: string[] = storedSmsIds ? JSON.parse(storedSmsIds) : [];
  if (!savedSmsIdsArray.includes(smsId)) {
    savedSmsIdsArray.push(smsId);
    if (savedSmsIdsArray.length > 200) savedSmsIdsArray.shift();
    await AsyncStorage.setItem("SAVED_SMS_IDS", JSON.stringify(savedSmsIdsArray));
  }

  const storedTxnRefs = await AsyncStorage.getItem("SAVED_TXN_REFS");
  const savedTxnRefsArray: string[] = storedTxnRefs ? JSON.parse(storedTxnRefs) : [];
  if (!savedTxnRefsArray.includes(transactionId)) {
    savedTxnRefsArray.push(transactionId);
    if (savedTxnRefsArray.length > 200) savedTxnRefsArray.shift();
    await AsyncStorage.setItem("SAVED_TXN_REFS", JSON.stringify(savedTxnRefsArray));
  }

  // 2. Save to Cloud if logged in
  const user = auth.currentUser;
  if (user) {
    try {
      const docRef = doc(db, "users", user.uid, "data", "transactions");
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          savedSmsIds: [smsId],
          savedTxnRefs: [transactionId]
        });
      } else {
        await updateDoc(docRef, {
          savedSmsIds: arrayUnion(smsId),
          savedTxnRefs: arrayUnion(transactionId)
        });
      }
    } catch (e: any) {
      // Silent fail for offline sync
      if (e?.code === 'unavailable' || e?.message?.includes('offline')) {
          console.log("[SMS Sync] Failed to sync to cloud (Offline). Will retry on next app open.");
      } else {
          console.error("Error syncing transaction to cloud:", e);
      }
    }
  }
};
