// Bytes for the key bar, written straight to the terminal. Arrows follow the
// program's cursor-key mode (DECCKM), which xterm reports from the page.

export type KeyName =
  | "esc" | "enter" | "tab" | "shift+tab" | "backspace"
  | "up" | "down" | "left" | "right" | "home" | "end" | "pageup" | "pagedown"
  | "ctrl+c" | "ctrl+d" | "ctrl+r" | "ctrl+z" | "ctrl+l";

/**
 * A slot on the key bar. "mode", "ctrl", "keyboard" and "paste" are the bar's
 * own controls; single characters type themselves.
 */
export type BarKey = { key: string; label: string; arrow?: boolean };

/**
 * The key bar's two rows, all slots the same width. Each row ends in three
 * slots that make the arrow cluster: up on the top row with ^C and enter at its
 * sides, left, down and right under it.
 */
export const KEY_ROWS: BarKey[][] = [
  [
    { key: "mode", label: "mode" },
    { key: "ctrl", label: "ctrl" },
    { key: "esc", label: "esc" },
    { key: "tab", label: "tab" },
    { key: "shift+tab", label: "⇧tab" },
    { key: "ctrl+c", label: "^C" },
    { key: "up", label: "↑", arrow: true },
    { key: "enter", label: "⏎" },
  ],
  [
    { key: "keyboard", label: "keyboard" },
    { key: "paste", label: "paste" },
    { key: "1", label: "1" },
    { key: "2", label: "2" },
    { key: "3", label: "3" },
    { key: "left", label: "←", arrow: true },
    { key: "down", label: "↓", arrow: true },
    { key: "right", label: "→", arrow: true },
  ],
];

/** Where the arrow cluster starts in each row. */
export const CLUSTER_START = 5;

const ARROWS: Record<string, string> = { up: "A", down: "B", right: "C", left: "D", home: "H", end: "F" };

export function keyBytes(key: KeyName | string, appCursor: boolean): string {
  if (key in ARROWS) return (appCursor ? "\x1bO" : "\x1b[") + ARROWS[key];
  switch (key) {
    case "esc":
      return "\x1b";
    case "enter":
      return "\r";
    case "tab":
      return "\t";
    case "shift+tab":
      return "\x1b[Z";
    case "backspace":
      return "\x7f";
    case "pageup":
      return "\x1b[5~";
    case "pagedown":
      return "\x1b[6~";
  }
  const ctrl = /^ctrl\+([a-z])$/.exec(key);
  if (ctrl) return String.fromCharCode(ctrl[1].charCodeAt(0) - 96);
  return key; // a printable key, like "1" or "y"
}
