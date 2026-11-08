import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { fleet, startFleet } from "../src/fleet-store";
import { loadSettings } from "../src/settings";
import { startUpdateChecks } from "../src/updates";
import { useColors } from "../src/ui/theme";

export default function Layout() {
  const colors = useColors();
  useEffect(() => {
    void loadSettings();
    void startFleet();
    startUpdateChecks();
    const sub = AppState.addEventListener("change", (s) => s === "active" && fleet.probe());
    return () => sub.remove();
  }, []);

  // The window behind the screens, seen while they slide or the keyboard opens.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Spaces" }} />
        <Stack.Screen name="machines" options={{ title: "Machines" }} />
        <Stack.Screen name="session/[key]" options={{ title: "" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
