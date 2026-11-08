import { forwardRef } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { makeStyles, radius, space, useColors } from "./theme";

/** A text input in the app's style; inset when it sits on a surface. Autocorrects; capitalizes only when asked. */
export const TextField = forwardRef<TextInput, TextInputProps & { inset?: boolean; invalid?: boolean }>(function TextField({ inset, invalid, style, ...props }, ref) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <TextInput
      ref={ref}
      autoCapitalize="none"
      autoCorrect
      spellCheck
      placeholderTextColor={colors.muted}
      {...props}
      style={[styles.input, inset && styles.inset, invalid && styles.invalid, style]}
    />
  );
});

const useStyles = makeStyles((colors) => ({
  input: { color: colors.text, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, fontSize: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  inset: { backgroundColor: colors.bg },
  invalid: { borderColor: colors.blocked },
}));
