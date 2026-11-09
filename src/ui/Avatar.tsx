import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { Session } from "../hc/fleet";
import { Dot } from "./Dot";
import type { IconName } from "./icons";
import { agentKind } from "./session-display";
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


// Claude's mark on a 16×16 grid: body, arms and legs, with the eyes cut out in the avatar's color.
const CLAUDE: [number, number, number, number][] = [
  [2, 4, 12, 6],
  [0, 6, 2, 2],
  [14, 6, 2, 2],
  [3, 10, 1, 3],
  [5, 10, 1, 3],
  [10, 10, 1, 3],
  [12, 10, 1, 3],
];
const EYES: [number, number, number, number][] = [
  [4, 6, 1, 2],
  [11, 6, 1, 2],
];

/** Which agent runs in a session, as the desktop's sidebar leads its rows with: Claude's mark, π for Pi, an initial, or a prompt. */
export function AgentAvatar({ session, size = 40, style }: { session: Session; size?: number; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const kind = agentKind(session);
  const background = colors.surfaceContainerHighest;
  if (kind === "terminal") return <Avatar icon="terminal-outline" size={size} color={colors.onSurfaceVariant} background={background} style={style} />;
  let mark: ReactNode;
  if (kind === "claude") {
    const glyph = Math.round(size / 2);
    const unit = glyph / 16;
    const clay = colors.dark ? "#D97757" : "#B8532F";
    const box = ([x, y, w, h]: [number, number, number, number], color: string, i: number) => (
      <View key={i} style={{ position: "absolute", left: x * unit, top: y * unit, width: w * unit, height: h * unit, backgroundColor: color }} />
    );
    mark = (
      <View style={{ width: glyph, height: glyph }} accessibilityLabel="Claude">
        {CLAUDE.map((r, i) => box(r, clay, i))}
        {EYES.map((r, i) => box(r, background, CLAUDE.length + i))}
      </View>
    );
  } else {
    const t = session.terminal;
    const letter = kind === "pi" ? "π" : (t.status?.app || t.argv[0]?.split("/").pop() || "?").charAt(0).toUpperCase();
    mark = <Text style={{ color: colors.primary, fontSize: Math.round(size * (kind === "pi" ? 0.55 : 0.42)), fontWeight: "600", includeFontPadding: false }}>{letter}</Text>;
  }
  return (
    <Avatar color={colors.onSurfaceVariant} background={background} size={size} style={style}>
      {mark}
    </Avatar>
  );
}

/**
 * A session's state at the end of its row, as the desktop's sidebar has it: a
 * turning cookie while it works, a red ! when it needs you, a filled dot when
 * it is done and a ring when it is idle. Plain terminals show nothing.
 */
export function StatusMark({ session, size = 24 }: { session: Session; size?: number }) {
  const colors = useColors();
  const t = session.terminal;
  const state = t.status?.state;
  let mark: ReactNode = null;
  if (state && t.state === "live") {
    if (state === "working") mark = <LoadingIndicator size={Math.round(size * 0.8)} color={colors.working} />;
    else if (state === "blocked" || state === "error") mark = <Avatar icon="alert" size={size} square color={colors.onErrorContainer} background={colors.errorContainer} />;
    else if (state === "done") mark = <Dot color={colors.done} size={10} />;
    else mark = <Dot color={colors.onSurfaceVariant} hollow size={10} />;
  }
  const label = !state ? undefined : state === "blocked" || state === "error" ? "Needs you" : state;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} accessible={!!label} accessibilityLabel={label}>
      {mark}
    </View>
  );
}
