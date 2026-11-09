// The inbox's subagents: a chip on a parent's row with how many it launched and
// the most urgent one's status, and a sheet listing them, like the desktop
// sidebar's pill and card.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { Session } from "../hc/fleet";
import { inboxStatus, statusWords, subsLabel, type InboxAgent, type InboxStatus, type SubSummary } from "../spaces";
import { StatusAvatar, statusAvatarColors, type AvatarStatus } from "./Avatar";
import { segmentCorners, withPositions, type Position } from "./press";
import { agentTitle, ago } from "./session-display";
import { LoadingIndicator } from "./Shapes";
import { Sheet, SheetHeader } from "./Sheet";
import { makeStyles, shape, space, typography, useColors, type Colors } from "./theme";

const AVATAR: Record<InboxStatus, AvatarStatus> = { blocked: "needsYou", working: "working", done: "done", idle: "terminal" };

/** The chip's ink and fill: the status avatars' colours. */
function tint(status: InboxStatus, colors: Colors) {
  return statusAvatarColors(AVATAR[status], colors);
}

/** How many subagents, with the most urgent one's mark: ! > the cookie > a dot > a stack when all are idle. */
export function SubChip({ summary, onPress }: { summary: SubSummary; onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const { color, background } = tint(summary.status, colors);
  return (
    <Pressable
      onPress={onPress}
      // The chip is 20 tall: the slop makes it a 48dp target.
      hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={subsLabel(summary)}
      accessibilityHint="Shows them"
      style={({ pressed }) => [styles.chip, { backgroundColor: background }, pressed && styles.chipPressed]}
    >
      {summary.status === "working" ? (
        <LoadingIndicator size={12} color={color} label="" />
      ) : summary.status === "blocked" ? (
        <Text style={[styles.mark, { color }]}>!</Text>
      ) : summary.status === "done" ? (
        <View style={[styles.dot, { backgroundColor: color }]} />
      ) : (
        <Ionicons name="layers-outline" size={12} color={color} />
      )}
      <Text style={[styles.count, { color }]}>{summary.total}</Text>
    </Pressable>
  );
}

/** A parent's subagents, most urgent first; tapping one closes the sheet and opens it. */
export function SubagentsSheet({ agent, onClose, onSelect }: { agent: InboxAgent | null; onClose: () => void; onSelect: (s: Session) => void }) {
  const styles = useStyles();
  const n = agent?.subs.length ?? 0;
  return (
    <Sheet visible={!!agent} onClose={onClose}>
      {agent && (
        <>
          <SheetHeader
            title={agentTitle(agent.session)}
            meta={[agent.space?.name, `${n} subagent${n === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
            avatar={<StatusAvatar session={agent.session} size={48} square />}
          />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.rows}>
            {withPositions(
              agent.subs.map((sub) => (
                <SubRow
                  key={sub.session.key}
                  session={sub.session}
                  onPress={() => {
                    onClose();
                    onSelect(sub.session);
                  }}
                />
              )),
            )}
          </ScrollView>
        </>
      )}
    </Sheet>
  );
}

const OUTER = shape.largeIncreased;
const INNER = shape.extraSmall;

/** A subagent: its status, name and time, and what its terminal's title says. */
function SubRow({ session, onPress, position = "only" }: { session: Session; onPress: () => void; position?: Position }) {
  const styles = useStyles();
  const [tl, tr, br, bl] = segmentCorners(position, OUTER, INNER, "column");
  const t = session.terminal;
  const name = agentTitle(session);
  const status = inboxStatus(session);
  // What it is doing: the agent's own message, else its terminal's title when that says something the name doesn't.
  const doing = t.status?.msg || (t.title && t.title !== name ? t.title : null) || statusWords(status);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl },
        pressed && styles.rowPressed,
      ]}
    >
      <StatusAvatar session={session} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.doing, status === "blocked" && styles.blocked]} numberOfLines={1}>
          {doing}
        </Text>
      </View>
      <Text style={styles.age}>{ago(t.status_ms ?? t.created_ms)}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  chip: { flexDirection: "row", alignItems: "center", gap: space.xs, height: 20, paddingHorizontal: space.sm, borderRadius: shape.full },
  chipPressed: { opacity: 0.7 },
  mark: { ...typography.labelMedium, fontWeight: "900", lineHeight: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  count: { ...typography.labelMedium, fontVariant: ["tabular-nums"], lineHeight: 14 },
  scroll: { flexGrow: 0 },
  rows: { gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 64, backgroundColor: colors.surfaceContainerLowest },
  rowPressed: { backgroundColor: colors.surfaceContainerHigh },
  text: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...typography.bodyLarge, color: colors.onSurface },
  doing: { ...typography.bodyMedium, color: colors.onSurfaceVariant },
  blocked: { color: colors.error },
  age: { ...typography.labelMedium, color: colors.onSurfaceVariant, fontVariant: ["tabular-nums"] },
}));
