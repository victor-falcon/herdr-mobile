import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseProjectDirs, projectProbe } from "../src/project-dirs";

function run(home: string, dirs: string[]): string[] {
  const out = execFileSync("sh", ["-c", projectProbe(dirs)], { env: { ...process.env, HOME: home }, encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

describe("projectProbe", () => {
  const home = mkdtempSync(join(tmpdir(), "probe-"));
  for (const d of ["workspace/me/a", "Projects/b", "Projects/c", "Code/d"]) mkdirSync(join(home, d), { recursive: true });

  it("lists the folders matching every pattern", () => {
    expect(run(home, ["~/Projects/*", "~/Code/*"])).toEqual([`${home}/Projects/b`, `${home}/Projects/c`, `${home}/Code/d`]);
    expect(run(home, ["~/workspace/*/*"])).toEqual([`${home}/workspace/me/a`]);
  });

  it("skips patterns that match nothing", () => {
    expect(run(home, ["~/Nope/*", "~/Code/*"])).toEqual([`${home}/Code/d`]);
  });

  it("ignores patterns that could reach the shell", () => {
    expect(projectProbe(["~/x; rm -rf /", "/etc/*", "~/$(id)"])).toBe("true");
  });
});

describe("parseProjectDirs", () => {
  it("splits on commas, spaces and new lines", () => {
    expect(parseProjectDirs(" ~/Projects/*,~/Code/*\n~/w/*/* ")).toEqual(["~/Projects/*", "~/Code/*", "~/w/*/*"]);
  });
});
