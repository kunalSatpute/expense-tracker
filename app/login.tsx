import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Google from "expo-auth-session/providers/google";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId:
      "656591861841-quvpqn35dc2fmosrj9pugcqbaiggk3o3.apps.googleusercontent.com",
    androidClientId:
      "656591861841-5c60kp1olnaga62pgd6e9k6k4phui38t.apps.googleusercontent.com",
    iosClientId:
      "com.googleusercontent.apps.656591861841-g58t9s0d9fgogbo8taiplqgbapmolboh",
  });

  useEffect(() => {
    if (response?.type === "success") {
      handleLogin();
    }
  }, [response]);

  const handleLogin = async () => {
    await AsyncStorage.setItem("USER_LOGGED_IN", "true");
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login Screen</Text>

      <Button
        title="Login with Google"
        disabled={!request}
        onPress={() => promptAsync()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontSize: 28,
    marginBottom: 40,
    fontWeight: "bold",
  },
});
