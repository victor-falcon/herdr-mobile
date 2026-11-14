// The inbox: every agent across spaces and machines, in groups most urgent
// first, like the desktop sidebar's Inbox mode.
import { useState } from "react";
import { Text, View } from "react-native";
import type { Session } from "../hc/fleet";
import { namedTabOf, type InboxGroup } from "../spaces";
import { Card } from "./Group";
import { AgentRow, agentTarget, Swipe, TEXT_INSET, useRowMenu } from "./SpaceList";
import { SubagentsSheet, SubChip } from "./Subagents";
import { emphasized, makeStyles, space as gap } from "./theme";

type Props = {
  groups: InboxGroup[];
  showMachine: boolean;
  onSelect: (s: Session) => void;
};

export function InboxList({ groups, showMachine, onSelect }: Props) {
  const styles = useStyles();
  const rows = useRowMenu();
  // The parent whose subagents the sheet lists, found again on each update so the sheet stays current (and closes when it is gone).
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const sheetAgent = sheetKey ? (groups.flatMap((g) => g.agents).find((a) => a.session.key === sheetKey && a.subs.length) ?? null) : null;
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
            {g.agents.map((agent) => {
              const { session, space, summary, changedAt } = agent;
              const target = agentTarget(session, space);
              // Where it runs, as the desktop's "space · 5m": the time is already on the right.
              const where = [showMachine ? (space?.target.label ?? session.machine) : "", space?.name ?? ""].filter(Boolean).join(" · ") || null;
              return (
                <Swipe key={session.key} onClose={() => rows.close(target)}>
                  <AgentRow
                    session={session}
                    title={namedTabOf(space, session.key)}
                    hint={where}
                    urgentFirst
                    changedAt={changedAt}
                    trailing={summary ? <SubChip summary={summary} onPress={() => setSheetKey(session.key)} /> : null}
                    onPress={() => onSelect(session)}
                    onLongPress={() => rows.open(target)}
                  />
                </Swipe>
              );
            })}
          </Card>
        </View>
      ))}
      {rows.sheets}
      <SubagentsSheet agent={sheetAgent} onClose={() => setSheetKey(null)} onSelect={onSelect} />
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
