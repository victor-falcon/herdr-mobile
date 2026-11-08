// Material 3 Expressive's soft polygons, built from rounded squares turned
// against each other (react-native-svg is not in the app).
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { IconName } from "./icons";
import { useColors } from "./theme";

/**
 * A cookie: `lobes` soft points around a circle (a multiple of 4). Squares
 * turned by 90/(lobes/4) degrees overlap into the outline.
 */
export function Cookie({ size, color, lobes = 8 }: { size: number; color: string; lobes?: 8 | 12 | 16 }) {
  const layers = lobes / 4;
  // The squares' corners make the lobes; a square inscribed in the cookie keeps it inside `size`.
  const side = size * 0.78;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: layers }, (_, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: side,
            height: side,
            borderRadius: side * 0.28,
            backgroundColor: color,
            transform: [{ rotate: `${(90 / layers) * i}deg` }],
          }}
        />
      ))}
    </View>
  );
}

/** Material's loading indicator: an 8-lobed cookie that turns and breathes. */
export function LoadingIndicator({ size = 24, color, label = "Working" }: { size?: number; color?: string; label?: string }) {
  const colors = useColors();
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const scale = turn.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.86, 1, 0.86, 1] });
  return (
    <Animated.View accessibilityRole="progressbar" accessibilityLabel={label} style={{ transform: [{ rotate }, { scale }] }}>
      <Cookie size={size} color={color ?? colors.primary} lobes={8} />
    </Animated.View>
  );
}

/** A cookie-shaped badge with an icon in it, as on empty states. */
export function ShapeBadge({ icon, size = 132, color, iconColor, style }: { icon: IconName; size?: number; color?: string; iconColor?: string; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Cookie size={size} color={color ?? colors.primaryContainer} lobes={12} />
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <Ionicons name={icon} size={Math.round(size * 0.4)} color={iconColor ?? colors.onPrimaryContainer} />
      </View>
    </View>
  );
}
