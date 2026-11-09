// Two scratch cores on this box: A has added B as a machine (like a laptop
// that added a server). The phone must show B's terminals once, from either route.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { utf8Decode } from "../src/hc/bytes";
import { Fleet, type MachineConfig } from "../src/hc/fleet";
import { spaces } from "../src/spaces";
import { hcProcessTransport } from "./node-transport";

const scratch = mkdtempSync(join(tmpdir(), "hm-fleet-"));
const base = {
  XDG_STATE_HOME: join(scratch, "state"),
  XDG_RUNTIME_DIR: join(scratch, "run"),
  XDG_CONFIG_HOME: join(scratch, "config"),
};
const envFor = (session: string) => ({ ...process.env, ...base, HC_SESSION: session });
const hc = (session: string, ...args: string[]) => execFileSync("hc", args, { env: envFor(session), encoding: "utf8" });

const A: MachineConfig = { id: "a", name: "a", host: "hma", port: 22, user: "me" };
const B: MachineConfig = { id: "b", name: "b", host: "hmb", port: 22, user: "me" };
const open = async (c: MachineConfig) => hcProcessTransport({ ...base, HC_SESSION: c.host });
const fleets: Fleet[] = [];

function until<T>(check: () => T | undefined | false, ms = 15_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const v = check();
      if (v) return resolve(v);
      if (Date.now() - start > ms) return reject(new Error("timed out"));
      setTimeout(tick, 50);
    };
    tick();
  });
}

let bAddress: string;

const AGENT = ["sh", "-c", "printf '\\033]7501;state=idle:app=test\\033\\\\'; exec cat"];

beforeAll(() => {
  mkdirSync(base.XDG_RUNTIME_DIR, { recursive: true });
  hc("hmb", "server", "start");
  hc("hma", "machine", "add", "--name", "b", "--session", "hmb", "--via", "sh -c");
  const run = JSON.parse(hc("hmb", "run", "--bg", "--json", "--name", "worker", "--", ...AGENT));
  bAddress = run.terminal?.address ?? run.address;
}, 30_000);

afterAll(() => {
  for (const f of fleets) f.stop();
  for (const s of ["hma", "hmb"]) {
    try {
      hc(s, "server", "stop");
    } catch {}
  }
  rmSync(scratch, { recursive: true, force: true });
});

test("a machine reached only through another shows its terminals", async () => {
  const fleet = new Fleet(open);
  fleets.push(fleet);
  fleet.setMachines([A]);
  const s = await until(() => fleet.snapshot().sessions.find((x) => x.terminal.name === "worker"));
  expect(s.address).toBe(`b/${bAddress}`);

  let screen = "";
  const route = fleet.route(s.key)!;
  const stream = await route.conn.attach(
    { terminal: route.address, cols: 80, rows: 24 },
    { onData: (b) => (screen += utf8Decode(b)), onClose: () => {} },
  );
  await route.conn.call("terminal.send", { terminal: route.address, text: "via-a" });
  await until(() => screen.includes("via-a"));
  stream.close();
}, 30_000);

test("a terminal reached two ways is listed once, by its direct route", async () => {
  const fleet = new Fleet(open);
  fleets.push(fleet);
  fleet.setMachines([A, B]);
  await until(() => fleet.snapshot().links.every((l) => l.state === "connected"));
  await until(() => fleet.snapshot().sessions.some((x) => x.terminal.name === "worker"));
  // Let A's relayed copy arrive too before counting.
  await until(() => fleet.snapshot().links.find((l) => l.config.id === "a")!.machines.length > 0);

  const workers = fleet.snapshot().sessions.filter((x) => x.terminal.name === "worker");
  expect(workers).toHaveLength(1);
  expect(workers[0].linkId).toBe("b");
  expect(workers[0].address).toBe(bAddress);

}, 30_000);

