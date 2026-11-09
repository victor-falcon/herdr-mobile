// Material 3 top app bars. Screens that use one hide the Stack header with
// <Stack.Screen options={{ headerShown: false }} />.
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton } from "./IconButton";
import { emphasized, makeStyles, space, typography } from "./theme";

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/** The large top app bar: a 64px row for back and actions, then the headline (28/36) under it. */
export function LargeTopAppBar({
  title,
  back,
  onBack = goBack,
  actions,
  style,
}: {
  title: string;
  /** Shows a back button. */
  back?: boolean;
  onBack?: () => void;
  /** Icon buttons on the right of the top row. */
  actions?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top }, style]}>
      <View style={styles.row}>
        {back ? <IconButton icon="arrow-back" label="Back" onPress={onBack} /> : null}
        <View style={styles.flex} />
        {actions}
      </View>
      <Text style={styles.headline} accessibilityRole="header" numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

/** The small top app bar: back, a title with an optional line under it, and actions, in one 64px row. */
export function TopAppBar({
  title,
  subtitle,
  lead,
  back = true,
  onBack = goBack,
  actions,
  style,
  titleStyle,
}: {
  title: string;
  subtitle?: string;
  /** Before the title, such as the agent's avatar. */
  lead?: ReactNode;
  back?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Adjusts the title, e.g. a smaller size for a long one. */
  titleStyle?: StyleProp<TextStyle>;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top }, style]}>
      <View style={[styles.row, styles.small]}>
        {back ? <IconButton icon="arrow-back" label="Back" onPress={onBack} /> : null}
        {lead ? <View style={[styles.lead, !back && styles.noBack]}>{lead}</View> : null}
        <View style={[styles.flex, !back && !lead && styles.noBack]}>
          <Text style={[styles.title, titleStyle]} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {actions}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  bar: { backgroundColor: colors.bg },
  row: { height: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: space.xs },
  small: { gap: space.xs },
  flex: { flex: 1, minWidth: 0 },
  noBack: { paddingLeft: space.md },
  lead: { paddingRight: space.sm },
  headline: { ...emphasized.headlineMedium, color: colors.onSurface, paddingHorizontal: space.xl, paddingBottom: space.lg },
  title: { ...emphasized.titleLarge, color: colors.onSurface },
  subtitle: { ...typography.labelMedium, color: colors.onSurfaceVariant },
}));
