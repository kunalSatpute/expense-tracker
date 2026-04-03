import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCG0-wuuV6cyIJCnjUbO3uN5Swcd8ZqPq8",
  authDomain: "expensetrackerapp-c9fba.firebaseapp.com",
  projectId: "expensetrackerapp-c9fba",
  storageBucket: "expensetrackerapp-c9fba.firebasestorage.app",
  messagingSenderId: "754664480885",
  appId: "1:754664480885:web:7f964425f8d2f75e15183c",
  measurementId: "G-VXM3NH2526"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
