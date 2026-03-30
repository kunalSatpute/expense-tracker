import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Button, StyleSheet, View } from "react-native";
import { deleteExcel, downloadExcel } from "../services/excelService";

export default function Setting() {
  const logout = async () => {
    await AsyncStorage.removeItem("USER_LOGGED_IN");
    router.replace("/login");
  };

  return (
    <View style={styles.container}>
      <Button title="Download Excel" onPress={downloadExcel} />

      <View style={{ height: 20 }} />

      <Button title="Delete Excel" onPress={deleteExcel} color="red" />

      <View style={{ height: 20 }} />

      <Button title="Logout" onPress={logout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
});
