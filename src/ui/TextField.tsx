// Material 3's filled text field: surfaceContainerHigh, rounded on top, a 1px
// indicator below that turns 2px primary while focused, and an optional label
// that floats above the text once there is some (or while typing).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Animated, Pressable, TextInput, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { makeStyles, shape, typography, useColors } from "./theme";

type Props = Omit<TextInputProps, "style"> & {
  /** A floating label; without one the field shows only its placeholder. */
  label?: string;
  /** Places the field (margins, width, flex). */
  style?: StyleProp<ViewStyle>;
  /** Styles the text itself, e.g. Roboto Mono for commands and paths. */
  inputStyle?: StyleProp<TextStyle>;
  /** Kept for screens written before the filled field; it looks the same on any surface. */
  inset?: boolean;
  invalid?: boolean;
};

/** A text input in the app's style. Autocorrects; capitalizes only when asked. */
export const TextField = forwardRef<TextInput, Props>(function TextField({ label, style, inputStyle, inset: _inset, invalid, onFocus, onBlur, onChangeText, placeholder, ...props }, ref) {
  const colors = useColors();
  const styles = useStyles();
  // The whole field focuses the input, not just the line of text in it.
  const input = useRef<TextInput>(null);
  useImperativeHandle(ref, () => input.current as TextInput);
  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState(!!props.defaultValue);
  const filled = props.value !== undefined ? props.value !== "" : typed;
  const up = focused || filled;

  // 0: the label sits where the text goes; 1: it has floated above it.
  const float = useRef(new Animated.Value(up ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(float, { toValue: up ? 1 : 0, duration: 150, useNativeDriver: false }).start();
  }, [up, float]);

  const indicator = invalid ? colors.error : focused ? colors.primary : colors.onSurfaceVariant;
  const labelColor = invalid ? colors.error : focused ? colors.primary : colors.onSurfaceVariant;
  return (
    <Pressable
      accessible={false}
      onPress={() => input.current?.focus()}
      disabled={props.editable === false}
      style={[styles.field, { borderBottomColor: indicator, borderBottomWidth: focused || invalid ? 2 : 1 }, label ? styles.labelled : null, style]}
    >
      {label ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.labelBox, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}
        >
          <Animated.Text
            numberOfLines={1}
            style={[styles.label, { color: labelColor, fontSize: float.interpolate({ inputRange: [0, 1], outputRange: [16, 12] }), lineHeight: float.interpolate({ inputRange: [0, 1], outputRange: [24, 16] }) }]}
          >
            {label}
          </Animated.Text>
        </Animated.View>
      ) : null}
      <TextInput
        ref={input}
        autoCapitalize="none"
        autoCorrect
        spellCheck
        placeholderTextColor={colors.onSurfaceVariant}
        cursorColor={colors.primary}
        selectionColor={colors.primary}
        placeholder={label && !up ? undefined : placeholder}
        {...props}
        onChangeText={(text) => {
          setTyped(text !== "");
          onChangeText?.(text);
        }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, inputStyle]}
      />
    </Pressable>
  );
});

const useStyles = makeStyles((colors) => ({
  field: {
    backgroundColor: colors.surfaceContainerHigh,
    borderTopLeftRadius: shape.medium,
    borderTopRightRadius: shape.medium,
    borderBottomLeftRadius: shape.extraSmall,
    borderBottomRightRadius: shape.extraSmall,
    minHeight: 56,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  labelled: { paddingTop: 22, paddingBottom: 4 },
  labelBox: { position: "absolute", left: 16, right: 16, top: 6 },
  label: { ...typography.bodySmall },
  input: { ...typography.bodyLarge, letterSpacing: 0, color: colors.onSurface, padding: 0, paddingVertical: 4 },
}));
