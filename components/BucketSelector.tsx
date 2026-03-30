import { Text, TouchableOpacity, View } from "react-native";

export default function BucketSelector({ buckets, selected, setSelected }) {
  return (
    <View>
      {buckets.map((bucket) => (
        <TouchableOpacity
          key={bucket.id}
          onPress={() => setSelected(bucket.name)}
        >
          <Text>{bucket.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
