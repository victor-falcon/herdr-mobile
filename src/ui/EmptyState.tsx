import type { ReactNode } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { IconName } from "./icons";
import { ShapeBadge } from "./Shapes";
import { emphasized, makeStyles, typography } from "./theme";

/** A cookie badge, a headline, a line of help and an action, centered. */
export function EmptyState({ icon, title, text, action, style }: { icon: IconName; title: string; text?: string; action?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View style={[styles.root, style]}>
      <ShapeBadge icon={icon} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {text ? <Text style={styles.text}>{text}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 28, paddingHorizontal: 32 },
  copy: { alignItems: "center", gap: 12 },
  title: { ...emphasized.headlineMedium, color: colors.onSurface, textAlign: "center" },
  text: { ...typography.bodyLarge, color: colors.onSurfaceVariant, textAlign: "center" },
}));
