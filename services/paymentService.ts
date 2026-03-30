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

  // ✅ Generic intent — Android shows system UPI app chooser
  // User picks PhonePe/GPay themselves → payment initiated FROM that app
  // callingPackage becomes the UPI app itself, not yours → no block
  const upiURL = `upi://pay?${params}`;

  try {
    console.log(upiURL);
    await Linking.openURL(upiURL);
  } catch {
    Alert.alert(
      "No UPI App Found",
      "Please install Google Pay, PhonePe, or Paytm.",
    );
  }
};
