import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fleet, useFleet } from "../../src/fleet-store";
import { useSettings } from "../../src/settings";
import { TerminalInput, type TerminalInputHandle } from "../../src/terminal/TerminalInput";
import { TerminalView, type TerminalHandle, type TerminalMode } from "../../src/terminal/TerminalView";
import { SessionActions } from "../../src/ui/SessionActions";
import { SheetAction } from "../../src/ui/Sheet";
import { useKeyboardHeight } from "../../src/ui/keyboard";
import { agentTitle } from "../../src/ui/session-display";
import { makeStyles, space, useColors } from "../../src/ui/theme";

export default function SessionScreen() {
  const colors = useColors();
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
  if (session) title.current = agentTitle(session);
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
      <Stack.Screen
        options={{
          title: title.current,
          headerRight: () => (
            <Pressable hitSlop={10} onPress={() => setActions(true)} disabled={!session} accessibilityRole="button" accessibilityLabel="Session actions">
              <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
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
  gone: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: colors.muted },
}));
