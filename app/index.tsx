import Ionicons from "@expo/vector-icons/Ionicons";
import { Link, Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fleet, useFleet, useMachines } from "../src/fleet-store";
import type { Session } from "../src/hc/fleet";
import { spaces as spacesOf, type Space } from "../src/spaces";
import { Avatar } from "../src/ui/Avatar";
import { Button, Fab } from "../src/ui/Button";
import { EmptyState } from "../src/ui/EmptyState";
import { IconButton } from "../src/ui/IconButton";
import { explainError, linkColor } from "../src/ui/machine-display";
import { NewSessionSheet } from "../src/ui/NewSessionSheet";
import { ProjectSheet } from "../src/ui/ProjectSheet";
import { SpaceList } from "../src/ui/SpaceList";
import { makeStyles, shape, space, typography, useColors } from "../src/ui/theme";
import { LargeTopAppBar } from "../src/ui/TopAppBar";
import { installUpdate, useAvailableUpdate } from "../src/updates";

export default function Agents() {
  const colors = useColors();
  const styles = useStyles();
  const { links, sessions, docs } = useFleet();
  const { machines, loaded } = useMachines();
  const [picking, setPicking] = useState(false);
  const [startIn, setStartIn] = useState<Space | null>(null);
  const insets = useSafeAreaInsets();
  const update = useAvailableUpdate();
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
  const install = () => {
    if (update) installUpdate(update).catch((e) => Alert.alert("Could not update", e instanceof Error ? e.message : String(e)));
  };

  const open = (s: Session) => router.push({ pathname: "/session/[key]", params: { key: s.key } });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <LargeTopAppBar
        title="Spaces"
        actions={
          <IconButton icon="settings-outline" label="Settings" onPress={() => router.push("/settings")} />
        }
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => fleet.reconnect()} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surfaceContainerHigh} />}
      >
        {(update || down.length > 0) && (
          <View style={styles.banners}>
            {update && (
              <Pressable
                style={({ pressed }) => [styles.banner, styles.update, pressed && styles.pressed]}
                onPress={install}
                accessibilityRole="button"
                accessibilityLabel={`Install ${update.title}`}
              >
                <Avatar icon="download-outline" color={colors.onPrimary} background={colors.primary} />
                <Text style={[styles.bannerTitle, { color: colors.onPrimaryContainer }]} numberOfLines={2}>
                  {update.title} is available
                </Text>
                {/* The whole card installs: the button only shows it. */}
                <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  <Button title="Install" variant="filled" onPress={install} />
                </View>
              </Pressable>
            )}

            {down.length > 0 && (
              <Link href="/machines" asChild>
                <Pressable style={({ pressed }) => [styles.banner, styles.down, pressed && styles.pressed]} accessibilityRole="button">
                  <Avatar
                    icon="cloud-offline-outline"
                    color={down.some((l) => l.state !== "connecting") ? colors.error : linkColor("connecting", colors)}
                    background={colors.surfaceContainerLowest}
                  />
                  <View style={styles.flex}>
                    {down.length > 1 ? (
                      <Text style={styles.downName} numberOfLines={2}>
                        {down.length} machines are not connected
                      </Text>
                    ) : (
                      <>
                        <Text style={styles.downName} numberOfLines={1}>
                          {down[0].config.name}
                        </Text>
                        <Text style={styles.downText} numberOfLines={2}>
                          {down[0].state === "connecting" ? "connecting…" : explainError(down[0].error, down[0].config) || "offline"}
                        </Text>
                      </>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.onErrorContainer} />
                </Pressable>
              </Link>
            )}
          </View>
        )}

        {loaded && machines.length === 0 && (
          <EmptyState
            icon="server-outline"
            title="No machines yet"
            text="Add a machine that runs herdr-core to see its agents here."
            action={<Button title="Add a machine" icon="add" variant="filled" size="medium" onPress={() => router.push("/machines")} />}
          />
        )}

        <SpaceList spaces={spaces} loose={loose} showMachine={targets.length > 1} onSelect={open} onStart={setStartIn} />

        {machines.length > 0 && connected && none && <EmptyState icon="folder-open-outline" title="No spaces yet" text="Tap Open project to start one." />}
      </ScrollView>

      {connected && <Fab label="Open project" icon="add" onPress={() => setPicking(true)} style={[styles.fab, { bottom: insets.bottom + 16 }]} />}
      <NewSessionSheet space={startIn} onClose={() => setStartIn(null)} />
      <ProjectSheet visible={picking} spaces={spaces} onClose={() => setPicking(false)} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: space.lg, gap: space.xl },
  banners: { gap: space.sm },
  banner: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 64, borderRadius: shape.largeIncreased },
  update: { backgroundColor: colors.primaryContainer },
  down: { backgroundColor: colors.errorContainer },
  pressed: { opacity: 0.88 },
  flex: { flex: 1, gap: 2 },
  bannerTitle: { ...typography.bodyLarge, flex: 1 },
  downName: { ...typography.labelLarge, color: colors.onErrorContainer },
  downText: { ...typography.bodyMedium, color: colors.onErrorContainer },
  fab: { position: "absolute", right: space.lg },
}));
