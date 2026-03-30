import { Alert, Linking } from "react-native";

const formatAmount = (amount: string | number): string => {
  const parsed = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(parsed) || parsed <= 0) throw new Error("Invalid amount");
  return parsed.toFixed(2);
};

export const payUPI = async (
  amount: string,
  paymentApp: string,
  upiId: string,
  note: string,
  payeeName: string,
) => {
  let formattedAmount: string;
  try {
    formattedAmount = formatAmount(amount);
  } catch {
    Alert.alert("Invalid Amount", "Please enter a valid amount.");
    return;
  }

  const params = [
    `pa=${upiId}`,
    `pn=${encodeURIComponent(payeeName)}`,
    `am=${formattedAmount}`,
    `cu=INR`,
    `tn=${encodeURIComponent(note)}`,
    `mode=04`,
  ].join("&");

  const upiURL = `upi://pay?${params}`;

  console.log("Opening:", upiURL);

  try {
    const canOpen = await Linking.canOpenURL(upiURL);
    if (canOpen) {
      await Linking.openURL(upiURL);
    } else {
      Alert.alert(
        "No UPI App Found",
        "Please install Google Pay, PhonePe, or Paytm.",
      );
    }
  } catch {
    Alert.alert(
      "No UPI App Found",
      "Please install Google Pay, PhonePe, or Paytm.",
    );
  }
};