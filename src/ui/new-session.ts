import { useEffect, useState } from "react";
import { fleet } from "../fleet-store";
import { utf8Encode } from "../hc/bytes";
import type { Target } from "../hc/fleet";
import { newId } from "../herdr-app";
import { projectProbe } from "../project-dirs";
import { getSettings } from "../settings";
import { currentColors, terminalDisplay } from "./theme";
import type { Space } from "../spaces";
import { lastFitSize } from "../terminal/fit";

/** A command as argv: split on spaces, no quoting. */
export function commandArgv(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}

/** The program a command runs, as the install check looks for it. */
export function programOf(command: string): string {
  return commandArgv(command)[0] ?? "";
}

/** The command a new project starts with: the first agent, or a plain shell when there is none. */
export function defaultAgentCommand(): string | null {
  return getSettings().agents[0]?.command ?? null;
}

export const SPACE_TABS: string[][] = [["nvim-server"], ["deltoids"], ["gob", "tui"]];

// Only plain program names or paths, so a setting can't break out of the probe.
const SAFE_PROGRAM = /^[A-Za-z0-9._\-/~+]+$/;

/**
 * How a machine runs a program: straight from the PATH, or only through the
 * user's shell (an alias such as `clc`, or a PATH set in their shell's rc files).
 */
export type Found = "path" | "shell";

function agentProbe(programs: string[]): string {
  const safe = [...new Set(programs)].filter((p) => SAFE_PROGRAM.test(p));
  if (safe.length === 0) return "true";
  return [
    `missing=`,
    `for c in ${safe.join(" ")}; do if command -v "$c" >/dev/null 2>&1; then echo "path $c"; else missing="$missing $c"; fi; done`,
    // The user's login, interactive shell sees aliases and rc-file PATHs. Its prompt hooks
    // run first: zsh setups often load aliases and functions only at the first prompt.
    `[ -n "$missing" ] && "\${SHELL:-sh}" -lic '`,
    `if [ -n "\${ZSH_VERSION:-}" ]; then for f in $precmd_functions; do "$f"; done; elif [ -n "\${BASH_VERSION:-}" ]; then eval "\${PROMPT_COMMAND:-}"; fi >/dev/null 2>&1 </dev/null`,
    `for c in "$@"; do command -v "$c" >/dev/null 2>&1 && echo "shell $c"; done' sh $missing </dev/null 2>/dev/null`,
    `true`,
  ].join("\n");
}

/** Which of these programs a machine has, and how it reaches them. */
export async function findPrograms(target: Target, programs: string[]): Promise<Map<string, Found>> {
  const out = await fleet.exec(target, ["sh", "-c", agentProbe(programs)]);
  const found = new Map<string, Found>();
  // An rc file can print anything; keep only the probe's own lines.
  for (const line of out.stdout.split("\n")) {
    const m = /^(path|shell) (\S+)$/.exec(line.trim());
    if (m && programs.includes(m[2]) && !found.has(m[2])) found.set(m[2], m[1] as Found);
  }
  return found;
}

