import { expect, test } from "vitest";
import { KEY_ROWS, hcKeyName, keyBytes } from "../src/terminal/keys";

test("shift+enter sends ESC CR, so agent prompts insert a new line", () => {
  expect(keyBytes("shift+enter", false)).toBe("\x1b\r");
  expect(keyBytes("enter", false)).toBe("\r");
});

test("ctrl+enter sends CSI 13;5u, which Claude Code takes as send now", () => {
  expect(keyBytes("ctrl+enter", false)).toBe("\x1b[13;5u");
  expect(hcKeyName("ctrl+enter")).toBe("ctrl+enter");
});

test("hc gets shift+enter as alt+enter, its name for ESC CR", () => {
  expect(hcKeyName("shift+enter")).toBe("alt+enter");
  expect(hcKeyName("shift+tab")).toBe("shift+tab");
});

test("the key bar has shift+enter and ctrl+enter keys", () => {
  const keys = KEY_ROWS.flat().map((k) => k.key);
  expect(keys).toContain("shift+enter");
  expect(keys).toContain("ctrl+enter");
});
