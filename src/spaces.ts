import type { HerdrDoc, HerdrTab, Session, Target } from "./hc/fleet";

/** The tab, and its space, that a row was moved out of to hang under the agent that launched it. */
export type Origin = { space: Space; tab: SpaceTab };

/**
 * One pane of a tab: a terminal (agent or not), or a mod pane the desktop draws.
 * `sub` marks a sub-agent within the session's own tab; `depth` is how deep the
 * row sits in the list's tree. `from` is set on rows that belong to another tab
 * (of a child space or of this one) and hang here under the agent that launched them.
 */
export type TabItem = { kind: "session"; session: Session; sub: boolean; depth: number; from?: Origin } | { kind: "mod"; key: string; name: string };

/** A tab of a space, with its panes in the desktop's order and the sub-agents its agents started. */
export type SpaceTab = { key: string; id: string; name: string; items: TabItem[] };

export type Space = {
  key: string;
  target: Target;
  id: string;
  name: string;
  folder: string;
  factory: boolean;
  agents: Session[];
  tabs: SpaceTab[];
  /** The agent, in another space, this space's agents were launched by: its tabs hang under that agent and it has no row of its own. */
  nestedUnder: string | null;
};

export const coreOf = (key: string) => key.slice(0, key.lastIndexOf(":"));

const isAgent = (s: Session) => s.terminal.state === "live" && !!s.terminal.status;

function rank(state: string | undefined): number {
  switch (state) {
    case "blocked":
    case "error":
      return 0;
    case "idle":
    case "done":
      return 1;
    case "working":
      return 2;
    default:
      return 3;
  }
}

const changed = (s: Session) => s.terminal.status_ms ?? s.terminal.created_ms;

export function byUrgency(a: Session, b: Session): number {
  return rank(a.terminal.status?.state) - rank(b.terminal.status?.state) || changed(b) - changed(a);
}

export function folderName(folder: string): string {
  const path = folder.replace(/\/+$/, "");
  if (/^\/(home|Users)\/[^/]+$/.test(path) || path === "/root") return "~";
  return path.slice(path.lastIndexOf("/") + 1) || "/";
}

function family(agents: Session[]): Session[] {
  const keys = new Set(agents.map((s) => s.key));
  const children = new Map<string, Session[]>();
  for (const s of agents) {
    if (s.parentKey && keys.has(s.parentKey)) children.set(s.parentKey, [...(children.get(s.parentKey) ?? []), s]);
  }
  const out: Session[] = [];
  const walk = (s: Session) => {
    out.push(s);
    for (const c of children.get(s.key) ?? []) walk(c);
  };
  for (const s of agents) if (!s.parentKey || !keys.has(s.parentKey)) walk(s);
  return out;
}

type Pane = { terminal: string } | { mod: string; id: string };

/** The panes of a tab's split tree, left to right and top to bottom. */
export function panesOf(root: unknown): Pane[] {
  const out: Pane[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { id?: unknown; content?: { terminal?: unknown; mod?: unknown }; children?: unknown };
    if (typeof n.content?.terminal === "string") out.push({ terminal: n.content.terminal });
    else if (typeof n.content?.mod === "string") out.push({ mod: n.content.mod, id: typeof n.id === "string" ? n.id : n.content.mod });
    if (Array.isArray(n.children)) n.children.forEach(walk);
  };
  walk(root);
  return out;
}

