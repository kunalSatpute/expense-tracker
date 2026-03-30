import { Text, TouchableOpacity, View } from "react-native";

const apps = ["Google Pay", "PhonePe", "Paytm", "CRED"];

export default function PaymentSelector({ selected, setSelected }) {
  return (
    <View>
      {apps.map((app) => (
        <TouchableOpacity key={app} onPress={() => setSelected(app)}>
          <Text>{app}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
