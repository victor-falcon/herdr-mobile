import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { Session } from "../hc/fleet";
import type { IconName } from "./icons";
import { LoadingIndicator } from "./Shapes";
import { useColors, type Colors } from "./theme";

/** A circle (or, for sheet headers, a rounded square) holding an icon or anything else. */
export function Avatar({
  icon,
  color,
  background,
  size = 40,
  square,
  children,
  style,
}: {
  icon?: IconName;
  color: string;
  background: string;
  size?: number;
  /** A rounded square (corner 16 at 48px), as in sheet headers. */
  square?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: square ? size / 3 : size / 2, backgroundColor: background, alignItems: "center", justifyContent: "center" },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={Math.round(size / 2)} color={color} /> : children}
    </View>
  );
}

export type AvatarStatus = "working" | "needsYou" | "done" | "terminal";

/** What a session's avatar shows, the same buckets as StatusDot. */
export function avatarStatus(session: Session): AvatarStatus {
  const state = session.terminal.status?.state;
  if (!state || session.terminal.state !== "live") return "terminal";
  if (state === "working") return "working";
  if (state === "blocked" || state === "error") return "needsYou";
  return "done";
}

export function statusAvatarColors(status: AvatarStatus, colors: Colors): { color: string; background: string; icon?: IconName } {
  switch (status) {
    case "working":
      return { color: colors.working, background: colors.workingContainer };
    case "needsYou":
      return { color: colors.onErrorContainer, background: colors.errorContainer, icon: "alert" };
    case "done":
      return { color: colors.done, background: colors.doneContainer, icon: "checkmark" };
    case "terminal":
      return { color: colors.onSurfaceVariant, background: colors.surfaceContainerHighest, icon: "terminal-outline" };
  }
}

/** A session's state as an avatar: a turning cookie while it works, ! when it needs you, a check when done, a prompt for plain terminals. */
export function StatusAvatar({ session, status, size = 40, square, style }: { session?: Session; status?: AvatarStatus; size?: number; square?: boolean; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const s = status ?? (session ? avatarStatus(session) : "terminal");
  const { color, background, icon } = statusAvatarColors(s, colors);
  return (
    <Avatar color={color} background={background} icon={icon} size={size} square={square} style={style}>
      {s === "working" ? <LoadingIndicator size={Math.round(size * 0.6)} color={color} /> : null}
    </Avatar>
  );
}

