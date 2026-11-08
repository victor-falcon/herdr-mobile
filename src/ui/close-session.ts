import { Alert } from "react-native";
import { fleet } from "../fleet-store";
import type { Session } from "../hc/fleet";

/**
 * Close terminals the way the desktop does: end each program, then forget the
 * terminal. Herdr closes a pane whose terminal ends, and the tab with its last pane.
 */
export async function closeSessions(sessions: Session[]): Promise<void> {
  const failures: string[] = [];
  await Promise.all(
    sessions.map(async (s) => {
      const route = fleet.route(s.key);
      if (!route) return void failures.push("its machine is offline");
      const terminal = route.address;
      try {
        if (s.terminal.state === "live") await route.conn.call("terminal.kill", { terminal });
        // The core only removes a terminal once it has ended, which can take a moment after kill.
        for (let i = 0; ; i++) {
          try {
            await route.conn.call("terminal.rm", { terminal });
            break;
          } catch (e) {
            if (i >= 20) throw e;
            await new Promise((r) => setTimeout(r, 100));
          }
        }
      } catch (e) {
        failures.push(e instanceof Error ? e.message : String(e));
      }
    }),
  );
  if (failures.length) Alert.alert("Could not close it", failures[0]);
}

/** Ask first, then close. Resolves true when the person confirmed. */
export function confirmClose(title: string, sessions: Session[], detail = "Its program ends and the tab closes on every screen."): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(`Close ${title}?`, detail, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      {
        text: "Close",
        style: "destructive",
        onPress: () => {
          resolve(true);
          void closeSessions(sessions);
        },
      },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
