import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import type { TerminalMode } from "./terminal/TerminalView";

/** What the home screen lists: spaces with their tabs, or every agent most urgent first. */
export type HomeMode = "spaces" | "inbox";

export type Settings = {
  fontSize: number;
  defaultMode: TerminalMode;
  /** How the bottom bar takes input: keys straight to the terminal, or a message hc pastes. */
  inputMode: "direct" | "message";
  homeMode: HomeMode;
  /** Spaces folded to one line on the Spaces list, by space key. */
  collapsed: string[];
};

const DEFAULTS: Settings = {
  fontSize: 12,
  defaultMode: "fit",
  inputMode: "direct",
  homeMode: "spaces",
  collapsed: [],
};
const KEY = "settings.v1";

let current: Settings = DEFAULTS;
const listeners = new Set<() => void>();

export async function loadSettings() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) current = { ...DEFAULTS, ...JSON.parse(raw) };
  listeners.forEach((l) => l());
}

export function getSettings(): Settings {
  return current;
}

export async function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  listeners.forEach((l) => l());
  await AsyncStorage.setItem(KEY, JSON.stringify(current));
}

export function onSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): Settings {
  return useSyncExternalStore(onSettings, getSettings);
}