/** Which of these programs the machine has; null while it looks. */
export function useInstalledPrograms(target: Target | undefined, programs: string[]): Map<string, Found> | null {
  const [found, setFound] = useState<Map<string, Found> | null>(null);
  const list = programs.join(" ");
  useEffect(() => {
    setFound(null);
    if (!target) return;
    let cancelled = false;
    findPrograms(target, programs).then(
      (f) => !cancelled && setFound(f),
      () => !cancelled && setFound(new Map()),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.coreId, list]);
  return found;
}

export type Project = { target: Target; owner: string; repo: string; folder: string };

export function useProjects(targets: Target[], active: boolean): { projects: Project[]; loading: boolean } {
  const [byCore, setByCore] = useState<Record<string, Project[]>>({});
  const [pending, setPending] = useState(0);
  const ids = targets.map((t) => t.coreId).join(",");
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setPending(targets.length);
    const probe = projectProbe(getSettings().projectDirs);
    for (const target of targets) {
      fleet
        .exec(target, ["sh", "-c", probe])
        .then((out) =>
          [...new Set(out.stdout.split("\n").filter(Boolean))].map((folder) => {
            const parts = folder.split("/");
            return { target, owner: parts[parts.length - 2] ?? "", repo: parts[parts.length - 1], folder };
          }),
        )
        .catch(() => [] as Project[])
        .then((list) => {
          if (cancelled) return;
          setByCore((m) => ({ ...m, [target.coreId]: list }));
          setPending((n) => n - 1);
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, active]);
  const projects = targets.flatMap((t) => byCore[t.coreId] ?? []);
  return { projects, loading: pending > 0 && projects.length === 0 };
}

/**
 * Once the core lists the new terminal: give it the phone's fit size, so its
 * program draws for the screen from the start, and type `typed` into it.
 */
async function prepare(key: string, typed: string | null) {
  const fitSize = getSettings().defaultMode === "fit" ? lastFitSize() : null;
  if (!fitSize && !typed) return;
  const start = Date.now();
  let route = fleet.route(key);
  while (!route && Date.now() - start < 2000) {
    await new Promise((r) => setTimeout(r, 50));
    route = fleet.route(key);
  }
  if (!route) {
    if (typed) throw new Error("The new terminal did not show up");
    return;
  }
  const size = fitSize ?? { cols: route.session.terminal.cols, rows: route.session.terminal.rows };
  const stream = await route.conn.attach(
    { terminal: route.address, cols: size.cols, rows: size.rows, history: 0, display: terminalDisplay(currentColors()) },
    { onData: () => {}, onClose: () => {} },
  );
  if (fitSize) stream.resize(fitSize.cols, fitSize.rows);
  if (typed) stream.write(utf8Encode(typed));
  stream.close();
}

/**
 * Start a command in a new tab of the space; with no command, the machine's own shell.
 * `found` is how the machine reaches its program; without it, this looks first.
 * A command only the user's shell knows (an alias, or a function zsh loads at its
 * first prompt) is typed into that shell, as the desktop does, which stays after it ends.
 */
export async function startAgent(space: Pick<Space, "target" | "id" | "folder">, command: string | null, found?: Found): Promise<string> {
  if (command && !found) {
    const program = programOf(command);
    found = await findPrograms(space.target, [program]).then((f) => f.get(program), () => undefined);
  }
  const viaShell = !!command && found === "shell";
  const key = await fleet.run(space.target, {
    argv: command && !viaShell ? commandArgv(command) : undefined,
    cwd: space.folder,
    display: terminalDisplay(currentColors()),
    labels: { "herdr.space": space.id, "herdr.tab": newId("tb") },
  });
  // A leading space keeps it out of the shell's history.
  await prepare(key, viaShell ? ` ${command!.trim()}\r` : null);
  return key;
}

function placed(key: string, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const s = fleet.snapshot().sessions.find((x) => x.key === key);
      if (s?.terminal.labels?.where) return resolve(true);
      if (Date.now() - start > ms) return resolve(false);
      setTimeout(tick, 100);
    };
    tick();
  });
}

export async function startSpace(target: Target, folder: string): Promise<string> {
  const id = newId("sp");
  const space = { target, id, folder };
  let desktop = true;
  const settle = async (key: string) => {
    if (desktop) desktop = await placed(key, 3000);
    return key;
  };
  const tab = (argv: string[]) =>
    fleet
      .run(target, { argv, cwd: folder, keep: true, display: terminalDisplay(currentColors()), labels: { "herdr.space": id, "herdr.tab": newId("tb") } })
      .then(settle)
      .catch(() => null);
  const [first, ...rest] = SPACE_TABS;
  await tab(first);
  const pi = await startAgent(space, defaultAgentCommand()).then(settle);
  for (const argv of rest.reverse()) await tab(argv);
  return pi;
}

export function spaceFor(project: Project, spaces: Space[]): Space | undefined {
  return spaces.find(
    (s) => s.target.coreId === project.target.coreId && !!s.folder && (s.folder === project.folder || s.folder.startsWith(project.folder + "/")),
  );
}
