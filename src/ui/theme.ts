import { useSyncExternalStore } from "react";
import { Appearance, AppState, Platform, StyleSheet, useColorScheme } from "react-native";
import type { Display } from "../hc/connection";
import { systemRoles, type MaterialRoles } from "../../modules/material-colors";

export type Colors = {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceHigh: string;
  tonal: string;
  onTonal: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
  working: string;
  blocked: string;
  done: string;
  idle: string;
  error: string;
  app: string;
  appBg: string;
  backdrop: string;
};

// Material 3's baseline scheme, for phones without dynamic color.
const BASELINE: { light: MaterialRoles; dark: MaterialRoles } = {
  light: {
    primary: "#6750A4",
    onPrimary: "#FFFFFF",
    surface: "#FEF7FF",
    surfaceContainer: "#F3EDF7",
    surfaceContainerHighest: "#E6E0E9",
    secondaryContainer: "#E8DEF8",
    onSecondaryContainer: "#4A4458",
    outlineVariant: "#CAC4D0",
    onSurface: "#1D1B20",
    onSurfaceVariant: "#49454F",
    error: "#B3261E",
    tertiary: "#7D5260",
    tertiaryContainer: "#FFD8E4",
  },
  dark: {
    primary: "#D0BCFF",
    onPrimary: "#381E72",
    surface: "#141218",
    surfaceContainer: "#211F26",
    surfaceContainerHighest: "#36343B",
    secondaryContainer: "#4A4458",
    onSecondaryContainer: "#E8DEF8",
    outlineVariant: "#49454F",
    onSurface: "#E6E0E9",
    onSurfaceVariant: "#CAC4D0",
    error: "#F2B8B5",
    tertiary: "#EFB8C8",
    tertiaryContainer: "#633B48",
  },
};

/** The app's names for Material roles. Working and done have no role, so they stay amber and green. */
function fromRoles(r: MaterialRoles, dark: boolean): Colors {
  return {
    dark,
    bg: r.surface,
    surface: r.surfaceContainer,
    surfaceHigh: r.surfaceContainerHighest,
    tonal: r.secondaryContainer,
    onTonal: r.onSecondaryContainer,
    border: r.outlineVariant,
    text: r.onSurface,
    muted: r.onSurfaceVariant,
    accent: r.primary,
    onAccent: r.onPrimary,
    working: dark ? "#E3B341" : "#9A6700",
    blocked: r.error,
    done: dark ? "#56D364" : "#1A7F37",
    idle: r.onSurfaceVariant,
    error: r.error,
    app: r.tertiary,
    appBg: r.tertiaryContainer,
    backdrop: "rgba(0,0,0,0.4)",
  };
}

let palettes = build();
const listeners = new Set<() => void>();

function build() {
  const system = systemRoles();
  // An app build older than this code may lack newer roles: the baseline fills them in.
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
  mono: Platform.select({ ios: "Menlo", default: "monospace" }),
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const radius = { sm: 6, md: 10, lg: 16, full: 999 } as const;
