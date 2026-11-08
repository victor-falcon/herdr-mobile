import { Text, type StyleProp, type TextStyle } from "react-native";
import { makeStyles, shape, typography } from "./theme";

/** A small pill label, like "factory" or "open" next to a name. */
export function Chip({ label, style }: { label: string; style?: StyleProp<TextStyle> }) {
  const styles = useStyles();
  return <Text style={[styles.chip, style]}>{label}</Text>;
}

const useStyles = makeStyles((colors) => ({
  chip: {
    ...typography.labelMedium,
    color: colors.onSecondaryContainer,
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: shape.full,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
}));
