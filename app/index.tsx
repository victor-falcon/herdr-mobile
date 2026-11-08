import Ionicons from "@expo/vector-icons/Ionicons";
import { Link, Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fleet, useFleet, useMachines } from "../src/fleet-store";
import type { Session } from "../src/hc/fleet";
import { spaces as spacesOf, type Space } from "../src/spaces";
import { Button } from "../src/ui/Button";
import { Dot } from "../src/ui/Dot";
import { explainError, linkColor } from "../src/ui/machine-display";
import { NewSessionSheet } from "../src/ui/NewSessionSheet";
import { ProjectSheet } from "../src/ui/ProjectSheet";
import { SpaceList } from "../src/ui/SpaceList";
import { makeStyles, radius, space, useColors } from "../src/ui/theme";
import { applyUpdate, useUpdates } from "../src/updates";

export default function Agents() {
  const colors = useColors();
  const styles = useStyles();
  const { links, sessions, docs } = useFleet();
  const { machines, loaded } = useMachines();
  const [picking, setPicking] = useState(false);
  const [startIn, setStartIn] = useState<Space | null>(null);
  const insets = useSafeAreaInsets();
  const { isUpdatePending } = useUpdates();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const down = links.filter((l) => l.state !== "connected");
  const connected = links.some((l) => l.state === "connected");
  const targets = fleet.targets();
  const { spaces, loose } = spacesOf(docs, targets, sessions);
  const none = spaces.length === 0 && loose.length === 0;

  const open = (s: Session) => router.push({ pathname: "/session/[key]", params: { key: s.key } });

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel="Settings">
                <Ionicons name="settings-outline" size={24} color={colors.text} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => fleet.reconnect()} tintColor={colors.muted} />}
      >
        {loaded && machines.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No machines yet</Text>
            <Text style={styles.emptyText}>Add a machine that runs herdr-core to see its agents here.</Text>
            <Button title="Add a machine" onPress={() => router.push("/machines")} style={styles.emptyButton} />
          </View>
        )}

        {isUpdatePending && (
          <Pressable style={[styles.banner, styles.update]} onPress={() => void applyUpdate()} accessibilityRole="button">
            <Text style={styles.bannerText}>A new version is ready</Text>
            <Text style={styles.updateAction}>Restart</Text>
          </Pressable>
        )}

        {down.length > 0 && (
          <Link href="/machines" asChild>
            <Pressable style={styles.banner} accessibilityRole="button">
              <Dot color={down.some((l) => l.state !== "connecting") ? colors.blocked : linkColor("connecting", colors)} />
              <Text style={styles.bannerText} numberOfLines={2}>
                {down.length > 1
                  ? `${down.length} machines are not connected`
                  : `${down[0].config.name}: ${down[0].state === "connecting" ? "connecting…" : explainError(down[0].error, down[0].config) || "offline"}`}
              </Text>
            </Pressable>
          </Link>
        )}

        <SpaceList spaces={spaces} loose={loose} showMachine={targets.length > 1} onSelect={open} onStart={setStartIn} />

        {machines.length > 0 && connected && none && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No spaces yet</Text>
            <Text style={styles.emptyText}>Tap + to open a project.</Text>
          </View>
        )}
      </ScrollView>

      {connected && (
        <Pressable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel="Open a project"
          style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 20 }, pressed && styles.fabPressed]}
        >
          <Ionicons name="add" size={32} color={colors.onAccent} />
        </Pressable>
      )}
      <NewSessionSheet space={startIn} onClose={() => setStartIn(null)} />
      <ProjectSheet visible={picking} spaces={spaces} onClose={() => setPicking(false)} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, paddingTop: space.md },
  banner: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, marginBottom: space.md - 2 },
  bannerText: { color: colors.text, fontSize: 14, flex: 1 },
  update: { backgroundColor: colors.accent + "22", borderColor: colors.accent, borderWidth: 1 },
  updateAction: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  empty: { alignItems: "center", marginTop: 60, gap: space.md - 2, paddingHorizontal: space.xl },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: "center" },
  emptyButton: { marginTop: space.sm },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
  },
  fabPressed: { opacity: 0.8 },
}));
