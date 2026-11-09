// Bytes for the key bar, written straight to the terminal. Arrows follow the
// program's cursor-key mode (DECCKM), which xterm reports from the page.

export type KeyName =
  | "esc" | "enter" | "shift+enter" | "ctrl+enter" | "tab" | "shift+tab" | "backspace"
  | "up" | "down" | "left" | "right" | "home" | "end" | "pageup" | "pagedown"
  | "ctrl+c" | "ctrl+d" | "ctrl+r" | "ctrl+z" | "ctrl+l";

/**
 * A slot on the key bar. "mode", "ctrl", "keyboard" and "paste" are the bar's
 * own controls; single characters type themselves. `spoken` is what a screen
 * reader says when the label is a symbol it would misread.
 */
export type BarKey = { key: string; label: string; spoken?: string; arrow?: boolean };

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
    { key: "/", label: "/", spoken: "Slash" },
    { key: "ctrl+enter", label: "^⏎", spoken: "Control enter" },
    { key: "shift+enter", label: "⇧⏎", spoken: "Shift enter" },
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
    case "shift+enter":
      // ESC CR, what a terminal set up for coding agents sends for shift+enter:
      // Claude Code and similar prompts insert a new line instead of submitting.
      return "\x1b\r";
    case "ctrl+enter":
      // ctrl+enter has no legacy encoding (xterm sends a plain CR), so this is
      // the CSI u form. Claude Code reads it as "send now": it interrupts the
      // turn and submits what's typed, or the queued messages, instead of
      // queueing behind the turn. hc's own ctrl+enter (CSI 27;5;13~) does too.
      return "\x1b[13;5u";
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
  return key; // a printable key, like "/" or "y"
}

/**
 * The key's name for hc's terminal.keys, used when the page can't write. hc
 * sends shift+enter as CSI 27;2;13~ but alt+enter as ESC CR, the bytes
 * keyBytes sends for shift+enter.
 */
export function hcKeyName(key: string): string {
  return key === "shift+enter" ? "alt+enter" : key;
}
