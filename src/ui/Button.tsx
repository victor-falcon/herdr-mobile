// Material 3 Expressive buttons: round at rest, squarer while pressed.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Text, type StyleProp, type ViewStyle } from "react-native";
import { corners, MorphPressable } from "./press";
import { makeStyles, shape, typography, useColors, type Colors } from "./theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

/** filled, tonal, outlined and text are Material's; primary, secondary and danger are the app's older names. */
export type ButtonVariant = "filled" | "tonal" | "outlined" | "text" | "primary" | "secondary" | "danger";
export type ButtonSize = "small" | "medium";

const HEIGHT: Record<ButtonSize, number> = { small: 40, medium: 56 };
const PRESSED: Record<ButtonSize, number> = { small: shape.small, medium: shape.medium };

/** Container and content colors for a variant. */
export function buttonColors(variant: ButtonVariant, colors: Colors): { fill: string; ink: string; outline?: string } {
  switch (variant) {
    case "filled":
    case "primary":
      return { fill: colors.primary, ink: colors.onPrimary };
    case "tonal":
    case "secondary":
      return { fill: colors.secondaryContainer, ink: colors.onSecondaryContainer };
    case "outlined":
      return { fill: "transparent", ink: colors.onSurfaceVariant, outline: colors.outlineVariant };
    case "text":
      return { fill: "transparent", ink: colors.primary };
    case "danger":
      return { fill: colors.errorContainer, ink: colors.onErrorContainer };
  }
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "small",
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { fill, ink, outline } = buttonColors(variant, colors);
  const height = HEIGHT[size];
  const off = !!(disabled || loading);
  const medium = size === "medium";
  return (
    <MorphPressable
      rest={corners(height / 2)}
      pressed={corners(PRESSED[size])}
      ink={ink}
      onPress={onPress}
      disabled={off}
      accessibilityLabel={title}
      accessibilityState={{ busy: !!loading }}
      style={style}
      surface={[
        styles.base,
        { height, paddingHorizontal: medium ? 24 : 16, backgroundColor: fill },
        outline ? { borderWidth: 1, borderColor: outline } : null,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={medium ? 24 : 20} color={ink} /> : null}
          <Text style={[medium ? styles.labelMedium : styles.labelSmall, { color: ink }]} numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
    </MorphPressable>
  );
}

/** A toggle: tonal when off, primary and squarer when on. */
export function ToggleButton({
  label,
  icon,
  selected,
  onPress,
  height = 48,
  style,
  accessibilityLabel,
}: {
  label?: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
  height?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const styles = useStyles();
  const ink = selected ? colors.onPrimary : colors.onSurface;
  return (
    <MorphPressable
      rest={corners(selected ? shape.small : 14)}
      pressed={corners(shape.extraSmall)}
      ink={ink}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={style}
      surface={[styles.base, { height, minWidth: height, paddingHorizontal: label ? 12 : 0, backgroundColor: selected ? colors.primary : colors.surfaceContainerHighest }]}
    >
      {icon ? <Ionicons name={icon} size={20} color={ink} /> : null}
      {label ? <Text style={[styles.labelSmall, { color: ink }]}>{label}</Text> : null}
    </MorphPressable>
  );
}

/** The extended floating action button: primaryContainer, corner 16. */
export function Fab({ label, icon, onPress, style }: { label: string; icon: IconName; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <MorphPressable
      rest={corners(shape.large)}
      pressed={corners(shape.medium)}
      ink={colors.onPrimaryContainer}
      onPress={onPress}
      accessibilityLabel={label}
      style={style}
      surface={[styles.fab, { backgroundColor: colors.primaryContainer }]}
    >
      <Ionicons name={icon} size={24} color={colors.onPrimaryContainer} />
      <Text style={[styles.labelMedium, { color: colors.onPrimaryContainer }]}>{label}</Text>
    </MorphPressable>
  );
}

const useStyles = makeStyles(() => ({
  base: { gap: 8 },
  disabled: { opacity: 0.38 },
  labelSmall: { ...typography.labelLarge },
  labelMedium: { ...typography.titleMedium },
  fab: { height: 56, paddingLeft: 16, paddingRight: 20, gap: 12, elevation: 3 },
}));
