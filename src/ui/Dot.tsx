import { View } from "react-native";

/** A small status dot, filled or a ring. Session status is drawn by StatusAvatar (Avatar.tsx). */
export function Dot({ color, hollow, size = 8 }: { color: string; hollow?: boolean; size?: number }) {
  const ring = Math.max(1.5, size / 5);
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, ...(hollow ? { borderWidth: ring, borderColor: color } : { backgroundColor: color }) }}
    />
  );
}
