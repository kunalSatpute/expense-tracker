import AsyncStorage from "@react-native-async-storage/async-storage";

const BUCKET_KEY = "BUCKETS";

export const getBuckets = async () => {
  const data = await AsyncStorage.getItem(BUCKET_KEY);

  return data ? JSON.parse(data) : [];
};

export const saveBuckets = async (buckets: any) => {
  await AsyncStorage.setItem(BUCKET_KEY, JSON.stringify(buckets));
};
