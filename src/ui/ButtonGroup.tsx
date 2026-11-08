// Material 3 Expressive's connected button group: segments 2px apart, round on
// the outside (20), tight on the inside (6); a selected segment becomes fully round.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { buttonColors, type ButtonVariant } from "./Button";
import type { IconName } from "./icons";
import { corners, MorphPressable, segmentCorners, withPositions, type Corners, type Position } from "./press";
import { fonts, makeStyles, shape, typography, useColors } from "./theme";

const OUTER = shape.largeIncreased;
const INNER = 6;

/** Lays its segments out in a row and tells each where it sits. */
export function ButtonGroup({ children, gap = 2, style, accessibilityLabel }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]} accessibilityLabel={accessibilityLabel}>
      {withPositions(children)}
    </View>
  );
}

/** A segment of a ButtonGroup. `corners` overrides its shape, e.g. for a grid of arrow keys; a selected segment is fully round regardless. */
export function GroupButton({
  label,
  icon,
  onPress,
  selected,
  variant = "tonal",
  height = 40,
  position = "only",
  corners: shapeOverride,
  flex,
  width,
  accessibilityLabel,
  mono,
}: {
  label?: string;
  icon?: IconName;
  onPress: () => void;
  /** Set for choices (radio-like groups): selected is filled primary and fully round. */
  selected?: boolean;
  variant?: ButtonVariant;
  height?: number;
  position?: Position;
  corners?: Corners;
  flex?: number;
  width?: number;
  accessibilityLabel?: string;
  /** Roboto Mono, for key caps. */
  mono?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { fill, ink, outline } = buttonColors(selected ? "filled" : variant, colors);
  const rest = selected ? corners(height / 2) : (shapeOverride ?? segmentCorners(position, OUTER, INNER));
  return (
    <MorphPressable
      rest={rest}
      pressed={corners(shape.extraSmall)}
      ink={ink}
      onPress={onPress}
      accessibilityRole={selected === undefined ? "button" : "radio"}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      style={flex ? { flex } : undefined}
      hitSlop={height < 48 ? { top: (48 - height) / 2, bottom: (48 - height) / 2 } : undefined}
      surface={[styles.segment, { height, width, backgroundColor: fill }, outline ? { borderWidth: 1, borderColor: outline } : null]}
    >
      {icon ? <Ionicons name={icon} size={20} color={ink} /> : null}
      {label ? <Text style={[styles.label, mono && styles.mono, { color: ink }]}>{label}</Text> : null}
    </MorphPressable>
  );
}

/** A value shown between a group's buttons, like the text size between − and +. */
export function GroupValue({ children, height = 40, width = 44, position = "middle" }: { children: ReactNode; height?: number; width?: number; position?: Position }) {
  const styles = useStyles();
  const [tl, tr, br, bl] = segmentCorners(position, OUTER, INNER);
  return (
    <View style={[styles.value, { height, width, borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl }]}>
      <Text style={styles.valueText}>{children}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  segment: { paddingHorizontal: 12, gap: 8 },
  label: { ...typography.labelLarge },
  mono: { fontFamily: fonts.monoMedium, fontSize: 13 },
  value: { backgroundColor: colors.surfaceContainerHighest, alignItems: "center", justifyContent: "center" },
  valueText: { color: colors.onSurface, fontFamily: fonts.mono, fontSize: 16, fontVariant: ["tabular-nums"] },
}));
