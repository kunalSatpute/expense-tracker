import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";

export interface BalanceStatus {
  lastKnownBalance: number;
  lastUpdated: number;
  lastTransactionId: string;
}

export interface Discrepancy {
  amount: number;
  detectedAt: number;
  fromTxnId: string;
}

/**
 * Fetches the last known balance and any existing discrepancy.
 */
export const getBalanceStatus = async (): Promise<BalanceStatus | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const statusRef = doc(db, "users", user.uid, "data", "status");
    const snap = await getDoc(statusRef);

    if (snap.exists()) {
      return snap.data() as BalanceStatus;
    }
    return null;
  } catch (error: any) {
    if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
      console.log("[Recon Sync] Offline: Using local state/null for balance check.");
    } else {
      console.error("Error fetching balance status:", error);
    }
    return null;
  }
};

/**
 * Core Logic: Detects if there's a gap between the reported balance and app's math.
 */
export const checkBalanceGap = async (
  newTxnAmount: number,
  newBalanceReported: number,
  txnId: string
): Promise<number | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  const status = await getBalanceStatus();

  // If this is the first time we see a balance, just save it and return
  if (!status) {
    await updateBalanceStatus(newBalanceReported, txnId);
    return null;
  }

  // Calculate expected balance: Last Balance - Current Expense
  const expectedBalance = status.lastKnownBalance - newTxnAmount;

  // If the reported balance is LESS than expected, we have a missing expense!
  if (newBalanceReported < expectedBalance - 1) { // 1 rupee margin for rounding
    const missingAmount = expectedBalance - newBalanceReported;
    console.log(`[Reconciliation] Gap detected: ₹${missingAmount}`);

    // Store the discrepancy so the Pending screen can show it
    const statusRef = doc(db, "users", user.uid, "data", "status");
    await updateDoc(statusRef, {
      pendingDiscrepancy: {
        amount: missingAmount,
        detectedAt: Date.now(),
        fromTxnId: txnId
      },
      // Important: Update balance to the latest reported one to "reset" the baseline
      lastKnownBalance: newBalanceReported,
      lastTransactionId: txnId,
      lastUpdated: Date.now()
    });

    return missingAmount;
  }

  // If no gap, just update the baseline
  await updateBalanceStatus(newBalanceReported, txnId);
  return null;
};

/**
 * Updates the baseline balance in Firestore.
 */
export const updateBalanceStatus = async (balance: number, txnId: string) => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const statusRef = doc(db, "users", user.uid, "data", "status");
    await setDoc(statusRef, {
      lastKnownBalance: balance,
      lastTransactionId: txnId,
      lastUpdated: Date.now(),
      pendingDiscrepancy: null // Clear discrepancy once balance is updated/resolved
    }, { merge: true });
  } catch (error: any) {
    if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
      console.log("[Recon Sync] Offline: Could not update balance in cloud.");
    } else {
      console.error("Error updating balance status:", error);
    }
  }
};

/**
 * Resolves (clears) the current discrepancy.
 */
export const clearDiscrepancy = async () => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const statusRef = doc(db, "users", user.uid, "data", "status");
    await updateDoc(statusRef, {
      pendingDiscrepancy: null
    });
  } catch (error: any) {
    if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
      console.log("[Recon Sync] Offline: Could not clear discrepancy in cloud.");
    } else {
      console.error("Error clearing discrepancy:", error);
    }
  }
};
