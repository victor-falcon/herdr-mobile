import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { fleet } from "../fleet-store";
import type { Session } from "../hc/fleet";
import { confirmClose } from "./close-session";
import { agentTitle, ago, shortPath } from "./session-display";
import { Sheet, SheetAction } from "./Sheet";
import { makeStyles, space } from "./theme";

export function SessionActions({ session, onClose, children }: { session: Session | null; onClose: () => void; children?: ReactNode }) {
  const styles = useStyles();
  const t = session?.terminal;
  const live = t?.state === "live";

  const call = async (method: string, params: object = {}) => {
    const route = session && fleet.route(session.key);
    if (!route) return Alert.alert("Not connected", "This session's machine is offline.");
    try {
      return await route.conn.call(method, { terminal: route.address, ...params });
    } catch (e) {
      Alert.alert("It did not work", e instanceof Error ? e.message : String(e));
    }
  };

  const run = (fn: () => unknown) => () => {
    onClose();
    void fn();
  };

  return (
    <Sheet visible={!!session} onClose={onClose}>
      {session && t && (
        <>
          <View style={styles.head}>
            <Text style={styles.title} numberOfLines={1}>
              {agentTitle(session)}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {[session.machine, shortPath(t.foreground?.cwd || t.cwd), live ? `started ${ago(t.created_ms)} ago` : "ended"].join(" · ")}
            </Text>
          </View>
          {children}
          {live && (
            <SheetAction
              label="Interrupt"
              detail="Stop what it is doing"
              onPress={run(async () => {
                const r = await call("terminal.interrupt");
                if (r?.outcome) Alert.alert("Interrupted", `Pressed ${r.key}: ${r.outcome}`);
              })}
            />
          )}
          <SheetAction
            label="Copy output"
            detail="The screen and up to 1000 lines of history"
            onPress={run(async () => {
              const r = await call("terminal.read", { lines: 1000 });
              if (typeof r?.text !== "string") return;
              const text = r.text.split("\n").map((l: string) => l.trimEnd()).join("\n").replace(/^\n+|\n+$/g, "");
              await Clipboard.setStringAsync(text + "\n");
            })}
          />
          {live ? (
            <SheetAction
              label="Close"
              detail="End it and close its tab"
              danger
              onPress={run(async () => {
                if (!(await confirmClose(agentTitle(session), [session]))) return;
                if (router.canGoBack()) router.back();
                else router.replace("/");
              })}
            />
          ) : (
            <SheetAction
              label="Remove"
              detail="Forget this session and its output"
              danger
              onPress={run(async () => {
                await call("terminal.rm");
                if (router.canGoBack()) router.back();
              })}
            />
          )}
        </>
      )}
    </Sheet>
  );
}

const useStyles = makeStyles((colors) => ({
  head: { paddingHorizontal: 14, paddingBottom: space.md, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, marginBottom: 4 },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 13 },
}));