function tabsOf(space: Space, docTabs: HerdrTab[], sessions: Session[], byKey: Map<string, Session>): SpaceTab[] {
  const core = space.target.coreId;
  const live = (s: Session | undefined): s is Session => !!s && s.terminal.state === "live";
  const mine = sessions.filter((s) => live(s) && coreOf(s.key) === core && s.terminal.labels?.["herdr.space"] === space.id);
  const tabLabel = (s: Session) => s.terminal.labels?.["herdr.tab"] || null;
  // Sub-agents have no tab of their own: they go under the agent that started them.
  const children = new Map<string, Session[]>();
  for (const s of sessions) {
    if (!live(s) || !s.parentKey || tabLabel(s) || s.terminal.labels?.["herdr.space"]) continue;
    if (byKey.has(s.parentKey)) children.set(s.parentKey, [...(children.get(s.parentKey) ?? []), s]);
  }
  const placed = new Set<string>();
  const add = (items: TabItem[], s: Session, sub: boolean) => {
    if (placed.has(s.key)) return;
    placed.add(s.key);
    items.push({ kind: "session", session: s, sub, depth: sub ? 1 : 0 });
    for (const c of children.get(s.key) ?? []) add(items, c, true);
  };

  const tabs: SpaceTab[] = [];
  const known = new Set<string>();
  docTabs.forEach((tab, i) => {
    known.add(tab.id);
    const items: TabItem[] = [];
    for (const pane of panesOf(tab.root)) {
      if ("terminal" in pane) {
        const s = byKey.get(`${core}:${pane.terminal}`);
        if (live(s)) add(items, s, false);
      } else items.push({ kind: "mod", key: `${tab.id}:${pane.id}`, name: pane.mod });
    }
    // Started here but not in the desktop's tree yet (just made from the phone).
    for (const s of mine) if (tabLabel(s) === tab.id) add(items, s, false);
    if (items.length) tabs.push({ key: `${space.key}:${tab.id}`, id: tab.id, name: tab.name || String(i + 1), items });
  });
  // Tabs the desktop doesn't know yet, one per label.
  for (const s of mine) {
    const id = tabLabel(s) ?? s.key;
    if (known.has(id) || placed.has(s.key)) continue;
    let tab = tabs.find((t) => t.id === id);
    if (!tab) {
      tab = { key: `${space.key}:${id}`, id, name: "", items: [] };
      tabs.push(tab);
    }
    add(tab.items, s, false);
  }
  return tabs;
}

