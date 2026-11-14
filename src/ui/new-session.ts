import { fleet } from "../fleet-store";
import type { Target } from "../hc/fleet";
import { newId } from "../herdr-app";
import { getSettings } from "../settings";
import type { Space } from "../spaces";
import { lastFitSize } from "../terminal/fit";
import { currentColors, terminalDisplay } from "./theme";

/**
 * Once the core lists the new terminal: give it the phone's fit size, so its
 * program draws for the screen from the start.
 */
async function prepare(key: string) {
  const fitSize = getSettings().defaultMode === "fit" ? lastFitSize() : null;
  if (!fitSize) return;
  const start = Date.now();
  let route = fleet.route(key);
  while (!route && Date.now() - start < 2000) {
    await new Promise((r) => setTimeout(r, 50));
    route = fleet.route(key);
  }
  if (!route) return;
  const stream = await route.conn.attach(
    { terminal: route.address, cols: fitSize.cols, rows: fitSize.rows, history: 0, display: terminalDisplay(currentColors()) },
    { onData: () => {}, onClose: () => {} },
  );
  stream.resize(fitSize.cols, fitSize.rows);
  stream.close();
}

/** Start the machine's shell in the space: in `tabId`, as a new pane there, or in a new tab. */
export async function startTerminal(space: Pick<Space, "target" | "id" | "folder">, tabId?: string): Promise<string> {
  const key = await fleet.run(space.target, {
    cwd: space.folder || undefined,
    display: terminalDisplay(currentColors()),
    labels: { "herdr.space": space.id, "herdr.tab": tabId ?? newId("tb") },
  });
  await prepare(key);
  return key;
}

/** The machine's home folder. */
async function homeOf(target: Target): Promise<string | undefined> {
  const out = await fleet.exec(target, ["sh", "-c", 'printf %s "$HOME"']).catch(() => null);
  const home = out?.stdout.trim();
  return home && home.startsWith("/") ? home : undefined;
}

/** A new space on the machine with a shell in its home folder, as the desktop's new space; the desktop names it after that folder. */
export async function startSpace(target: Target): Promise<string> {
  return startTerminal({ target, id: newId("sp"), folder: (await homeOf(target)) ?? "" });
}
