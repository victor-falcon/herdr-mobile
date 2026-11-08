// Material 3 bottom sheets: surfaceContainerLow, corner 28, a 32x4 handle;
// actions as segmented rows (2px apart, round outside, tight inside).
import Ionicons from "@expo/vector-icons/Ionicons";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { IconName } from "./Button";
import { useKeyboardHeight } from "./keyboard";
import { emphasized, makeStyles, shape, space, typography, useColors } from "./theme";

export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: (keyboard || insets.bottom) + space.lg, maxHeight: "85%" }]}>
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
        {children}
      </View>
    </Modal>
  );
}

/** A sheet's title: a rounded-square avatar, the title and a line about it. */
export function SheetHeader({ title, meta, icon, avatar }: { title: string; meta?: string; icon?: IconName; avatar?: ReactNode }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.header}>
      {avatar ??
        (icon ? (
          <View style={styles.headerAvatar}>
            <Ionicons name={icon} size={24} color={colors.onSecondaryContainer} />
          </View>
        ) : null)}
      <View style={styles.flex}>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

type Position = "first" | "middle" | "last" | "only";
const OUTER = shape.largeIncreased;
const INNER = shape.extraSmall;

/** Joins its SheetActions into one segmented list. */
export function SheetActions({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<{ position?: Position }>[];
  return (
    <View style={styles.actions}>
      {items.map((child, i) =>
        cloneElement(child, { position: items.length === 1 ? "only" : i === 0 ? "first" : i === items.length - 1 ? "last" : "middle" }),
      )}
    </View>
  );
}

/** A row of a sheet. Inside SheetActions it joins the segmented list; alone it is a card of its own. */
export function SheetAction({
  label,
  detail,
  icon,
  onPress,
  danger,
  disabled,
  position = "only",
}: {
  label: string;
  detail?: string;
  icon?: IconName;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  position?: Position;
}) {
  const colors = useColors();
  const styles = useStyles();
  const top = position === "first" || position === "only" ? OUTER : INNER;
  const bottom = position === "last" || position === "only" ? OUTER : INNER;
  const ink = danger ? colors.error : colors.onSurface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.action,
        { borderTopLeftRadius: top, borderTopRightRadius: top, borderBottomLeftRadius: bottom, borderBottomRightRadius: bottom },
        position === "only" && styles.alone,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {icon ? <Ionicons name={icon} size={24} color={danger ? colors.error : colors.onSurfaceVariant} /> : null}
      <View style={styles.flex}>
        <Text style={[styles.actionText, { color: ink }]}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  sheet: { backgroundColor: colors.surfaceContainerLow, borderTopLeftRadius: shape.extraLarge, borderTopRightRadius: shape.extraLarge, paddingHorizontal: space.lg },
  handleArea: { alignItems: "center", paddingTop: space.lg, paddingBottom: space.md },
  handle: { width: 32, height: 4, borderRadius: 2, backgroundColor: colors.onSurfaceVariant, opacity: 0.4 },
  header: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingHorizontal: space.sm, paddingTop: space.xs, paddingBottom: space.lg },
  headerAvatar: { width: 48, height: 48, borderRadius: shape.large, backgroundColor: colors.secondaryContainer, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, gap: 2 },
  title: { ...emphasized.titleLarge, color: colors.onSurface },
  meta: { ...typography.bodyMedium, color: colors.onSurfaceVariant },
  actions: { gap: 2 },
  action: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56, backgroundColor: colors.surfaceContainerLowest },
  alone: { marginBottom: 2 },
  pressed: { backgroundColor: colors.surfaceContainerHigh },
  disabled: { opacity: 0.38 },
  actionText: { ...typography.bodyLarge },
  detail: { ...typography.bodyMedium, color: colors.onSurfaceVariant },
}));
