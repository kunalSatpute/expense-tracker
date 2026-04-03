import { Drawer } from "expo-router/drawer";

export default function AppLayout() {
  return (
    <Drawer>
      <Drawer.Screen 
        name="index" 
        options={{ 
          title: "Dashboard",
          headerTitle: "Expense Tracker" 
        }} 
      />
      <Drawer.Screen 
        name="buckets" 
        options={{ 
          title: "Manage Buckets",
          headerTitle: "Categories" 
        }} 
      />
    </Drawer>
  );
}
