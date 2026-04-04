import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState, useRef } from "react";
import { Animated, View, StyleSheet, Dimensions } from "react-native";
import { auth } from "../services/firebaseConfig";

const { width } = Dimensions.get("window");

// Prevent the splash screen from auto-hiding before we are ready
SplashScreen.preventAutoHideAsync();

function CustomSplashScreen() {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={styles.splashContainer}>
      <Animated.View
        style={[
          styles.pulseCircle,
          {
            transform: [{ scale: pulseAnim }],
            opacity: pulseAnim.interpolate({
              inputRange: [1, 1.2],
              outputRange: [0.8, 0.4],
            }),
          },
        ]}
      />
      <View style={styles.innerCircle} />
    </View>
  );
}

export default function RootLayout() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    console.log("Auth Effect: Starting listener...");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Auth State Changed: User =", user ? user.email : "null");
      setUser(user);
      if (initializing) setInitializing(false);
    });

    // Hide the native splash screen once our animation is ready to show
    console.log("Hiding Native Splash...");
    SplashScreen.hideAsync();

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (initializing) return;

    const inAppGroup = segments[0] === "(app)";
    console.log("Navigation Sync:", { user: !!user, inAppGroup, segments });

    if (user && !inAppGroup) {
      console.log("Redirecting to (app)...");
      router.replace("/(app)");
    } else if (!user && inAppGroup) {
      console.log("Redirecting to login...");
      router.replace("/login");
    }
  }, [user, initializing, segments]);

  if (initializing) {
    return <CustomSplashScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="(app)" />
      ) : (
        <Stack.Screen name="login" />
      )}
    </Stack>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: "#0F172A", // Dark Slate (Matches Login)
    justifyContent: "center",
    alignItems: "center",
  },
  pulseCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
    position: "absolute",
  },
  innerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
});
