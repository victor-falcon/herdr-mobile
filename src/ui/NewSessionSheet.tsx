import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import type { Space } from "../spaces";
import { useSettings } from "../settings";
import { Avatar } from "./Avatar";
import { programOf, startAgent, useInstalledPrograms } from "./new-session";
import { segmentCorners, withPositions, type Position } from "./press";
import { LoadingIndicator } from "./Shapes";
import { Sheet, SheetHeader } from "./Sheet";
import { makeStyles, shape, space as gap, typography, useColors } from "./theme";

// The key for the plain shell row, which no agent command can be.
const SHELL = "\u0000shell";

export function NewSessionSheet({ space, onClose }: { space: Space | null; onClose: () => void }) {
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
      <SheetHeader title="Open a new tab" meta={`in ${space?.name ?? ""}${space?.target.label ? ` · ${space.target.label}` : ""}`} />
      {installed && configured.length > 0 && agents.length === 0 && <Text style={styles.note}>None of your agents is installed on {space?.target.label}.</Text>}
      <View style={styles.list}>
        {withPositions(
          rows.map((r) => {
            const waiting = r.command !== null && !installed;
            return (
              <ProgramRow
                key={r.key}
                label={r.label}
                shell={r.command === null}
                busy={starting === r.key}
                disabled={waiting || !!starting}
                onPress={() => void start(r.key, r.command)}
              />
            );
          }),
        )}
      </View>
    </Sheet>
  );
}

/** One agent (or the plain terminal) as a segmented row; the one being started lights up. */
function ProgramRow({ label, shell, busy, disabled, onPress, position = "only" }: { label: string; shell: boolean; busy: boolean; disabled: boolean; onPress: () => void; position?: Position }) {
  const colors = useColors();
  const styles = useStyles();
  const [tl, tr, br, bl] = segmentCorners(position, shape.largeIncreased, shape.extraSmall);
  const tile = busy
    ? { color: colors.onPrimary, background: colors.primary }
    : shell
      ? { color: colors.onSurfaceVariant, background: colors.surfaceContainerHighest }
      : { color: colors.onSecondaryContainer, background: colors.secondaryContainer };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl },
        pressed && styles.pressed,
        busy && styles.busy,
        disabled && !busy && styles.off,
      ]}
    >
      <Avatar icon={shell ? "terminal-outline" : "sparkles-outline"} size={40} color={tile.color} background={tile.background} style={styles.tile} />
      <Text style={[styles.label, busy && { color: colors.onPrimaryContainer }]} numberOfLines={1}>
        {label}
      </Text>
      {busy && <LoadingIndicator size={24} color={colors.primary} label="Starting" />}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  list: { gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: gap.lg, paddingHorizontal: gap.lg, paddingVertical: gap.md, minHeight: 64, backgroundColor: colors.surfaceContainerLowest },
  tile: { borderRadius: shape.medium },
  pressed: { backgroundColor: colors.surfaceContainerHigh },
  busy: { backgroundColor: colors.primaryContainer },
  off: { opacity: 0.38 },
  label: { ...typography.titleMedium, flex: 1, color: colors.onSurface },
  note: { ...typography.bodyMedium, color: colors.onSurfaceVariant, paddingHorizontal: gap.sm, paddingBottom: gap.md },
}));
