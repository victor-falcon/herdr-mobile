// How the Spaces list hangs what an agent launched (`herdr.parent`) under it, and how the inbox groups agents.
import { expect, test } from "vitest";
import type { HerdrDoc, HerdrTab, Session, Target } from "../src/hc/fleet";
import { inbox, spaces, type Space, type TabItem } from "../src/spaces";

const targets: Target[] = [
  { coreId: "mac", label: "mac", linkId: "mac" },
  { coreId: "mini", label: "mini", linkId: "mini" },
];

type Opts = { core?: string; space?: string; tab?: string; launcher?: string; parent?: string; state?: string; agent?: boolean; status?: string; ms?: number };

function session(address: string, o: Opts = {}): Session {
  const core = o.core ?? "mac";
  const labels: Record<string, string> = {};
  if (o.space) labels["herdr.space"] = o.space;
  if (o.tab) labels["herdr.tab"] = o.tab;
  return {
    key: `${core}:${address}`,
    parentKey: o.parent ?? null,
    launcherKey: o.launcher ?? null,
    machine: core,
    linkId: core,
    address,
    terminal: {
      address,
      argv: [],
      cwd: "/work",
      state: o.state ?? "live",
      created_ms: 1,
      status_ms: o.ms,
      status: o.agent === false ? null : { state: o.status ?? "working" },
      labels,
      cols: 80,
      rows: 24,
    },
  };
}

const tab = (id: string, ...terminals: string[]): HerdrTab => ({
  id,
  root: { type: "row", children: terminals.map((t) => ({ type: "block", id: `p_${t}`, content: { terminal: t } })) },
});
const doc = (...list: { id: string; name: string; tabs: HerdrTab[] }[]): HerdrDoc => ({ spaces: list.map((s) => ({ ...s, folder: `/work/${s.name}` })) });

const rows = (sp: Space | undefined) =>
  (sp?.tabs ?? []).flatMap((t) =>
    t.items.map((i: TabItem) => (i.kind === "session" ? `${"  ".repeat(i.depth)}${i.session.key}${i.from ? ` <${i.from.space.id}/${i.from.tab.id}>` : ""}` : `mod:${i.name}`)),
  );
const shown = (list: Space[]) => list.filter((s) => !s.nestedUnder);
const byId = (list: Space[], id: string) => list.find((s) => s.id === id);

test("a space whose agent another space's agent launched hangs under that agent", () => {
  const docs = { mac: doc({ id: "sp_main", name: "main", tabs: [tab("tb1", "t1")] }, { id: "sp_wt", name: "feature", tabs: [tab("tb2", "t2"), tab("tb3", "t3")] }) };
  const sessions = [session("t1", { space: "sp_main", tab: "tb1" }), session("t2", { space: "sp_wt", tab: "tb2", launcher: "mac:t1" }), session("t3", { space: "sp_wt", tab: "tb3", agent: false })];
  const { spaces: list } = spaces(docs, targets, sessions);

  expect(shown(list).map((s) => s.id)).toEqual(["sp_main"]);
  expect(byId(list, "sp_wt")!.nestedUnder).toBe("mac:t1");
  expect(rows(byId(list, "sp_main"))).toEqual(["mac:t1", "  mac:t2 <sp_wt/tb2>", "  mac:t3 <sp_wt/tb3>"]);
  // The child space keeps its own tabs, so its rows still act on it.
  expect(byId(list, "sp_wt")!.tabs.map((t) => t.id)).toEqual(["tb2", "tb3"]);
});

test("a launched agent's own sub-agents nest one level deeper, after the launcher's rows", () => {
  const docs = { mac: doc({ id: "sp_main", name: "main", tabs: [tab("tb1", "t1")] }, { id: "sp_wt", name: "feature", tabs: [tab("tb2", "t2")] }) };
  const sessions = [
    session("t1", { space: "sp_main", tab: "tb1" }),
    session("t2", { space: "sp_wt", tab: "tb2", launcher: "mac:t1" }),
    session("t4", { parent: "mac:t2" }),
    session("t5", { parent: "mac:t1" }),
  ];
  const { spaces: list } = spaces(docs, targets, sessions);
  expect(rows(byId(list, "sp_main"))).toEqual(["mac:t1", "  mac:t2 <sp_wt/tb2>", "    mac:t4 <sp_wt/tb2>", "  mac:t5"]);
});