export function spaces(docs: Record<string, HerdrDoc | null>, targets: Target[], sessions: Session[]): { spaces: Space[]; loose: Session[] } {
  const byKey = new Map(sessions.map((s) => [s.key, s]));
  const out = new Map<string, Space>();
  const make = (target: Target, id: string, name: string, folder: string): Space => {
    const key = `${target.coreId}:${id}`;
    let space = out.get(key);
    if (!space) {
      space = { key, target, id, name: name || folderName(folder), folder, factory: id.startsWith("factory-"), agents: [], tabs: [], nestedUnder: null };
      out.set(key, space);
    }
    return space;
  };

  for (const target of targets) {
    for (const s of docs[target.coreId]?.spaces ?? []) {
      if (s.id) make(target, s.id, s.name ?? "", s.folder ?? "");
    }
  }

  const label = (s: Session) => s.terminal.labels?.["herdr.space"] || null;
  for (const s of sessions) {
    const id = label(s);
    const target = targets.find((t) => t.coreId === coreOf(s.key));
    if (id && target && s.terminal.state === "live") make(target, id, "", s.terminal.cwd);
  }

  const spaceOf = (s: Session): Space | undefined => {
    const seen = new Set<string>();
    let at: Session | undefined = s;
    while (at && !seen.has(at.key)) {
      seen.add(at.key);
      const id = label(at);
      if (id) return out.get(`${coreOf(at.key)}:${id}`);
      at = at.parentKey ? byKey.get(at.parentKey) : undefined;
    }
    return undefined;
  };

  const loose: Session[] = [];
  for (const s of sessions.filter(isAgent).sort(byUrgency)) {
    const space = spaceOf(s);
    if (space) space.agents.push(s);
    else loose.push(s);
  }

  for (const space of out.values()) space.agents = family(space.agents);

  const docTabs = new Map<string, HerdrTab[]>();
  for (const target of targets) {
    for (const s of docs[target.coreId]?.spaces ?? []) if (s.id) docTabs.set(`${target.coreId}:${s.id}`, s.tabs ?? []);
  }
  for (const space of out.values()) space.tabs = tabsOf(space, docTabs.get(space.key) ?? [], sessions, byKey);
  nestLaunched([...out.values()]);

  const list = [...out.values()].sort((a, b) => Number(a.factory) - Number(b.factory) || a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
  return { spaces: list, loose };
}

/** How many levels of child spaces a top-level space holds: its children and theirs. */
const MAX_NESTING = 2;

/** Where each listed session sits. */
type Homes = Map<string, Origin>;

/** The launchers (`herdr.parent`) of a tab's sessions. */
const launchersOf = (tab: SpaceTab) => tab.items.flatMap((it) => (it.kind === "session" && it.session.launcherKey && it.session.launcherKey !== it.session.key ? [it.session.launcherKey] : []));

/**
 * Child spaces: each space whose agent was launched by an agent in another
 * space, and that agent's key. Loops and spaces nested too deep are left out,
 * so they keep their own row.
 */
function childSpaces(all: Space[], home: Homes): Map<Space, string> {
  const under = new Map<Space, string>();
  for (const space of all) {
    // The first of its agents launched from elsewhere decides where it hangs.
    const p = space.tabs.flatMap(launchersOf).find((k) => home.has(k) && home.get(k)!.space !== space);
    if (p) under.set(space, p);
  }
  const parentOf = (space: Space) => {
    const p = under.get(space);
    return p ? home.get(p)!.space : undefined;
  };
  // A space that ends up under itself would make a loop: it stays a space of its own.
  for (const space of [...under.keys()]) {
    const seen = new Set<Space>();
    for (let at = parentOf(space); at && !seen.has(at); at = parentOf(at)) {
      if (at === space) {
        under.delete(space);
        break;
      }
      seen.add(at);
    }
  }
  const depth = (space: Space) => {
    let n = 0;
    for (let at = parentOf(space); at; at = parentOf(at)) n++;
    return n;
  };
  // Too deep: the shallowest such space gets its row back, and the ones under it move up with it.
  for (;;) {
    const deep = [...under.keys()].filter((sp) => depth(sp) > MAX_NESTING).sort((a, b) => depth(a) - depth(b))[0];
    if (!deep) return under;
    under.delete(deep);
  }
}

/** Tabs launched from another tab of the same space, and their launcher's key, one level only: a tab that moves holds none that move. */
function movedTabs(all: Space[], home: Homes): Map<SpaceTab, string> {
  const candidate = new Map<SpaceTab, string>();
  for (const space of all) {
    for (const tab of space.tabs) {
      const p = launchersOf(tab).find((k) => home.get(k)?.space === space && home.get(k)!.tab !== tab);
      if (p) candidate.set(tab, p);
    }
  }
  return new Map([...candidate].filter(([, p]) => !candidate.has(home.get(p)!.tab)));
}

/**
 * Hangs what an agent launched (`herdr.parent`) under it, as the desktop's
 * sidebar does: a space whose agents another space's agent launched loses its
 * own row and its tabs hang under that agent; a tab launched by an agent in
 * another tab of the same space hangs under it too. A launcher that is gone
 * leaves things where they are.
 */
function nestLaunched(all: Space[]) {
  const home: Homes = new Map();
  for (const space of all) for (const tab of space.tabs) for (const it of tab.items) if (it.kind === "session") home.set(it.session.key, { space, tab });
  const under = childSpaces(all, home);
  const moved = movedTabs(all, home);

  // Launcher key -> the tabs that hang under it.
  const kids = new Map<string, Origin[]>();
  for (const space of all) {
    for (const tab of space.tabs) {
      const launcher = moved.get(tab) ?? under.get(space);
      if (launcher) kids.set(launcher, [...(kids.get(launcher) ?? []), { space, tab }]);
    }
  }
  if (!kids.size) return;

  const seen = new Set<SpaceTab>();
  const expand = (tab: SpaceTab, base: number, from: Origin | undefined): TabItem[] => {
    if (seen.has(tab)) return [];
    seen.add(tab);
    const out: TabItem[] = [];
    for (const it of tab.items) {
      if (it.kind === "mod") {
        // A desktop panel only means something in its own tab.
        if (!from) out.push(it);
        continue;
      }
      const depth = base + it.depth;
      out.push(from ? { ...it, depth, from } : { ...it, depth });
      for (const k of kids.get(it.session.key) ?? []) out.push(...expand(k.tab, depth + 1, k));
    }
    return out;
  };
  // Each tab is expanded once, from the tab its tree starts in; a child space keeps its own tabs as they were.
  for (const space of all) {
    space.nestedUnder = under.get(space) ?? null;
    if (space.nestedUnder) continue;
    space.tabs = space.tabs.filter((tab) => !moved.has(tab)).map((tab) => ({ ...tab, items: expand(tab, 0, undefined) }));
  }
}
