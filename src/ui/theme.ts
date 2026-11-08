import { useSyncExternalStore } from "react";
import { Appearance, AppState, StyleSheet, useColorScheme, type TextStyle } from "react-native";
import type { Display } from "../hc/connection";
import { systemRoles, type MaterialRoles } from "../../modules/material-colors";

/**
 * The palette. The Material roles keep their Material names (Material's
 * `surface` is `bg` here); the short names before them are the app's older
 * aliases, kept so screens not yet restyled still work.
 */
export type Colors = Omit<MaterialRoles, "surface"> & {
  dark: boolean;
  /** Material's surface: the window behind everything. */
  bg: string;
  /** surfaceContainer. */
  surface: string;
  /** surfaceContainerHighest. */
  surfaceHigh: string;
  /** secondaryContainer. */
  tonal: string;
  /** onSecondaryContainer. */
  onTonal: string;
  /** outlineVariant. */
  border: string;
  /** onSurface. */
  text: string;
  /** onSurfaceVariant. */
  muted: string;
  /** primary. */
  accent: string;
  /** onPrimary. */
  onAccent: string;
  /** An agent at work: amber, not a Material role. */
  working: string;
  workingContainer: string;
  /** An agent that needs you: the error role. */
  blocked: string;
  /** An agent that finished: green, not a Material role. */
  done: string;
  doneContainer: string;
  idle: string;
  app: string;
  appBg: string;
  /** Behind sheets and dialogs. */
  backdrop: string;
};

// Material 3's baseline scheme, for phones without dynamic color.
const BASELINE: { light: MaterialRoles; dark: MaterialRoles } = {
  light: {
    primary: "#6750A4",
    onPrimary: "#FFFFFF",
    primaryContainer: "#EADDFF",
    onPrimaryContainer: "#4F378B",
    surface: "#FEF7FF",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F7F2FA",
    surfaceContainer: "#F3EDF7",
    surfaceContainerHigh: "#ECE6F0",
    surfaceContainerHighest: "#E6E0E9",
    secondaryContainer: "#E8DEF8",
    onSecondaryContainer: "#4A4458",
    outline: "#79747E",
    outlineVariant: "#CAC4D0",
    onSurface: "#1D1B20",
    onSurfaceVariant: "#49454F",
    error: "#B3261E",
    onError: "#FFFFFF",
    errorContainer: "#F9DEDC",
    onErrorContainer: "#8C1D18",
    tertiary: "#7D5260",
    tertiaryContainer: "#FFD8E4",
  },
  dark: {
    primary: "#D0BCFF",
    onPrimary: "#381E72",
    primaryContainer: "#4F378B",
    onPrimaryContainer: "#EADDFF",
    surface: "#141218",
    surfaceContainerLowest: "#0F0D13",
    surfaceContainerLow: "#1D1B20",
    surfaceContainer: "#211F26",
    surfaceContainerHigh: "#2B2930",
    surfaceContainerHighest: "#36343B",
    secondaryContainer: "#4A4458",
    onSecondaryContainer: "#E8DEF8",
    outline: "#938F99",
    outlineVariant: "#49454F",
    onSurface: "#E6E0E9",
    onSurfaceVariant: "#CAC4D0",
    error: "#F2B8B5",
    onError: "#601410",
    errorContainer: "#8C1D18",
    onErrorContainer: "#F9DEDC",
    tertiary: "#EFB8C8",
    tertiaryContainer: "#633B48",
  },
};

// Working and done have no Material role: amber and green, with tints for their containers.
const STATUS = {
  light: { working: "#7A5200", workingContainer: "#FFDEA6", done: "#1A6B32", doneContainer: "#C8F0CF", backdrop: "rgba(0,0,0,0.32)" },
  dark: { working: "#E3B341", workingContainer: "#4A3800", done: "#56D364", doneContainer: "#1B4D27", backdrop: "rgba(0,0,0,0.5)" },
};

function fromRoles({ surface, ...r }: MaterialRoles, dark: boolean): Colors {
  return {
    ...r,
    ...STATUS[dark ? "dark" : "light"],
    dark,
    bg: surface,
    surface: r.surfaceContainer,
    surfaceHigh: r.surfaceContainerHighest,
    tonal: r.secondaryContainer,
    onTonal: r.onSecondaryContainer,
    border: r.outlineVariant,
    text: r.onSurface,
    muted: r.onSurfaceVariant,
    accent: r.primary,
    onAccent: r.onPrimary,
    blocked: r.error,
    idle: r.onSurfaceVariant,
    app: r.tertiary,
    appBg: r.tertiaryContainer,
  };
}

let palettes = build();
const listeners = new Set<() => void>();

