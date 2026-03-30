import { Drawer } from "expo-router/drawer";

export default function Layout() {
  return (
    <Drawer>
      <Drawer.Screen name="index" options={{ title: "Home" }} />
      <Drawer.Screen name="buckets" options={{ title: "Buckets" }} />
      <Drawer.Screen name="setting" options={{ title: "Setting" }} />
    </Drawer>
  );
}
