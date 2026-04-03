import { Ionicons } from "@expo/vector-icons";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { router } from "expo-router";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../services/firebaseConfig";

const { width } = Dimensions.get("window");

// Configure Google Sign-In once when the module loads
GoogleSignin.configure({
  webClientId:
    "754664480885-knidti3osiouhl1jo0f7jhb6qhadm4d4.apps.googleusercontent.com",
  iosClientId: "754664480885-r9clq013t1ttbvb2iipat8ctab39tjsg.apps.googleusercontent.com",
  offlineAccess: true, // Required to get idToken for Firebase
});

export default function Login() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);

      // Check if Google Play Services are available (Android only)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Trigger the Google Sign-In popup
      const userInfo = await GoogleSignin.signIn();

      // Get the ID token to pass to Firebase
      const idToken = userInfo?.data?.idToken;

      if (!idToken) {
        throw new Error("No ID token received from Google.");
      }

      // Sign into Firebase with the Google credential
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);

      console.log("Logged in as:", userCredential.user.email);
      router.replace("/");
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled — just stop loading, no alert needed
        console.log("Sign-in cancelled by user.");
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log("Sign-in already in progress.");
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(
          "Error",
          "Google Play Services not available. Please update or enable it."
        );
      } else {
        console.error("Login Error:", error);
        Alert.alert("Auth Error", error.message || "Failed to sign in.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.circle} />

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="wallet-outline" size={60} color="#fff" />
        </View>

        <Text style={styles.title}>Expense Tracker</Text>
        <Text style={styles.subtitle}>
          Smarter tracking, zero effort. Automatically sync your bank SMS to
          Excel.
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" />
        ) : (
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleGoogleLogin}
          >
            <Ionicons
              name="logo-google"
              size={20}
              color="#fff"
              style={{ marginRight: 12 }}
            />
            <Text style={styles.loginBtnText}>Continue with Google</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.footer}>Manage your wealth efficiently</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
  circle: {
    position: "absolute",
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width * 0.75,
    backgroundColor: "#1E293B",
    top: -width * 0.8,
  },
  content: {
    padding: 30,
    alignItems: "center",
    width: "100%",
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 48,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  loginBtn: {
    width: width - 80,
    backgroundColor: "#2563EB",
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  footer: {
    marginTop: 40,
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
  },
});
