import AsyncStorage from "@react-native-async-storage/async-storage";
import { Camera, CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppState,
  Button,
  Image,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { getBuckets } from "../services/bucketService";
import { saveSpendToExcel } from "../services/excelService";
import { payUPI } from "../services/paymentService";

export default function Home() {
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [buckets, setBuckets] = useState<any[]>([]);
  const [selectedBucket, setSelectedBucket] = useState("");
  const [paymentApp, setPaymentApp] = useState("");

  const [paymentMode, setPaymentMode] = useState<"QR" | "UPI" | "">("");
  const [upiId, setUpiId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [scanVisible, setScanVisible] = useState(false);

  const [scanned, setScanned] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    checkLogin();
    requestPermission();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBuckets();
    }, []),
  );

  /* -------------------------
     Detect return from UPI
  -------------------------- */

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && paymentPending) {
        setPaymentPending(false);

        setTimeout(() => {
          Alert.alert("Payment Status", "Was the payment successful?", [
            { text: "No", style: "cancel" },
            { text: "Yes", onPress: () => saveSpend() },
          ]);
        }, 500);
      }
    });

    return () => subscription.remove();
  }, [paymentPending]);

  const checkLogin = async () => {
    const user = await AsyncStorage.getItem("USER_LOGGED_IN");

    if (!user) {
      router.replace("/login");
    }
  };

  const loadBuckets = async () => {
    const data = await getBuckets();
    setBuckets(data);
  };

  /* -------------------------
     Parse UPI QR
  -------------------------- */

  const parseQRData = (data: string) => {
    const upi = data.match(/pa=([^&]+)/);
    const payee = data.match(/pn=([^&]+)/);
    const amt = data.match(/am=([^&]+)/);

    if (upi) setUpiId(upi[1]);
    if (payee) setPayeeName(decodeURIComponent(payee[1]));
    if (amt) setAmount(amt[1]);
  };

  const handleQRScan = ({ data }: any) => {
    if (scanned) return;

    setScanned(true);

    parseQRData(data);

    setPaymentMode("QR");
    setScanVisible(false);
  };

  /* -------------------------
     Pick QR from gallery
  -------------------------- */

  const pickQRFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      try {
        const scanned = await Camera.scanFromURLAsync(result.assets[0].uri, [
          "qr",
        ]);

        if (scanned.length > 0) {
          parseQRData(scanned[0].data);

          setPaymentMode("QR");
          setScanVisible(false);
        } else {
          Alert.alert("No QR code found");
        }
      } catch {
        Alert.alert("Failed to scan QR");
      }
    }
  };

  /* -------------------------
     Handle Payment
  -------------------------- */

  const handlePay = () => {
    Keyboard.dismiss();

    if (!paymentMode) {
      Alert.alert("Select payment mode");
      return;
    }

    if (!upiId) {
      Alert.alert("UPI ID missing");
      return;
    }

    if (!amount) {
      Alert.alert("Enter amount");
      return;
    }

    if (!selectedBucket) {
      Alert.alert("Select bucket");
      return;
    }

    if (!paymentApp) {
      Alert.alert("Select payment app");
      return;
    }

    setPaymentPending(true);

    payUPI(amount, paymentApp, upiId, note, payeeName);
  };

  const saveSpend = async () => {
    await saveSpendToExcel(selectedBucket, note, amount);
    Alert.alert("Expense Saved");
  };

  const paymentApps = [
    {
      name: "Google Pay",
      icon: "https://img.icons8.com/color/96/google-pay.png",
    },
    {
      name: "PhonePe",
      icon: "https://img.icons8.com/color/96/phonepe.png",
    },
    {
      name: "Paytm",
      icon: "https://img.icons8.com/color/96/paytm.png",
    },
    {
      name: "CRED",
      icon: "https://img.icons8.com/color/96/bank-card-back-side.png",
    },
  ];

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <Text style={styles.title}>Add Spend</Text>

        {/* Payment Mode */}
        <View style={styles.row}>
          <Button
            title="Scan QR"
            onPress={() => {
              setScanned(false);
              setPaymentMode("QR");
              setScanVisible(true);
            }}
          />

          <Button
            title="UPI ID"
            onPress={() => {
              setPaymentMode("UPI");
              setScanVisible(false);
            }}
          />
        </View>

        {/* Scanner Modal */}
        <Modal visible={scanVisible} animationType="slide">
          <View style={{ flex: 1 }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={handleQRScan}
            />

            <View style={styles.scannerButtons}>
              <Button title="Pick From Gallery" onPress={pickQRFromGallery} />
              <Button
                title="Close Scanner"
                onPress={() => setScanVisible(false)}
              />
            </View>
          </View>
        </Modal>

        {/* Merchant */}
        {payeeName !== "" && <Text>Paying to: {payeeName}</Text>}

        {upiId !== "" && <Text>UPI ID: {upiId}</Text>}

        {/* UPI Input */}
        {paymentMode === "UPI" && (
          <TextInput
            placeholder="Enter UPI ID"
            value={upiId}
            onChangeText={setUpiId}
            style={styles.input}
          />
        )}

        {/* Note */}
        <Text style={styles.label}>Note</Text>
        <TextInput
          placeholder="Note"
          value={note}
          onChangeText={setNote}
          style={styles.input}
        />

        {/* Amount */}
        <Text style={styles.label}>Amount</Text>
        <TextInput
          placeholder="Amount"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          style={styles.input}
        />

        {/* Buckets */}
        <Text style={styles.label}>Select Bucket</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {buckets.map((bucket) => (
            <TouchableOpacity
              key={bucket.id}
              style={[
                styles.bucketCard,
                selectedBucket === bucket.name && styles.selectedCard,
              ]}
              onPress={() => setSelectedBucket(bucket.name)}
            >
              <Text style={styles.cardText}>{bucket.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Payment Apps */}
        <Text style={styles.label}>Select Payment App</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {paymentApps.map((app) => (
            <TouchableOpacity
              key={app.name}
              style={[
                styles.paymentCard,
                paymentApp === app.name && styles.selectedCard,
              ]}
              onPress={() => setPaymentApp(app.name)}
            >
              <Image source={{ uri: app.icon }} style={styles.paymentIcon} />
              <Text style={styles.cardText}>{app.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ marginTop: 20 }} />

        <Button title="Pay" onPress={handlePay} />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },

  title: { fontSize: 24, marginBottom: 20 },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 15,
    borderRadius: 6,
  },

  label: { fontSize: 16, marginTop: 15, marginBottom: 10 },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  bucketCard: {
    width: 120,
    height: 70,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    marginRight: 10,
  },

  paymentCard: {
    width: 120,
    height: 90,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    marginRight: 10,
  },

  selectedCard: {
    backgroundColor: "#d0e8ff",
    borderColor: "#2f80ed",
  },

  cardText: { fontSize: 14, fontWeight: "500" },

  paymentIcon: { width: 35, height: 35, marginBottom: 5 },

  scannerButtons: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    gap: 10,
  },
});
