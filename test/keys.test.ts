import { expect, test } from "vitest";
import { KEY_ROWS, hcKeyName, keyBytes } from "../src/terminal/keys";

test("shift+enter sends ESC CR, so agent prompts insert a new line", () => {
  expect(keyBytes("shift+enter", false)).toBe("\x1b\r");
  expect(keyBytes("enter", false)).toBe("\r");
});

test("hc gets shift+enter as alt+enter, its name for ESC CR", () => {
  expect(hcKeyName("shift+enter")).toBe("alt+enter");
  expect(hcKeyName("shift+tab")).toBe("shift+tab");
});

test("the key bar has a shift+enter key", () => {
  expect(KEY_ROWS.flat().map((k) => k.key)).toContain("shift+enter");
});
