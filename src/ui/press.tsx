// Material 3 Expressive's shape morph: a control's corners spring to a squarer
// shape while it is pressed (or when it changes state) and back when released.
import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, type AccessibilityRole, type Insets, type AccessibilityState, type StyleProp, type ViewStyle } from "react-native";

/** Corner radii, clockwise from the top left. */
export type Corners = readonly [topLeft: number, topRight: number, bottomRight: number, bottomLeft: number];

export function corners(all: number): Corners {
  return [all, all, all, all];
}

/** Where a segment sits in a connected group. */
export type Position = "first" | "middle" | "last" | "only";

/** A connected segment's corners: `outer` on the group's ends, `inner` where it meets its neighbours. */
export function segmentCorners(position: Position, outer: number, inner: number): Corners {
  switch (position) {
    case "first":
      return [outer, inner, inner, outer];
    case "middle":
      return corners(inner);
    case "last":
      return [inner, outer, outer, inner];
    case "only":
      return corners(outer);
  }
}

/** Tells each element of a connected group where it sits, unless it says so itself. */
export function withPositions(children: ReactNode): ReactElement[] {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<{ position?: Position }>[];
  const last = items.length - 1;
  return items.map((child, i) =>
    cloneElement(child, { position: child.props.position ?? (last === 0 ? "only" : i === 0 ? "first" : i === last ? "last" : "middle") }),
  );
}

const SPRING = { useNativeDriver: false, speed: 40, bounciness: 8 } as const;

/**
 * Springs the corners to `pressed` while held and to `rest` otherwise, and a
 * state layer's opacity to match. Spread `handlers` into the Pressable and
 * `style` into the Animated.View it wraps.
 */
export function useShapeMorph(rest: Corners, pressed: Corners = rest) {
  const [down, setDown] = useState(false);
  const target = down ? pressed : rest;
  const values = useRef(target.map((r) => new Animated.Value(r))).current;
  const layer = useRef(new Animated.Value(0)).current;

  const key = target.join(",");
  useEffect(() => {
    Animated.parallel(target.map((r, i) => Animated.spring(values[i], { ...SPRING, toValue: r }))).start();
    // `key` is `target` by value, so a new array with the same radii does not restart the spring.
  }, [key]);

  useEffect(() => {
    Animated.timing(layer, { toValue: down ? 1 : 0, duration: down ? 90 : 180, useNativeDriver: false }).start();
  }, [down, layer]);

  // A spring overshoots: never let a corner go negative.
  const clamp = (v: Animated.Value) => v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolateLeft: "clamp" });
  return {
    handlers: { onPressIn: () => setDown(true), onPressOut: () => setDown(false) },
    style: {
      borderTopLeftRadius: clamp(values[0]),
      borderTopRightRadius: clamp(values[1]),
      borderBottomRightRadius: clamp(values[2]),
      borderBottomLeftRadius: clamp(values[3]),
    },
    /** Opacity for a state layer drawn in the content color: 0.1 while pressed, as Material's pressed state. */
    layerOpacity: layer.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] }),
  };
}

/**
 * A pressable surface that morphs: `style` places it, `surface` paints it
 * (size, padding, color), and its corners follow `rest` and `pressed`.
 */
export function MorphPressable({
  rest,
  pressed,
  ink,
  surface,
  style,
  onPress,
  onLongPress,
  disabled,
  accessibilityRole = "button",
  accessibilityLabel,
  accessibilityState,
  hitSlop,
  children,
}: {
  rest: Corners;
  pressed?: Corners;
  /** The content color; the pressed state layer is drawn in it. */
  ink: string;
  surface: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  /** Extra touch area around a control smaller than 48dp. */
  hitSlop?: Insets;
  children: ReactNode;
}) {
  const morph = useShapeMorph(rest, pressed);
  return (
    <Pressable
      {...morph.handlers}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      hitSlop={hitSlop}
      style={style}
    >
      <Animated.View style={[styles.surface, surface, morph.style]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: ink, opacity: morph.layerOpacity }]} />
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: { overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "center" },
});
