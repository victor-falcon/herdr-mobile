import type { ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardHeight } from "./keyboard";
import { makeStyles, useColors } from "./theme";

export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: (keyboard || insets.bottom) + 12, maxHeight: "85%" }]}>
        <View style={styles.handle} />
        {children}
      </View>
    </Modal>
  );
}

export function SheetAction({ label, detail, onPress, danger, disabled }: { label: string; detail?: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable style={({ pressed }) => [styles.action, pressed && styles.pressed, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled}>
      <Text style={[styles.actionText, danger && { color: colors.blocked }]}>{label}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 8, paddingHorizontal: 8 },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 8 },
  action: { paddingVertical: 14, paddingHorizontal: 14, borderRadius: 10 },
  pressed: { backgroundColor: colors.surfaceHigh },
  actionText: { color: colors.text, fontSize: 16 },
  detail: { color: colors.muted, fontSize: 13, marginTop: 2 },
}));