test("a space whose launcher is gone keeps its own row", () => {
  const docs = { mac: doc({ id: "sp_main", name: "main", tabs: [tab("tb1", "t1")] }, { id: "sp_wt", name: "feature", tabs: [tab("tb2", "t2")] }) };
  const sessions = [session("t1", { space: "sp_main", tab: "tb1", state: "finished" }), session("t2", { space: "sp_wt", tab: "tb2", launcher: "mac:t1" })];
  const { spaces: list } = spaces(docs, targets, sessions);
  expect(shown(list).map((s) => s.id)).toEqual(["sp_wt", "sp_main"]);
  expect(byId(list, "sp_wt")!.nestedUnder).toBeNull();
  expect(rows(byId(list, "sp_wt"))).toEqual(["mac:t2"]);
});

test("two spaces that launched each other don't make a loop: one keeps its row and every agent shows once", () => {
  const docs = { mac: doc({ id: "sp_a", name: "a", tabs: [tab("tb1", "t1")] }, { id: "sp_b", name: "b", tabs: [tab("tb2", "t2")] }) };
  const sessions = [session("t1", { space: "sp_a", tab: "tb1", launcher: "mac:t2" }), session("t2", { space: "sp_b", tab: "tb2", launcher: "mac:t1" })];
  const { spaces: list } = spaces(docs, targets, sessions);
  const visible = shown(list);
  expect(visible).toHaveLength(1);
  expect(
    visible
      .flatMap(rows)
      .map((r) => r.trim().split(" ")[0])
      .sort(),
  ).toEqual(["mac:t1", "mac:t2"]);
});

test("a launcher on another machine takes the child space under it", () => {
  // The agent on mini was launched by mac's t1 (its label read `mac/t1`, resolved by the fleet).
  const docs = { mac: doc({ id: "sp_main", name: "main", tabs: [tab("tb1", "t1")] }), mini: doc({ id: "sp_far", name: "far", tabs: [tab("tb9", "t9")] }) };
  const sessions = [session("t1", { space: "sp_main", tab: "tb1" }), session("t9", { core: "mini", space: "sp_far", tab: "tb9", launcher: "mac:t1" })];
  const { spaces: list } = spaces(docs, targets, sessions);
  expect(shown(list).map((s) => s.key)).toEqual(["mac:sp_main"]);
  expect(rows(byId(list, "sp_main"))).toEqual(["mac:t1", "  mini:t9 <sp_far/tb9>"]);
});

test("a tab launched from another tab of the same space moves under its launcher, one level only", () => {
  const docs = { mac: doc({ id: "sp_main", name: "main", tabs: [tab("tb1", "t1"), tab("tb2", "t2"), tab("tb3", "t3")] }) };
  const sessions = [
    session("t1", { space: "sp_main", tab: "tb1" }),
    session("t2", { space: "sp_main", tab: "tb2", launcher: "mac:t1" }),
    session("t3", { space: "sp_main", tab: "tb3", launcher: "mac:t2" }),
  ];
  const sp = byId(spaces(docs, targets, sessions).spaces, "sp_main");
  expect(sp!.tabs.map((t) => t.id)).toEqual(["tb1", "tb3"]);
  expect(rows(sp)).toEqual(["mac:t1", "  mac:t2 <sp_main/tb2>", "mac:t3"]);
});

test("child spaces nest two deep at most; deeper ones get their row back", () => {
  const ids = ["s0", "s1", "s2", "s3"];
  const docs = { mac: doc(...ids.map((id, n) => ({ id, name: id, tabs: [tab(`tb${n}`, `t${n}`)] }))) };
  const sessions = ids.map((id, n) => session(`t${n}`, { space: id, tab: `tb${n}`, launcher: n ? `mac:t${n - 1}` : undefined }));
  const { spaces: list } = spaces(docs, targets, sessions);
  expect(shown(list).map((s) => s.id)).toEqual(["s0", "s3"]);
  expect(rows(byId(list, "s0"))).toEqual(["mac:t0", "  mac:t1 <s1/tb1>", "    mac:t2 <s2/tb2>"]);
  expect(rows(byId(list, "s3"))).toEqual(["mac:t3"]);
});

