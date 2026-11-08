import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fleet, useFleet } from "../../src/fleet-store";
import { useSettings } from "../../src/settings";
import { TerminalInput, type TerminalInputHandle } from "../../src/terminal/TerminalInput";
import { TerminalView, type TerminalHandle, type TerminalMode } from "../../src/terminal/TerminalView";
import { IconButton } from "../../src/ui/IconButton";
import { SessionActions } from "../../src/ui/SessionActions";
import { SheetAction } from "../../src/ui/Sheet";
import { TopAppBar } from "../../src/ui/TopAppBar";
import { useKeyboardHeight } from "../../src/ui/keyboard";
import { agentTitle, shortPath } from "../../src/ui/session-display";
import { makeStyles, space, typography } from "../../src/ui/theme";

export default function SessionScreen() {
  const styles = useStyles();
  const { key } = useLocalSearchParams<{ key: string }>();
  useFleet();
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

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const seen = useRef(false);
  const title = useRef("Session");
  const where = useRef("");
  if (session) {
    title.current = agentTitle(session);
    where.current = `${session.machine} · ${shortPath(session.terminal.foreground?.cwd || session.terminal.cwd)}`;
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
        titleStyle={styles.title}
        actions={<IconButton icon="ellipsis-vertical" label="Session actions" onPress={() => setActions(true)} disabled={!session} />}
      />
      {t && route ? (
        <TerminalView
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
        <TerminalInput ref={input} sessionKey={key} route={route} terminal={terminal} keyboardHeight={keyboard} />
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
}));
