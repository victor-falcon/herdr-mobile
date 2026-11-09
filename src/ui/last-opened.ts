import { useSyncExternalStore } from "react";

// The session opened last, which the lists mark like the desktop marks its active tab.
let last: string | null = null;
const listeners = new Set<() => void>();

export function setLastOpened(key: string) {
  if (key === last) return;
  last = key;
  listeners.forEach((l) => l());
}

export function useLastOpened(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => last,
  );
}
