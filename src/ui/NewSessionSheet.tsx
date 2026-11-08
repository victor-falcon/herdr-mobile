import { router } from "expo-router";
import { useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import type { Space } from "../spaces";
import { useSettings } from "../settings";
import { programOf, startAgent, useInstalledPrograms } from "./new-session";
import { Sheet } from "./Sheet";
import { makeStyles, radius, space as gap, useColors } from "./theme";

// The key for the plain shell row, which no agent command can be.
const SHELL = "\u0000shell";

export function NewSessionSheet({ space, onClose }: { space: Space | null; onClose: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const { agents: configured } = useSettings();
  const [starting, setStarting] = useState<string | null>(null);
  const installed = useInstalledPrograms(
    space?.target,
    configured.map((a) => programOf(a.command)),
  );
  const agents = installed ? configured.filter((a) => installed.has(programOf(a.command))) : configured;
  const rows = [...agents.map((a) => ({ key: a.command, label: a.name || a.command, command: a.command as string | null })), { key: SHELL, label: "Terminal", command: null }];

  const start = async (key: string, command: string | null) => {
    if (!space) return;
    setStarting(key);
    try {
      const session = await startAgent(space, command, command ? installed?.get(programOf(command)) : undefined);
      onClose();
      router.push({ pathname: "/session/[key]", params: { key: session } });
    } catch (e) {
      Alert.alert("Could not start it", e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(null);
    }
  };

  return (
    <Sheet visible={!!space} onClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          Open a new tab
        </Text>
        <Text style={styles.where} numberOfLines={1}>
          in {space?.name}
          {space?.target.label ? ` · ${space.target.label}` : ""}
        </Text>
      </View>
      {installed && configured.length > 0 && agents.length === 0 && (
        <Text style={styles.note}>None of your agents is installed on {space?.target.label}.</Text>
      )}
      <View style={styles.list}>
        {rows.map((r) => {
          const waiting = r.command !== null && !installed;
          return (
            <Pressable
              key={r.key}
              accessibilityRole="button"
              accessibilityLabel={r.label}
              disabled={waiting || !!starting}
              onPress={() => void start(r.key, r.command)}
              style={({ pressed }) => [styles.agent, pressed && styles.pressed, (waiting || (starting && starting !== r.key)) && styles.off]}
            >
              <View style={styles.icon}>
                <Ionicons name={r.command === null ? "terminal-outline" : "sparkles-outline"} size={18} color={colors.text} />
              </View>
              <Text style={styles.label} numberOfLines={1}>
                {r.label}
              </Text>
              {starting === r.key && <ActivityIndicator color={colors.text} />}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { marginHorizontal: 14, marginTop: gap.xs, marginBottom: gap.sm },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  where: { color: colors.muted, fontSize: 13, marginTop: 2 },
  list: { marginBottom: gap.sm },
  agent: { flexDirection: "row", alignItems: "center", gap: gap.md, paddingHorizontal: 14, paddingVertical: 14, borderRadius: radius.md },
  icon: { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceHigh },
  pressed: { backgroundColor: colors.surfaceHigh },
  off: { opacity: 0.4 },
  label: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "600" },
  note: { color: colors.muted, fontSize: 14, padding: 14 },
}));
