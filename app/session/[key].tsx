import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fleet, useFleet } from "../../src/fleet-store";
import type { Session } from "../../src/hc/fleet";
import { useSettings } from "../../src/settings";
import { spaces as spacesOf, type TabItem } from "../../src/spaces";
import { TerminalInput, type TerminalInputHandle } from "../../src/terminal/TerminalInput";
import { TerminalView, type TerminalHandle, type TerminalMode } from "../../src/terminal/TerminalView";
import { AgentAvatar } from "../../src/ui/Avatar";
import { Dot } from "../../src/ui/Dot";
import { IconButton } from "../../src/ui/IconButton";
import { setLastOpened } from "../../src/ui/last-opened";
import { SessionActions } from "../../src/ui/SessionActions";
import { SheetAction } from "../../src/ui/Sheet";
import { TopAppBar } from "../../src/ui/TopAppBar";
import { useKeyboardHeight } from "../../src/ui/keyboard";
import { ago, agentTitle, paneName, shortPath } from "../../src/ui/session-display";
import { makeStyles, shape, space, typography, useColors } from "../../src/ui/theme";

export default function SessionScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { docs, sessions } = useFleet();
  const settings = useSettings();
  const route = fleet.route(key);
  const session = route?.session;
  const t = session?.terminal;
  const live = t?.state === "live";
  const [view, setView] = useState<TerminalMode>(settings.defaultMode);
  const [actions, setActions] = useState(false);
  const terminal = useRef<TerminalHandle>(null);
  const input = useRef<TerminalInputHandle>(null);
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();

  useEffect(() => setLastOpened(key), [key]);

  // Its space, and the other panes of its tab, as the desktop's tab bar shows them.
  const ownPanes = (items: TabItem[]) =>
    items.flatMap((i) => (i.kind === "session" && !i.sub && i.depth === 0 && !i.from ? [i.session] : []));
  const { spaces } = spacesOf(docs, fleet.targets(), sessions);
  const home = spaces.find((sp) => sp.agents.some((a) => a.key === key) || sp.tabs.some((tb) => ownPanes(tb.items).some((p) => p.key === key)));
  const panes = home?.tabs.map((tb) => ownPanes(tb.items)).find((ps) => ps.some((p) => p.key === key)) ?? [];
  // A still dot for a pane's state: nothing animates beside the terminal's WebView.
  const paneColor = (s: Session) => {
    const st = s.terminal.status?.state;
    return st === "blocked" || st === "error" ? colors.error : st === "working" ? colors.working : st === "done" ? colors.done : colors.onSurfaceVariant;
  };
  const switchTo = (s: Session) => router.replace({ pathname: "/session/[key]", params: { key: s.key } });

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const seen = useRef(false);
  const title = useRef("Session");
  const where = useRef("");
  if (session) {
    title.current = agentTitle(session);
    const st = session.terminal.status;
    // An agent reads as the desktop's tab: its space, what it is doing and since when. A terminal says where it is.
    where.current = st
      ? [home?.name ?? session.machine, st.state === "blocked" || st.state === "error" ? "needs you" : st.state, ago(session.terminal.status_ms ?? session.terminal.created_ms)]
          .filter(Boolean)
          .join(" · ")
      : `${session.machine} · ${shortPath(session.terminal.foreground?.cwd || session.terminal.cwd)}`;
  }
  const reachable = !!fleet.targetOf(key);
  useEffect(() => {
    if (session) seen.current = true;
    else if (seen.current && reachable) {
      const t = setTimeout(back, 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!session, reachable]);

  return (
    <View style={[styles.screen, { paddingBottom: keyboard }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopAppBar
        title={title.current}
        subtitle={where.current || undefined}
        onBack={back}
        lead={session ? <AgentAvatar session={session} size={36} /> : undefined}
        titleStyle={styles.title}
        actions={<IconButton icon="ellipsis-vertical" label="Session actions" onPress={() => setActions(true)} disabled={!session} />}
      />
      {panes.length > 1 && (
        <View style={styles.panes} accessibilityRole="tablist">
          {panes.map((p) => {
            const on = p.key === key;
            return (
              <Pressable
                key={p.key}
                onPress={() => !on && switchTo(p)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [styles.chip, on ? styles.chipOn : styles.chipOff, pressed && !on && styles.chipPressed]}
              >
                {on ? <Ionicons name="checkmark" size={18} color={colors.onSecondaryContainer} /> : p.terminal.status ? <Dot color={paneColor(p)} size={8} /> : null}
                <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                  {paneName(p)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {t && route ? (
        <TerminalView
          key={key}
          ref={terminal}
          conn={route.conn}
          address={route.address}
          cols={t.cols}
          rows={t.rows}
          pid={t.pid}
          mode={view}
          fontSize={settings.fontSize}
          onTap={() => input.current?.openKeyboard()}
          onSwipeBack={back}
        />
      ) : (
        <View style={styles.gone}>
          <Text style={styles.muted}>{reachable ? "This session has ended." : "Reconnecting…"}</Text>
        </View>
      )}
      {live && route ? (
        <TerminalInput key={key} ref={input} sessionKey={key} route={route} terminal={terminal} keyboardHeight={keyboard} />
      ) : (
        <View style={{ height: Math.max(insets.bottom, space.sm) }} />
      )}
      <SessionActions session={actions ? session ?? null : null} onClose={() => setActions(false)}>
        <SheetAction
          label={view === "fit" ? "Desktop size" : "Phone size"}
          icon={view === "fit" ? "desktop-outline" : "phone-portrait-outline"}
          detail={view === "fit" ? "Its own size, scaled down; pinch to zoom" : "Reflow it to fit the phone"}
          onPress={() => {
            setActions(false);
            setView((m) => (m === "fit" ? "full" : "fit"));
          }}
        />
      </SessionActions>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  // The design's small bar title: titleLarge in Roboto Flex at 20/26, so a long agent title fits.
  title: { fontSize: 20, lineHeight: 26 },
  gone: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  muted: { ...typography.bodyLarge, color: colors.onSurfaceVariant, textAlign: "center" },
  // The panes of a split tab, as filter chips.
  // A plain row, not a ScrollView: chips shrink to share the width.
  panes: { flexDirection: "row", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm, overflow: "hidden" },
  chip: { flexShrink: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space.sm, height: 32, borderRadius: shape.small, paddingHorizontal: space.lg },
  chipOn: { backgroundColor: colors.secondaryContainer, paddingLeft: space.sm },
  chipOff: { borderWidth: 1, borderColor: colors.outlineVariant },
  chipPressed: { backgroundColor: colors.surfaceContainerHigh },
  chipText: { ...typography.labelLarge, color: colors.onSurfaceVariant, maxWidth: 160 },
  chipTextOn: { color: colors.onSecondaryContainer },
}));