test("inside a child space, a tab launched from another of its tabs hangs under that tab's agent", () => {
  const docs = { mac: doc({ id: "sp_main", name: "main", tabs: [tab("tb1", "t1")] }, { id: "sp_wt", name: "feature", tabs: [tab("tb2", "t2"), tab("tb3", "t3")] }) };
  const sessions = [
    session("t1", { space: "sp_main", tab: "tb1" }),
    session("t2", { space: "sp_wt", tab: "tb2", launcher: "mac:t1" }),
    session("t3", { space: "sp_wt", tab: "tb3", launcher: "mac:t2" }),
  ];
  const { spaces: list } = spaces(docs, targets, sessions);
  expect(rows(byId(list, "sp_main"))).toEqual(["mac:t1", "  mac:t2 <sp_wt/tb2>", "    mac:t3 <sp_wt/tb3>"]);
});

// The inbox: every agent across spaces and machines, most urgent first.
const groups = (docs: Record<string, HerdrDoc>, sessions: Session[]) =>
  inbox(spaces(docs, targets, sessions)).map((g) => `${g.label}: ${g.agents.map((a) => `${a.session.key}@${a.space?.id ?? "-"}`).join(" ")}`);

test("the inbox groups agents by urgency and leaves out empty groups and plain terminals", () => {
  const docs = { mac: doc({ id: "sp_a", name: "a", tabs: [tab("tb1", "t1", "t2", "t3")] }), mini: doc({ id: "sp_b", name: "b", tabs: [tab("tb2", "t4")] }) };
  const sessions = [
    session("t1", { space: "sp_a", tab: "tb1", status: "idle", ms: 10 }),
    session("t2", { space: "sp_a", tab: "tb1", status: "error", ms: 20 }),
    session("t3", { space: "sp_a", tab: "tb1", agent: false }),
    session("t4", { core: "mini", space: "sp_b", tab: "tb2", status: "blocked", ms: 30 }),
    session("t5", { status: "working", ms: 40 }),
    session("t6", { space: "sp_a", status: "done", state: "finished" }),
  ];
  expect(groups(docs, sessions)).toEqual(["Needs you: mac:t2@sp_a mini:t4@sp_b", "Working: mac:t5@-", "Idle: mac:t1@sp_a"]);
});

test("in the inbox, who needs you and waited longest leads; elsewhere the latest change does", () => {
  const docs = { mac: doc({ id: "sp_a", name: "a", tabs: [tab("tb1", "t1", "t2", "t3", "t4", "t5", "t6")] }) };
  const s = (address: string, status: string, ms?: number) => session(address, { space: "sp_a", tab: "tb1", status, ms });
  // t6 has no status_ms: its creation (1) counts.
  const sessions = [s("t1", "blocked", 50), s("t2", "blocked", 10), s("t3", "done", 10), s("t4", "done", 50), s("t5", "working", 30), s("t6", "working")];
  expect(groups(docs, sessions)).toEqual(["Needs you: mac:t2@sp_a mac:t1@sp_a", "Done: mac:t4@sp_a mac:t3@sp_a", "Working: mac:t5@sp_a mac:t6@sp_a"]);
});

const subsOf = (docs: Record<string, HerdrDoc>, sessions: Session[], key: string) => {
  const a = inbox(spaces(docs, targets, sessions))
    .flatMap((g) => g.agents)
    .find((x) => x.session.key === key);
  return { subs: a?.subs.map((x) => x.session.key), summary: a?.summary };
};

test("the inbox hides sub-agents and launched agents, transitively, on the row of the agent that started the chain", () => {
  const docs = { mac: doc({ id: "sp_main", name: "main", tabs: [tab("tb1", "t1")] }, { id: "sp_wt", name: "feature", tabs: [tab("tb2", "t2")] }) };
  const sessions = [
    session("t1", { space: "sp_main", tab: "tb1", ms: 1 }),
    session("t2", { space: "sp_wt", tab: "tb2", launcher: "mac:t1", ms: 2 }),
    session("t3", { parent: "mac:t2", ms: 3 }),
  ];
  expect(groups(docs, sessions)).toEqual(["Working: mac:t1@sp_main"]);
  expect(subsOf(docs, sessions, "mac:t1")).toEqual({ subs: ["mac:t3", "mac:t2"], summary: { status: "working", n: 2, total: 2 } });
});

