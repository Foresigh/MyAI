import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "../lib/store";
import { colors } from "../lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { color: colors.text },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: "Arvo" }} />
          <Stack.Screen name="chats" options={{ title: "Chats", presentation: "modal" }} />
          <Stack.Screen name="settings" options={{ title: "Settings", presentation: "modal" }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
