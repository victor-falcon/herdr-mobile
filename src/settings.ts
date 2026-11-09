import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import type { TerminalMode } from "./terminal/TerminalView";

/** A program the + sheet offers, run in the space's folder. */
export type Agent = { name: string; command: string };

export type Settings = {
  fontSize: number;
  defaultMode: TerminalMode;
  /** How the bottom bar takes input: keys straight to the terminal, or a message hc pastes. */
  inputMode: "direct" | "message";
  /** Folders the project picker lists, as globs under the home folder, e.g. ~/Projects/*. */
  projectDirs: string[];
  /** The agents to offer, in order; the first is the one a new project starts. */
  agents: Agent[];
  /** What the home screen lists: spaces with their tabs, or every agent most urgent first. */
  homeMode: "spaces" | "inbox";
};

const DEFAULTS: Settings = {
  fontSize: 12,
  defaultMode: "fit",
  inputMode: "direct",
  projectDirs: ["~/workspace/*/*"],
  agents: [
    { name: "Pi", command: "pi" },
    { name: "Claude", command: "claude" },
  ],
  homeMode: "spaces",
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