test("an agent whose launcher is gone, or is no agent, has its own row in the inbox", () => {
  const docs = { mac: doc({ id: "sp_main", name: "main", tabs: [tab("tb1", "t1", "t4")] }, { id: "sp_wt", name: "feature", tabs: [tab("tb2", "t2")] }) };
  const sessions = [
    session("t1", { space: "sp_main", tab: "tb1", state: "finished" }),
    session("t2", { space: "sp_wt", tab: "tb2", launcher: "mac:t1", ms: 2 }),
    session("t4", { space: "sp_main", tab: "tb1", agent: false }),
    session("t5", { parent: "mac:t4", ms: 5 }),
  ];
  expect(groups(docs, sessions)).toEqual(["Working: mac:t5@sp_main mac:t2@sp_wt"]);
  expect(subsOf(docs, sessions, "mac:t2").summary).toBeNull();
});

test("agents that launched each other in a loop keep their own rows", () => {
  const docs = { mac: doc({ id: "sp_a", name: "a", tabs: [tab("tb1", "t1", "t2")] }) };
  const sessions = [session("t1", { space: "sp_a", tab: "tb1", launcher: "mac:t2", ms: 1 }), session("t2", { space: "sp_a", tab: "tb1", launcher: "mac:t1", ms: 2 })];
  expect(groups(docs, sessions)).toEqual(["Working: mac:t2@sp_a mac:t1@sp_a"]);
});

test("a parent moves to its most urgent subagent's group when that one outranks its own", () => {
  const docs = { mac: doc({ id: "sp_a", name: "a", tabs: [tab("tb1", "t1", "t2")] }) };
  const sessions = [
    // A working parent with a blocked subagent needs you.
    session("t1", { space: "sp_a", tab: "tb1", status: "working", ms: 10 }),
    session("t3", { parent: "mac:t1", status: "error", ms: 11 }),
    session("t4", { parent: "mac:t1", status: "working", ms: 12 }),
    // A done parent with a working subagent stays in Done: working ranks lower.
    session("t2", { space: "sp_a", tab: "tb1", status: "done", ms: 20 }),
    session("t5", { parent: "mac:t2", status: "working", ms: 21 }),
  ];
  expect(groups(docs, sessions)).toEqual(["Needs you: mac:t1@sp_a", "Done: mac:t2@sp_a"]);
  expect(subsOf(docs, sessions, "mac:t1")).toEqual({ subs: ["mac:t3", "mac:t4"], summary: { status: "blocked", n: 1, total: 2 } });
  expect(subsOf(docs, sessions, "mac:t2").summary).toEqual({ status: "working", n: 1, total: 1 });
});

test("a parent's subagents read most urgent first: blocked, working, done, idle, then the latest change", () => {
  const docs = { mac: doc({ id: "sp_a", name: "a", tabs: [tab("tb1", "t1")] }) };
  const sessions = [
    session("t1", { space: "sp_a", tab: "tb1", status: "idle", ms: 1 }),
    session("s1", { parent: "mac:t1", status: "idle", ms: 50 }),
    session("s2", { parent: "mac:t1", status: "done", ms: 40 }),
    session("s3", { parent: "mac:t1", status: "done", ms: 45 }),
    session("s4", { parent: "mac:t1", status: "working", ms: 10 }),
  ];
  expect(groups(docs, sessions)).toEqual(["Working: mac:t1@sp_a"]);
  expect(subsOf(docs, sessions, "mac:t1")).toEqual({ subs: ["mac:s4", "mac:s3", "mac:s2", "mac:s1"], summary: { status: "working", n: 1, total: 4 } });
  const idle = [sessions[0], session("s1", { parent: "mac:t1", status: "idle" }), session("s2", { parent: "mac:t1", status: "idle" })];
  expect(subsOf(docs, idle, "mac:t1").summary).toEqual({ status: "idle", n: 2, total: 2 });
});
