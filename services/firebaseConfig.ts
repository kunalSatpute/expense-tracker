import { initializeApp } from "firebase/app";
import { 
  // @ts-ignore
  initializeAuth, 
  // @ts-ignore
  getReactNativePersistence 
} from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyBt2ZbV2cicbFF1r37mWv2tyuf2Ldpg2Ls",
  authDomain: "expensetracker.firebaseapp.com",
  projectId: "expensetracker",
  storageBucket: "expensetracker.firebasestorage.app",
  messagingSenderId: "754664480885",
  appId: "1:754664480885:web:7f964425f8d2f75e15183c",
  measurementId: "G-VXM3NH2526",
};

const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
