import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Alert, View } from "react-native";
import { fleet } from "../fleet-store";
import type { Session } from "../hc/fleet";
import { confirmClose } from "./close-session";
import { agentTitle, ago, shortPath } from "./session-display";
import { StatusAvatar } from "./Avatar";
import { Sheet, SheetAction, SheetActions, SheetHeader } from "./Sheet";
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
          <SheetHeader
            title={agentTitle(session)}
            meta={[session.machine, shortPath(t.foreground?.cwd || t.cwd), live ? `started ${ago(t.created_ms)} ago` : "ended"].join(" · ")}
            avatar={<StatusAvatar session={session} size={48} square />}
          />
          <SheetActions>
            {children}
            {live && (
              <SheetAction
                label="Interrupt"
                icon="stop-outline"
                detail="Stop what it is doing"
                onPress={run(async () => {
                  const r = await call("terminal.interrupt");
                  if (r?.outcome) Alert.alert("Interrupted", `Pressed ${r.key}: ${r.outcome}`);
                })}
              />
            )}
            <SheetAction
              label="Copy output"
              icon="copy-outline"
              detail="The screen and up to 1000 lines of history"
              onPress={run(async () => {
                const r = await call("terminal.read", { lines: 1000 });
                if (typeof r?.text !== "string") return;
                const text = r.text.split("\n").map((l: string) => l.trimEnd()).join("\n").replace(/^\n+|\n+$/g, "");
                await Clipboard.setStringAsync(text + "\n");
              })}
            />
          </SheetActions>
          <View style={styles.danger}>
            <SheetActions>
              {live ? (
                <SheetAction
                  label="Close"
                  icon="close"
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
                  icon="trash-outline"
                  detail="Forget this session and its output"
                  danger
                  onPress={run(async () => {
                    await call("terminal.rm");
                    if (router.canGoBack()) router.back();
                  })}
                />
              )}
            </SheetActions>
          </View>
        </>
      )}
    </Sheet>
  );
}

const useStyles = makeStyles(() => ({
  danger: { marginTop: space.md },
}));
