// Grouped rows, like a settings list: a section label in primary over a card
// (corner 20, surfaceContainerLow) whose rows are split by inset dividers.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Children, type ReactNode } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { IconName } from "./Button";
import { emphasized, makeStyles, shape, space, typography, useColors } from "./theme";

export function Section({ title, children, style }: { title?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <Card>{children}</Card>
    </View>
  );
}

/** The card a Section draws, for grouped rows without a label. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const items = Children.toArray(children);
  return (
    <View style={[styles.card, style]}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 ? <View style={styles.divider} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

/**
 * A title with optional supporting text, something leading (an `icon`, or any
 * `left` such as an Avatar), and controls trailing. Tappable rows without
 * controls get a chevron.
 */
export function Row({
  label,
  hint,
  icon,
  left,
  onPress,
  onLongPress,
  chevron,
  top,
  children,
}: {
  label: string;
  hint?: ReactNode;
  icon?: IconName;
  left?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Overrides the chevron a tappable row shows by default. */
  chevron?: boolean;
  /** Aligns to the top, for rows with long supporting text or content under it. */
  top?: boolean;
  children?: ReactNode;
}) {
  const colors = useColors();
  const styles = useStyles();
  const showChevron = chevron ?? (!!onPress && !children);
  const body = (
    <>
      {icon ? <Ionicons name={icon} size={24} color={colors.onSurfaceVariant} style={top && styles.iconTop} /> : null}
      {left}
      <View style={styles.flex}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {children}
      {showChevron ? <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceVariant} /> : null}
    </>
  );
  const rowStyle = [styles.row, top && styles.top];
  if (!onPress && !onLongPress) return <View style={rowStyle}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [rowStyle, pressed && styles.pressed]} onPress={onPress} onLongPress={onLongPress}>
      {body}
    </Pressable>
  );
}

/** Free content inside a Section, padded like a Row. */
export function Cell({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.cell}>{children}</View>;
}

const useStyles = makeStyles((colors) => ({
  section: { gap: space.sm },
  title: { ...emphasized.titleSmall, color: colors.primary, paddingHorizontal: space.xs },
  card: { backgroundColor: colors.surfaceContainerLow, borderRadius: shape.largeIncreased, overflow: "hidden" },
  divider: { height: 1, backgroundColor: colors.outlineVariant, marginHorizontal: space.lg },
  row: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56 },
  top: { alignItems: "flex-start" },
  iconTop: { marginTop: 2 },
  pressed: { backgroundColor: colors.surfaceContainerHigh },
  flex: { flex: 1, gap: 2 },
  label: { ...typography.bodyLarge, color: colors.onSurface },
  hint: { ...typography.bodyMedium, color: colors.onSurfaceVariant },
  cell: { padding: space.lg, gap: space.sm },
}));
