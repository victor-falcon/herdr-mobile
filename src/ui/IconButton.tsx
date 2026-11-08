import Ionicons from "@expo/vector-icons/Ionicons";
import type { StyleProp, ViewStyle } from "react-native";
import type { IconName } from "./Button";
import { corners, MorphPressable } from "./press";
import { shape, useColors } from "./theme";

/** A round icon button: plain (onSurfaceVariant on nothing) or tonal (secondaryContainer). */
export function IconButton({
  icon,
  label,
  onPress,
  onLongPress,
  variant = "standard",
  size = 48,
  color,
  disabled,
  style,
}: {
  icon: IconName;
  /** What a screen reader says. */
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  variant?: "standard" | "tonal";
  size?: 40 | 48;
  /** The icon's color, when it is not the variant's. */
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const tonal = variant === "tonal";
  const ink = color ?? (tonal ? colors.onSecondaryContainer : colors.onSurfaceVariant);
  return (
    <MorphPressable
      rest={corners(size / 2)}
      pressed={corners(shape.medium)}
      ink={ink}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={style}
      surface={{ width: size, height: size, backgroundColor: tonal ? colors.secondaryContainer : "transparent", opacity: disabled ? 0.38 : 1 }}
    >
      <Ionicons name={icon} size={size === 40 ? 20 : 24} color={ink} />
    </MorphPressable>
  );
}