function build() {
  const system = systemRoles();
  // An older Android or app build may lack some roles: the baseline fills them in.
  const roles = system ? { light: { ...BASELINE.light, ...system.light }, dark: { ...BASELINE.dark, ...system.dark } } : BASELINE;
  return { light: fromRoles(roles.light, false), dark: fromRoles(roles.dark, true), key: JSON.stringify(roles) };
}

// A new wallpaper changes the system colors while the app is in the background: read them again on return.
AppState.addEventListener("change", (state) => {
  if (state !== "active") return;
  const next = build();
  if (next.key === palettes.key) return;
  palettes = next;
  listeners.forEach((l) => l());
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The palette for the phone's current light or dark setting; components re-render when it changes. */
export function useColors(): Colors {
  const scheme = useColorScheme();
  const current = useSyncExternalStore(subscribe, () => palettes);
  return scheme === "light" ? current.light : current.dark;
}

/** The palette outside a component, for the phone's light or dark setting right now. */
export function currentColors(): Colors {
  return Appearance.getColorScheme() === "light" ? palettes.light : palettes.dark;
}

/** The terminal's colors as herdr-core wants them, so programs that ask see the phone's light or dark. */
export function terminalDisplay(colors: Colors): Display {
  return { fg: colors.text, bg: colors.bg, cursor: colors.text };
}

/** Styles built from the palette: call the returned hook in a component to get them for the current scheme. */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(build: (colors: Colors) => T): () => T {
  const cache = new WeakMap<Colors, T>();
  return function useStyles() {
    const colors = useColors();
    let styles = cache.get(colors);
    if (!styles) {
      styles = StyleSheet.create(build(colors));
      cache.set(colors, styles);
    }
    return styles;
  };
}

export const fonts = {
  /** Roboto Flex for headlines and emphasized large titles. */
  brand: "RobotoFlex-Medium",
  mono: "RobotoMono-Regular",
  monoMedium: "RobotoMono-Medium",
  monoBold: "RobotoMono-Bold",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Material 3 Expressive's corner scale. */
export const shape = { none: 0, extraSmall: 4, small: 8, medium: 12, large: 16, largeIncreased: 20, extraLarge: 28, full: 999 } as const;

/** The app's older corner names; new code uses `shape`. */
export const radius = { sm: 6, md: 10, lg: 16, full: 999 } as const;

type Type = Pick<TextStyle, "fontSize" | "lineHeight" | "letterSpacing" | "fontWeight" | "fontFamily">;

/** Material 3's type scale, as Zancada uses it. Spread one into a Text style. */
export const typography = {
  headlineMedium: { fontSize: 28, lineHeight: 36, letterSpacing: 0, fontWeight: "400" },
  titleLarge: { fontSize: 22, lineHeight: 28, letterSpacing: 0, fontWeight: "400" },
  titleMedium: { fontSize: 16, lineHeight: 24, letterSpacing: 0.15, fontWeight: "500" },
  titleSmall: { fontSize: 14, lineHeight: 20, letterSpacing: 0.1, fontWeight: "500" },
  bodyLarge: { fontSize: 16, lineHeight: 24, letterSpacing: 0.5, fontWeight: "400" },
  bodyMedium: { fontSize: 14, lineHeight: 20, letterSpacing: 0.25, fontWeight: "400" },
  bodySmall: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4, fontWeight: "400" },
  labelLarge: { fontSize: 14, lineHeight: 20, letterSpacing: 0.1, fontWeight: "500" },
  labelMedium: { fontSize: 12, lineHeight: 16, letterSpacing: 0.5, fontWeight: "500" },
} satisfies Record<string, Type>;

/**
 * The emphasized scale: heavier, and Roboto Flex for headlines and large titles.
 * A bundled font's weight comes from its family (RobotoFlex-Medium is 500), so
 * those keep fontWeight normal.
 */
export const emphasized = {
  headlineMedium: { ...typography.headlineMedium, fontFamily: fonts.brand, fontWeight: "normal" },
  titleLarge: { ...typography.titleLarge, fontFamily: fonts.brand, fontWeight: "normal" },
  titleMedium: { ...typography.titleMedium, fontWeight: "700" },
  titleSmall: { ...typography.titleSmall, fontWeight: "700" },
  bodyLarge: { ...typography.bodyLarge, fontWeight: "500" },
  bodyMedium: { ...typography.bodyMedium, fontWeight: "500" },
  bodySmall: { ...typography.bodySmall, fontWeight: "500" },
  labelLarge: { ...typography.labelLarge, fontWeight: "700" },
  labelMedium: { ...typography.labelMedium, fontWeight: "700" },
} satisfies Record<keyof typeof typography, Type>;