test("starts sessions anywhere it reaches, nests children, and keeps finished ones", async () => {
  const fleet = new Fleet(open);
  fleets.push(fleet);
  fleet.setMachines([A]);
  await until(() => fleet.snapshot().links[0].state === "connected" && fleet.targets().length === 2 && fleet.targets());

  const b = fleet.targets().find((x) => x.on === "b")!;
  expect(b).toBeTruthy();
  const out = await fleet.exec(b, ["sh", "-c", "echo $HC_SESSION"]);
  expect(out.stdout.trim()).toBe("hmb");

  const key = await fleet.run(b, { argv: ["cat"], name: "started-from-phone", cwd: "/tmp" });
  const s = await until(() => fleet.snapshot().sessions.find((x) => x.key === key));
  expect(s.terminal.name).toBe("started-from-phone");
  expect(s.terminal.cwd).toBe("/tmp");

  const route = fleet.route(key)!;
  const child = await route.conn.call("terminal.run", { argv: ["cat"], on: "b", parent: s.address.split("/")[1] });
  const childLocal = child.address.split("/").pop();
  const c = await until(() => fleet.snapshot().sessions.find((x) => x.key.endsWith(":" + childLocal)));
  expect(c.parentKey).toBe(key);

  await route.conn.call("terminal.kill", { terminal: route.address });
  const done = await until(() => fleet.snapshot().sessions.find((x) => x.key === key && x.terminal.state === "finished"));
  expect(done).toBeTruthy();

  // A fresh connection still shows it until it is removed.
  const again = new Fleet(open);
  fleets.push(again);
  again.setMachines([A]);
  await until(() => again.snapshot().sessions.find((x) => x.key === key && x.terminal.state === "finished"));
  await again.route(key)!.conn.call("terminal.rm", { terminal: again.route(key)!.address });
  await until(() => !again.snapshot().sessions.some((x) => x.key === key));
}, 40_000);

test("a line that went silent while the phone slept is noticed and replaced", async () => {
  let blackHole = false;
  let opened = 0;
  const flaky = async (c: MachineConfig) => {
    opened++;
    const real = hcProcessTransport({ ...base, HC_SESSION: c.host });
    // Once the network "goes away", nothing gets through, and nothing closes.
    return {
      send: (b: Uint8Array) => !blackHole && real.send(b),
      close: () => real.close(),
      listen: (onData: (b: Uint8Array) => void, onClose: (r: string | null) => void) =>
        real.listen((b) => !blackHole && onData(b), onClose),
    };
  };
  const fleet = new Fleet(flaky);
  fleets.push(fleet);
  fleet.setMachines([B]);
  await until(() => fleet.snapshot().links[0].state === "connected");
  expect(opened).toBe(1);

  blackHole = true;
  fleet.probe();
  await until(() => fleet.snapshot().links[0].state !== "connected", 8000);
  blackHole = false;
  await until(() => fleet.snapshot().links[0].state === "connected", 8000);
  expect(opened).toBe(2);
}, 30_000);

test("spaces come from each machine's Herdr layout and from labels, with sub-agents under their parent", async () => {
  const fleet = new Fleet(open);
  fleets.push(fleet);
  fleet.setMachines([A]);
  const b = await until(() => fleet.targets().find((x) => x.on === "b"));
  const conn = (fleet as any).links.get("a").conn;
  const write = async (value: unknown) => {
    const current = await conn.call("doc.get", { name: "herdr-app", on: "b" });
    await conn.call("doc.set", { name: "herdr-app", value, version: current.version, on: "b" });
  };
  await write({
    spaces: [
      { id: "sp_zeta", name: "", folder: "/tmp/zeta", tabs: [] },
      { id: "factory-x", name: "", folder: "/tmp/a", tabs: [] },
      { id: "sp_alpha", name: "alpha", folder: "/tmp", tabs: [] },
    ],
  });

  const project = join(scratch, "project");
  mkdirSync(project, { recursive: true });
  const agent = (labels: Record<string, string>) => fleet.run(b, { argv: AGENT, cwd: project, labels });
  const parent = await agent({ "herdr.space": "sp_zeta", "herdr.tab": "tb1" });
  const route = await until(() => fleet.route(parent));
  const child = await route!.conn.call("terminal.run", { argv: AGENT, on: "b", cwd: project, parent: route!.address.split("/")[1] });
  const loneKey = await agent({ "herdr.space": "sp_new", "herdr.tab": "tb2" });
  const childKey = `${b.coreId}:${child.address.split("/").pop()}`;

  const view = () => {
    const snap = fleet.snapshot();
    return spaces(snap.docs, fleet.targets().filter((t) => t.coreId === b.coreId), snap.sessions);
  };
  const ready = await until(() => {
    const v = view();
    const all = v.spaces.flatMap((s) => s.agents.map((a) => a.key));
    return [parent, childKey, loneKey].every((k) => all.includes(k)) && v;
  });

  const names = ready.spaces.map((s) => s.name).filter((n) => ["alpha", "project", "zeta", "a"].includes(n));
  expect(names).toEqual(["alpha", "project", "zeta", "a"]);
  expect(ready.spaces.at(-1)!.factory).toBe(true);
  const zeta = ready.spaces.find((s) => s.id === "sp_zeta")!;
  expect(zeta.agents.map((a) => a.key)).toEqual([parent, childKey]);
  expect(ready.spaces.find((s) => s.id === "sp_new")!.folder).toBe(project);

  await write({ spaces: [{ id: "sp_later", name: "later", folder: "/srv", tabs: [] }] });
  await until(() => view().spaces.some((s) => s.name === "later"));
}, 30_000);

