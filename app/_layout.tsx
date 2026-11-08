import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { fleet, startFleet } from "../src/fleet-store";
import { loadSettings } from "../src/settings";
import { startUpdateChecks } from "../src/updates";
import { emphasized, useColors } from "../src/ui/theme";

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
      {/* Screens that draw their own top app bar (src/ui/TopAppBar) hide this header with <Stack.Screen options={{ headerShown: false }} />. */}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.onSurface,
          headerTitleStyle: { fontFamily: emphasized.titleLarge.fontFamily, fontSize: emphasized.titleLarge.fontSize, fontWeight: emphasized.titleLarge.fontWeight },
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
