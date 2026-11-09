// The inbox: every agent across spaces and machines, in groups most urgent
// first, like the desktop sidebar's Inbox mode.
import { Text, View } from "react-native";
import type { Session } from "../hc/fleet";
import type { InboxGroup } from "../spaces";
import { Card } from "./Group";
import { AgentRow, agentTarget, Swipe, TEXT_INSET, useRowMenu } from "./SpaceList";
import { emphasized, makeStyles, space as gap } from "./theme";

type Props = {
  groups: InboxGroup[];
  showMachine: boolean;
  onSelect: (s: Session) => void;
};

export function InboxList({ groups, showMachine, onSelect }: Props) {
  const styles = useStyles();
  const rows = useRowMenu();
  return (
    <View style={styles.list}>
      {groups.map((g) => (
        <View key={g.key} style={styles.group}>
          <View style={styles.head} accessibilityRole="header" accessibilityLabel={`${g.label}, ${g.agents.length}`}>
            <Text style={styles.label} numberOfLines={1}>
              {g.label}
            </Text>
            <Text style={styles.count}>{g.agents.length}</Text>
          </View>
          <Card inset={TEXT_INSET}>
            {g.agents.map(({ session, space }) => {
              const target = agentTarget(session, space);
              // Where it runs, as the desktop's "space · 5m": the time is already on the right.
              const where = [showMachine ? (space?.target.label ?? session.machine) : "", space?.name ?? ""].filter(Boolean).join(" · ") || null;
              return (
                <Swipe key={session.key} onClose={() => rows.close(target)}>
                  <AgentRow session={session} hint={where} urgentFirst onPress={() => onSelect(session)} onLongPress={() => rows.open(target)} />
                </Swipe>
              );
            })}
          </Card>
        </View>
      ))}
      {rows.sheets}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  list: { gap: gap.xl },
  group: { gap: gap.sm },
  head: { flexDirection: "row", alignItems: "center", gap: gap.sm, paddingHorizontal: gap.xs },
  label: { ...emphasized.titleSmall, color: colors.primary, flexShrink: 1 },
  count: { ...emphasized.titleSmall, color: colors.onSurfaceVariant, fontVariant: ["tabular-nums"] },
}));