test("an agent's launcher label resolves to its launcher's key, on its own machine or on one it added", async () => {
  const fleet = new Fleet(open);
  fleets.push(fleet);
  fleet.setMachines([A]);
  const a = await until(() => fleet.targets().find((x) => !x.on));
  const b = await until(() => fleet.targets().find((x) => x.on === "b"));
  const here = await fleet.run(a, { argv: AGENT, labels: { "herdr.parent": "t999" } });
  const far = await fleet.run(a, { argv: AGENT, labels: { "herdr.parent": `b/${bAddress}` } });
  const launcherOf = (key: string) => fleet.snapshot().sessions.find((s) => s.key === key)?.launcherKey;
  await until(() => launcherOf(here) && launcherOf(far));
  expect(launcherOf(here)).toBe(`${a.coreId}:t999`);
  expect(launcherOf(far)).toBe(`${b.coreId}:${bAddress}`);
}, 30_000);

test("tabs list every pane in the desktop's order, rename in the layout, and close by ending their terminals", async () => {
  const fleet = new Fleet(open);
  fleets.push(fleet);
  fleet.setMachines([A]);
  const b = await until(() => fleet.targets().find((x) => x.on === "b"));
  const conn = (fleet as any).links.get("a").conn;
  const project = join(scratch, "tabs");
  mkdirSync(project, { recursive: true });
  const agentKey = await fleet.run(b, { argv: AGENT, cwd: project, labels: { "herdr.space": "sp_tabs", "herdr.tab": "tb_split" } });
  const shellKey = await fleet.run(b, { argv: ["sh", "-c", "exec cat"], cwd: project, labels: { "herdr.space": "sp_tabs", "herdr.tab": "tb_split" } });
  const local = (key: string) => key.slice(key.lastIndexOf(":") + 1);
  const current = await conn.call("doc.get", { name: "herdr-app", on: "b" });
  const root = { type: "row", children: [{ type: "block", id: "p2", content: { terminal: local(shellKey) } }, { type: "column", children: [{ type: "block", id: "p1", content: { terminal: local(agentKey) } }, { type: "block", id: "p3", content: { mod: "files" } }] }] };
  await conn.call("doc.set", { name: "herdr-app", value: { spaces: [{ id: "sp_tabs", name: "tabs", folder: project, tabs: [{ id: "tb_split", name: "work", root }] }] }, version: current.version, on: "b" });

  const view = () => {
    const snap = fleet.snapshot();
    return spaces(snap.docs, [b], snap.sessions).spaces.find((s) => s.id === "sp_tabs");
  };
  const tab = await until(() => {
    const t = view()?.tabs.find((x) => x.id === "tb_split");
    return t && t.items.length === 3 && t;
  });
  expect(tab.items.map((i) => (i.kind === "mod" ? `mod:${i.name}` : i.session.key))).toEqual([shellKey, agentKey, "mod:files"]);

  await fleet.renameTab(b, "sp_tabs", "tb_split", "renamed");
  const saved = await conn.call("doc.get", { name: "herdr-app", on: "b" });
  expect(saved.value.spaces[0].tabs[0].name).toBe("renamed");
  expect(saved.value.spaces[0].tabs[0].root).toEqual(root);
  await until(() => view()?.tabs[0]?.name === "renamed");

  await fleet.renameSpace(b, "sp_tabs", "  my space ");
  const named = await conn.call("doc.get", { name: "herdr-app", on: "b" });
  expect(named.value.spaces[0].name).toBe("my space");
  expect(named.value.spaces[0].tabs[0].name).toBe("renamed");
  await until(() => view()?.name === "my space");
  // An empty name goes back to the folder's.
  await fleet.renameSpace(b, "sp_tabs", "");
  await until(() => view()?.name === "tabs" && view());

  const route = fleet.route(shellKey)!;
  await route.conn.call("terminal.kill", { terminal: route.address });
  // The core removes a terminal only once it has ended, a moment after kill.
  for (let i = 0; ; i++) {
    try {
      await route.conn.call("terminal.rm", { terminal: route.address });
      break;
    } catch (e) {
      if (i > 50) throw e;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  await until(() => !fleet.snapshot().sessions.some((s) => s.key === shellKey));
}, 30_000);
