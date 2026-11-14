import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fleet, useFleet, useMachines } from "../src/fleet-store";
import type { Session, Target } from "../src/hc/fleet";
import { updateSettings, useSettings, type HomeMode } from "../src/settings";
import { inbox, spaces as spacesOf } from "../src/spaces";
import { Avatar } from "../src/ui/Avatar";
import { Button, Fab } from "../src/ui/Button";
import { ButtonGroup, GroupButton } from "../src/ui/ButtonGroup";
import { EmptyState } from "../src/ui/EmptyState";
import { Card, Row } from "../src/ui/Group";
import { IconButton } from "../src/ui/IconButton";
import { InboxList } from "../src/ui/InboxList";
import { explainError, linkColor } from "../src/ui/machine-display";
import { startSpace } from "../src/ui/new-session";
import { Sheet, SheetAction, SheetActions, SheetHeader } from "../src/ui/Sheet";
import { openNew, SpaceList } from "../src/ui/SpaceList";
import { makeStyles, shape, space, typography, useColors } from "../src/ui/theme";
import { LargeTopAppBar } from "../src/ui/TopAppBar";
import { installUpdate, useAvailableUpdate } from "../src/updates";

export default function Agents() {
  const colors = useColors();
  const styles = useStyles();
  const { links, sessions, docs } = useFleet();
  const { machines, loaded } = useMachines();
  const mode = useSettings().homeMode;
  const setMode = (homeMode: HomeMode) => void updateSettings({ homeMode });
  const [picking, setPicking] = useState(false);
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
  const listed = spacesOf(docs, targets, sessions);
  const { spaces, loose } = listed;
  const groups = mode === "inbox" ? inbox(listed) : [];
  const none = mode === "inbox" ? groups.length === 0 : spaces.length === 0 && loose.length === 0;
  const install = () => {
    if (update) installUpdate(update).catch((e) => Alert.alert("Could not update", e instanceof Error ? e.message : String(e)));
  };

  // A new space opens a shell in the machine's home, as the desktop's does; with more than one machine, it asks which.
  const startOn = (t: Target) => {
    setPicking(false);
    void openNew(() => startSpace(t));
  };
  const newSpace = () => (targets.length === 1 ? startOn(targets[0]) : setPicking(true));

  const open = (s: Session) => router.push({ pathname: "/session/[key]", params: { key: s.key } });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <LargeTopAppBar
        title={mode === "inbox" ? "Inbox" : "Spaces"}
        actions={
          <IconButton icon="settings-outline" label="Settings" onPress={() => router.push("/settings")} />
        }
      />
      {machines.length > 0 && (
        <ButtonGroup style={styles.mode} accessibilityLabel="Home view">
          <GroupButton label="Spaces" icon="folder-outline" selected={mode === "spaces"} flex={1} onPress={() => setMode("spaces")} />
          <GroupButton label="Inbox" icon="file-tray-outline" selected={mode === "inbox"} flex={1} onPress={() => setMode("inbox")} />
        </ButtonGroup>
      )}
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
              <Pressable style={({ pressed }) => [styles.banner, styles.down, pressed && styles.pressed]} onPress={() => router.push("/machines")} accessibilityRole="button">
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

        {mode === "inbox" ? (
          <InboxList groups={groups} showMachine={targets.length > 1} onSelect={open} />
        ) : (
          <SpaceList spaces={spaces} loose={loose} showMachine={targets.length > 1} onSelect={open} />
        )}

        {/* The machines and how each is doing, at the foot of the list as in the desktop's sidebar. */}
        {mode === "spaces" && machines.length > 0 && !none && (
          <Card>
            <Row
              label="Machines"
              icon="server-outline"
              hint={
                <>
                  {links.map((l, i) => (
                    <Text key={l.config.id}>
                      {i > 0 ? "   " : ""}
                      <Text style={{ color: linkColor(l.state, colors) }}>●</Text> {l.config.name}
                    </Text>
                  ))}
                </>
              }
              onPress={() => router.push("/machines")}
            />
          </Card>
        )}

        {machines.length > 0 && connected && none && mode === "inbox" && <EmptyState icon="file-tray-outline" title="No agents running" text="Tap New space to start one." />}
        {machines.length > 0 && connected && none && mode === "spaces" && <EmptyState icon="folder-open-outline" title="No spaces yet" text="Tap New space to start one." />}
      </ScrollView>

      {connected && <Fab label="New space" icon="add" onPress={newSpace} style={[styles.fab, { bottom: insets.bottom + 16 }]} />}
      <Sheet visible={picking} onClose={() => setPicking(false)}>
        <SheetHeader title="New space" meta="A shell in ~ on the machine you pick" icon="add" />
        <SheetActions>
          {targets.map((t) => (
            <SheetAction
              key={t.coreId}
              icon="server-outline"
              label={t.label}
              detail={`${spaces.filter((sp) => sp.target.coreId === t.coreId && !sp.nestedUnder).length} spaces`}
              onPress={() => startOn(t)}
            />
          ))}
        </SheetActions>
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  mode: { paddingHorizontal: space.lg, paddingBottom: space.md },
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
