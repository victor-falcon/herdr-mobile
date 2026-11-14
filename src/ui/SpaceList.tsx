import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { Alert, Animated, PanResponder, Pressable, Text, View, type StyleProp, type TextStyle } from "react-native";
import { fleet } from "../fleet-store";
import type { Session } from "../hc/fleet";
import { updateSettings, useSettings } from "../settings";
import { folderName, statusWords, summarize, tabName, type Space, type SpaceTab, type TabItem } from "../spaces";
import { AgentAvatar, Avatar, StatusAvatar, StatusMark } from "./Avatar";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { confirmClose } from "./close-session";
import { IconButton } from "./IconButton";
import { startTerminal } from "./new-session";
import { useLastOpened } from "./last-opened";
import { ago, agentTitle, sessionTitle, shortPath } from "./session-display";
import { Sheet, SheetAction, SheetActions, SheetHeader } from "./Sheet";
import { TextField } from "./TextField";
import { emphasized, fonts, makeStyles, shape, space as gap, typography, useColors } from "./theme";

type Props = {
  spaces: Space[];
  loose: Session[];
  showMachine: boolean;
  onSelect: (s: Session) => void;
};

/** What a row closes and renames: a whole tab, or one pane of a split tab. */
export type RowTarget = {
  title: string;
  space: Space | null;
  tab: SpaceTab | null;
  /** The terminals Close ends: the pane or the tab's, with the sub-agents they started. */
  sessions: Session[];
  /** "tab" when closing these closes the tab. */
  scope: "tab" | "pane";
  /** What the menu's avatar shows: the row's session, a desktop panel or a split tab. */
  lead: Session | "mod" | "tab";
};

type Actions = { onSelect: (s: Session) => void; onMenu: (t: RowTarget) => void; onClose: (t: RowTarget) => void };

/** A session and the sub-agents listed after it in its tab. */
function withSubs(tab: SpaceTab, s: Session): Session[] {
  const i = tab.items.findIndex((x) => x.kind === "session" && x.session.key === s.key);
  const out = [s];
  for (const x of tab.items.slice(i + 1)) {
    if (x.kind !== "session" || !x.sub) break;
    out.push(x.session);
  }
  return out;
}

const tabSessions = (tab: SpaceTab) => tab.items.flatMap((i) => (i.kind === "session" ? [i.session] : []));
const tabTitle = tabName;
/** A tab's own rows, without the ones that hang in it from tabs their agents launched. */
const ownTab = (tab: SpaceTab): SpaceTab => ({ ...tab, items: tab.items.filter((i) => !(i.kind === "session" && i.from)) });
const isSplit = (tab: SpaceTab) => tab.items.filter((i) => !(i.kind === "session" && i.sub)).length > 1;

/** What a tab's long-press menu and swipe act on: the whole tab. */
function wholeTab(space: Space, tab: SpaceTab): RowTarget {
  return { title: tabTitle(tab) ?? "this tab", space, tab, sessions: tabSessions(tab), scope: "tab", lead: "tab" };
}

/**
 * What a session row closes and renames, in the session's own tab: a sub-agent
 * ends only itself; a pane of a split tab ends with its sub-agents; the only
 * pane of a tab takes the tab with it. `tab` holds only the tab's own rows.
 */
function sessionTarget(space: Space, tab: SpaceTab, item: Extract<TabItem, { kind: "session" }>): RowTarget {
  const s = item.session;
  const title = s.terminal.status ? agentTitle(s) : sessionTitle(s);
  if (item.sub) return { title, space, tab, sessions: [s], scope: "pane", lead: s };
  if (isSplit(tab)) return { title, space, tab, sessions: withSubs(tab, s), scope: "pane", lead: s };
  return { ...wholeTab(space, tab), title, lead: s };
}

/** What an agent's row closes and renames wherever it is listed: the same as its row in `space` on the Spaces list. */
export function agentTarget(s: Session, space: Space | null): RowTarget {
  const alone: RowTarget = { title: agentTitle(s), space: null, tab: null, sessions: [s], scope: "pane", lead: s };
  if (!space) return alone;
  // A session is listed once in its space's tabs: in its own tab, or hanging under its launcher (`from`).
  for (const tab of space.tabs) {
    for (const item of tab.items) {
      if (item.kind !== "session" || item.session.key !== s.key) continue;
      return item.from ? sessionTarget(item.from.space, ownTab(item.from.tab), item) : sessionTarget(space, ownTab(tab), item);
    }
  }
  return alone;
}

/** How a row joins the tree drawn down the left of a tab: one entry per level above it, true where a line runs on past it. */
type Branch = { depth: number; last: boolean; through: boolean[]; parent: boolean };

function branchesOf(items: TabItem[]): Branch[] {
  const depthOf = (i: TabItem) => (i.kind === "session" ? i.depth : 0);
  // Whether another row at `level` follows `at` before the tree climbs above it.
  const goesOn = (at: number, level: number) => {
    for (const next of items.slice(at + 1)) {
      const d = depthOf(next);
      if (d < level) return false;
      if (d === level) return true;
    }
    return false;
  };
  return items.map((item, i) => {
    const depth = depthOf(item);
    return {
      depth,
      last: !goesOn(i, depth),
      through: Array.from({ length: Math.max(0, depth - 1) }, (_, l) => goesOn(i, l + 1)),
      parent: i + 1 < items.length && depthOf(items[i + 1]) > depth,
    };
  });
}

/** How many rows a folded space hides: its panes, not the sub-agents under them. */
const rowCount = (sp: Space) => sp.tabs.reduce((n, t) => n + t.items.filter((i) => !(i.kind === "session" && (i.sub || i.depth > 0))).length, 0);

/** Start a terminal, then open it; says so when it can't. */
export async function openNew(start: () => Promise<string>) {
  try {
    const key = await start();
    router.push({ pathname: "/session/[key]", params: { key } });
  } catch (e) {
    Alert.alert("Could not start it", e instanceof Error ? e.message : String(e));
  }
}

/** The spaces as the desktop's sidebar lists them: a small header per space, one line per tab. */
export function SpaceList({ spaces, loose, showMachine, onSelect }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const { collapsed } = useSettings();
  const folded = new Set(collapsed);
  const toggle = (sp: Space) => void updateSettings({ collapsed: folded.has(sp.key) ? collapsed.filter((k) => k !== sp.key) : [...collapsed, sp.key] });
  const rows = useRowMenu();
  const [spaceMenu, setSpaceMenu] = useState<Space | null>(null);
  const actions: Actions = { onSelect, onMenu: rows.open, onClose: rows.close };
  // A child space has no row of its own: its tabs hang under the agent that launched it.
  const shown = spaces.filter((sp) => !sp.nestedUnder);

  return (
    <View style={styles.list}>
      {shown.map((sp) => {
        const isFolded = folded.has(sp.key);
        // Folded, it says in one line what it hides, as the desktop's "2 ▸ 1 blocked".
        const summary = isFolded ? summarize(sp.agents) : null;
        const urgent = summary && summary.status !== "idle" ? summary : null;
        const urgentColor = urgent?.status === "blocked" ? colors.error : urgent?.status === "working" ? colors.working : colors.done;
        return (
          <View key={sp.key}>
            <View style={styles.head}>
              <Pressable
                onPress={() => toggle(sp)}
                onLongPress={() => setSpaceMenu(sp)}
                accessibilityRole="button"
                accessibilityLabel={sp.name}
                accessibilityState={{ expanded: !isFolded }}
                accessibilityHint="Tap to fold or unfold, hold for options"
                style={({ pressed }) => [styles.headTitle, pressed && styles.headPressed]}
              >
                <Text style={styles.name} numberOfLines={1}>
                  {sp.name}
                </Text>
                {showMachine && (
                  <Text style={styles.machine} numberOfLines={1}>
                    {sp.target.label}
                  </Text>
                )}
                {sp.factory && <Chip label="factory" />}
                <View style={styles.grow} />
                {urgent && (
                  <Text style={[styles.foldedSummary, { color: urgentColor }]} numberOfLines={1}>
                    ▸ {urgent.n} {statusWords(urgent.status)}
                  </Text>
                )}
                <Text style={styles.count}>{rowCount(sp)}</Text>
                {isFolded && <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceVariant} />}
              </Pressable>
              <IconButton icon="add" size={40} label={`New tab in ${sp.name}`} onPress={() => void openNew(() => startTerminal(sp))} />
            </View>
            {!isFolded && sp.tabs.map((tab, i) => <TabRows key={tab.key} space={sp} tab={tab} number={i + 1} actions={actions} />)}
          </View>
        );
      })}
      {loose.length > 0 && (
        <View>
          <View style={styles.head}>
            <Text style={[styles.name, styles.looseHead]} accessibilityRole="header">
              Not in a space
            </Text>
          </View>
          {loose.map((s) => {
            const target = agentTarget(s, null);
            return (
              <Swipe key={s.key} flat onClose={() => rows.close(target)}>
                <SidebarRow session={s} title={agentTitle(s)} onPress={() => onSelect(s)} onLongPress={() => rows.open(target)} />
              </Swipe>
            );
          })}
        </View>
      )}

      <Sheet visible={!!spaceMenu} onClose={() => setSpaceMenu(null)}>
        {spaceMenu && (
          <>
            <SheetHeader
              title={spaceMenu.name}
              meta={[spaceMenu.target.label, spaceMenu.folder ? shortPath(spaceMenu.folder) : ""].filter(Boolean).join(" · ")}
              icon="folder-outline"
            />
            <SheetActions>
              <SheetAction
                icon="add"
                label="New tab"
                detail="A terminal in the space's folder"
                onPress={() => {
                  const sp = spaceMenu;
                  setSpaceMenu(null);
                  void openNew(() => startTerminal(sp));
                }}
              />
              <SheetAction
                icon="pencil"
                label="Rename space"
                detail={`Now “${spaceMenu.name}”`}
                onPress={() => {
                  const sp = spaceMenu;
                  rows.rename({
                    title: "Rename space",
                    label: "Space name",
                    placeholder: `Leave empty to use ${folderName(sp.folder) || "its folder"}`,
                    initial: sp.name,
                    save: (name) => fleet.renameSpace(sp.target, sp.id, name),
                  });
                  setSpaceMenu(null);
                }}
              />
            </SheetActions>
          </>
        )}
      </Sheet>
      {rows.sheets}
    </View>
  );
}

/**
 * The long-press menu of a row (rename its tab, close it) and the rename sheet,
 * shared by the Spaces list and the inbox. Render `sheets` once.
 */
export function useRowMenu() {
  const colors = useColors();
  const [menu, setMenu] = useState<RowTarget | null>(null);
  const [renaming, setRenaming] = useState<Renaming | null>(null);
  const close = (t: RowTarget) => {
    const what = t.scope === "tab" ? "Its programs end and the tab closes on every screen." : "Its program ends and the pane closes on every screen.";
    void confirmClose(t.title, t.sessions, what);
  };
  const sheets = (
    <>
      <Sheet visible={!!menu} onClose={() => setMenu(null)}>
        {menu && (
          <>
            <SheetHeader
              title={menu.title}
              meta={menu.tab && menu.scope === "pane" ? `A pane of ${tabTitle(menu.tab) ?? "a split tab"}` : undefined}
              avatar={
                menu.lead === "mod" ? (
                  <Avatar icon="grid-outline" size={48} square color={colors.onSurfaceVariant} background={colors.surfaceContainerHighest} />
                ) : menu.lead === "tab" ? (
                  <Avatar icon="albums-outline" size={48} square color={colors.onSecondaryContainer} background={colors.secondaryContainer} />
                ) : (
                  <StatusAvatar session={menu.lead} size={48} square />
                )
              }
            />
            <SheetActions>
              {menu.tab && menu.space && !menu.tab.id.includes(":") && (
                <SheetAction
                  icon="add"
                  label="New pane"
                  detail="A terminal beside it in this tab"
                  onPress={() => {
                    const { space, tab } = menu;
                    setMenu(null);
                    if (space && tab) void openNew(() => startTerminal(space, tab.id));
                  }}
                />
              )}
              {menu.tab && menu.space && (
                <SheetAction
                  icon="pencil"
                  label="Rename tab"
                  detail={tabTitle(menu.tab) ? `Now “${menu.tab.name}”` : "It has no name yet"}
                  onPress={() => {
                    const { space, tab } = menu;
                    if (!space || !tab) return;
                    setRenaming({
                      title: "Rename tab",
                      label: "Tab name",
                      placeholder: "Leave empty to use the agent's title",
                      initial: tabTitle(tab) ?? "",
                      save: (name) => fleet.renameTab(space.target, space.id, tab.id, name),
                    });
                    setMenu(null);
                  }}
                />
              )}
              {menu.sessions.length > 0 && (
                <SheetAction
                  icon="close"
                  label={menu.scope === "tab" ? "Close tab" : "Close pane"}
                  detail={menu.scope === "tab" ? "End it and close the tab" : "End it and close this pane"}
                  danger
                  onPress={() => {
                    const t = menu;
                    setMenu(null);
                    close(t);
                  }}
                />
              )}
            </SheetActions>
          </>
        )}
      </Sheet>
      <RenameSheet renaming={renaming} onClose={() => setRenaming(null)} />
    </>
  );
  return { open: setMenu, close, rename: setRenaming, sheets };
}

/** What the rename sheet edits: a tab or a space. */
type Renaming = { title: string; label: string; placeholder: string; initial: string; save: (name: string) => Promise<void> };

function RenameSheet({ renaming, onClose }: { renaming: Renaming | null; onClose: () => void }) {
  const styles = useStyles();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [shown, setShown] = useState<Renaming | null>(null);
  if (renaming !== shown) {
    setShown(renaming);
    setName(renaming?.initial ?? "");
  }
  const save = async () => {
    if (!renaming) return;
    setSaving(true);
    try {
      await renaming.save(name);
      onClose();
    } catch (e) {
      Alert.alert("Could not rename it", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={!!renaming} onClose={onClose}>
      <SheetHeader title={renaming?.title ?? ""} />
      <View style={styles.rename}>
        <TextField
          label={renaming?.label}
          value={name}
          onChangeText={setName}
          placeholder={renaming?.placeholder}
          autoFocus
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={() => void save()}
        />
        <Button title="Rename" variant="filled" size="medium" onPress={() => void save()} loading={saving} />
      </View>
    </Sheet>
  );
}

/** A tab: one line, or for a split tab its name over a line per pane. */
function TabRows({ space, tab, number, actions }: { space: Space; tab: SpaceTab; number: number; actions: Actions }) {
  // Rows launched from here act on their own tab and space, never on this one.
  const own = ownTab(tab);
  const split = isSplit(own);
  const whole = wholeTab(space, own);
  const branches = branchesOf(tab.items);
  const indent = split ? 1 : 0;

  const row = (item: TabItem, i: number) => {
    if (item.kind === "mod")
      return <SidebarRow key={item.key} mod title={item.name} indent={indent} onLongPress={() => actions.onMenu({ ...whole, title: item.name, sessions: [], scope: "pane", lead: "mod" })} />;
    const s = item.session;
    const target = item.from ? sessionTarget(item.from.space, ownTab(item.from.tab), item) : sessionTarget(space, own, item);
    // A row from another space says which, so it is still clear where it runs.
    const hint = item.from && item.from.space !== space && !item.sub ? item.from.space.name : null;
    // The name someone gave the tab beats the agent's own title; a pane of a split tab keeps its own.
    const homeTab = item.from ? ownTab(item.from.tab) : own;
    const top = !item.sub && (item.from ? true : item.depth === 0);
    const named = top && !isSplit(homeTab) ? tabName(homeTab) : null;
    const title = named ?? (s.terminal.status ? agentTitle(s) : sessionTitle(s));
    return (
      <Swipe key={s.key} flat onClose={() => actions.onClose(target)}>
        <SidebarRow
          session={s}
          title={title}
          hint={hint}
          number={!split && i === 0 && !item.from ? number : undefined}
          branch={branches[i]}
          indent={indent}
          onPress={() => actions.onSelect(s)}
          onLongPress={() => actions.onMenu(target)}
        />
      </Swipe>
    );
  };
  if (!split) return <View>{tab.items.map(row)}</View>;
  return (
    <View>
      <Swipe flat onClose={() => actions.onClose(whole)} disabled={whole.sessions.length === 0}>
        <SidebarRow tabHead title={tabName(tab) ?? `Tab ${number}`} number={number} onLongPress={() => actions.onMenu(whole)} />
      </Swipe>
      {tab.items.map(row)}
    </View>
  );
}

// A sidebar row's geometry: an icon per level, each sub-agent a level in from its parent.
const ICON = 20;
const STEP = 20;
const PAD = 12;
const levelX = (indent: number, level: number) => PAD + (indent + level - 1) * STEP + ICON / 2;

/**
 * One line of the sidebar: an agent or terminal (`session`), a split tab's
 * name (`tabHead`) or a desktop panel (`mod`), with its status at the end.
 */
function SidebarRow({
  session,
  title,
  hint,
  number,
  branch,
  indent = 0,
  tabHead,
  mod,
  onPress,
  onLongPress,
}: {
  session?: Session;
  title: string;
  hint?: string | null;
  number?: number;
  branch?: Branch;
  indent?: number;
  tabHead?: boolean;
  mod?: boolean;
  onPress?: () => void;
  onLongPress: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const selected = useLastOpened() === session?.key && !!session;
  const depth = branch?.depth ?? 0;
  const lines = branch ? (
    <View pointerEvents="none" style={styles.s_branches}>
      {branch.through.map((on, l) => (on ? <View key={l} style={[styles.s_trunk, { left: levelX(indent, l + 1) }]} /> : null))}
      {depth > 0 && !branch.last ? <View style={[styles.s_trunk, { left: levelX(indent, depth) }]} /> : null}
      {depth > 0 ? <View style={[styles.s_bend, { left: levelX(indent, depth), width: STEP - ICON / 2 - 2 }]} /> : null}
      {branch.parent ? <View style={[styles.s_stem, { left: levelX(indent, depth + 1), top: "50%", marginTop: ICON / 2 }]} /> : null}
    </View>
  ) : null;
  const icon = session ? (
    session.terminal.status ? (
      <AgentAvatar session={session} size={ICON + 2} />
    ) : (
      <Ionicons name="terminal-outline" size={16} color={colors.onSurfaceVariant} />
    )
  ) : (
    <Ionicons name={mod ? "grid-outline" : "albums-outline"} size={16} color={colors.onSurfaceVariant} />
  );
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityHint="Hold for options"
      style={({ pressed }) => [styles.s_row, { paddingLeft: PAD + (indent + depth) * STEP }, selected && styles.s_selected, pressed && !selected && styles.s_pressed]}
    >
      {lines}
      <View style={styles.s_icon}>{icon}</View>
      <Text style={[styles.s_title, (tabHead || mod) && styles.s_dim, depth > 0 && styles.s_subTitle]} numberOfLines={1}>
        {title}
        {hint ? <Text style={styles.s_hint}>{`  ${hint}`}</Text> : null}
      </Text>
      {mod && <Text style={styles.s_meta}>desktop</Text>}
      {number !== undefined && !session?.terminal.status && <Text style={styles.s_meta}>{number}</Text>}
      {session?.terminal.status ? <StatusMark session={session} size={18} /> : null}
    </Pressable>
  );
}

const REVEAL = 96; // how far the row slides to show Close
const TRIGGER = 72; // past this, letting go asks to close

/** Slide a row left to show Close; let go past the mark and it asks first. */
export function Swipe({ children, onClose, disabled, nested, flat }: { children: ReactNode; onClose: () => void; disabled?: boolean; nested?: boolean; flat?: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  const x = useRef(new Animated.Value(0)).current;
  const latest = useRef({ onClose, disabled });
  latest.current = { onClose, disabled };
  const settle = () => Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  const pan = useRef(
    PanResponder.create({
      // Only a clearly sideways drag to the left: vertical ones keep scrolling the list.
      onMoveShouldSetPanResponder: (_e, g) => !latest.current.disabled && g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => x.setValue(Math.max(-REVEAL * 1.4, Math.min(0, g.dx))),
      onPanResponderRelease: (_e, g) => {
        settle();
        if (g.dx <= -TRIGGER) latest.current.onClose();
      },
      onPanResponderTerminate: settle,
    }),
  ).current;
  const reveal = x.interpolate({ inputRange: [-REVEAL, -24, 0], outputRange: [1, 0.4, 0], extrapolate: "clamp" });
  return (
    <View style={styles.swipe}>
      <Animated.View style={[styles.swipeAction, { opacity: reveal }]}>
        <Ionicons name="close" size={20} color={colors.onError} />
        <Text style={styles.swipeText}>Close</Text>
      </Animated.View>
      <Animated.View style={[flat ? styles.swipeRowFlat : nested ? styles.swipeRowNested : styles.swipeRow, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

type RowProps = { nested?: boolean; branch?: Branch; hint?: string | null; onPress: () => void; onLongPress: () => void };

// The tree's geometry: a top-level row's avatar is 40 wide, a child's 32. Each
// level's line runs down the middle of its parent's avatar and bends into the
// row, a little short of the child's avatar.
const TOP_AVATAR = 40;
const CHILD_AVATAR = 32;
const BEND = 16;
const lineX = (pad: number, depth: number) => pad + TOP_AVATAR / 2 + (depth - 1) * CHILD_AVATAR;
const rowPad = (nested: boolean) => (nested ? gap.md : gap.lg);
const avatarSize = (depth: number) => (depth > 0 ? CHILD_AVATAR : TOP_AVATAR);
/** Where a top-level row's text starts: a card's dividers start there too. */
export const TEXT_INSET = gap.lg + TOP_AVATAR + gap.lg;

/** A row's place in the tree: indented by depth, with the connector lines drawn in its left gutter. */
function useBranch(branch: Branch | undefined, nested: boolean) {
  const styles = useStyles();
  const pad = rowPad(nested);
  const depth = branch?.depth ?? 0;
  const style = depth > 0 ? [styles.child, { paddingLeft: lineX(pad, depth) + BEND }] : null;
  const lines = branch ? (
    <View pointerEvents="none" style={styles.branches}>
      {branch.through.map((on, l) => (on ? <View key={l} style={[styles.trunk, { left: lineX(pad, l + 1) }]} /> : null))}
      {depth > 0 && !branch.last ? <View style={[styles.trunk, { left: lineX(pad, depth) }]} /> : null}
      {depth > 0 ? <View style={[styles.bend, { left: lineX(pad, depth), width: BEND - gap.xs }]} /> : null}
      {branch.parent ? <View style={[styles.stem, { left: lineX(pad, depth + 1), top: "50%", marginTop: avatarSize(depth) / 2 }]} /> : null}
    </View>
  ) : null;
  return { style, lines, size: avatarSize(depth) };
}

/** The space a row runs in, ahead of what it says; `textFirst` puts what it says ahead, so a long hint can't cut it off. */
function Supporting({ hint, text, style, textFirst }: { hint?: string | null; text?: string | null; style?: StyleProp<TextStyle>; textFirst?: boolean }) {
  const styles = useStyles();
  if (!hint && !text) return null;
  const where = hint ? <Text style={styles.hint}>{hint}</Text> : null;
  return (
    <Text style={[styles.msg, style]} numberOfLines={1}>
      {textFirst ? text : where}
      {hint && text ? " · " : null}
      {textFirst ? where : text}
    </Text>
  );
}

/**
 * `urgentFirst`: an agent that needs you says why ahead of the hint.
 * `changedAt`: the time the age counts from, when not the agent's own last change (the inbox row's sort time).
 * `trailing` sits under the time, at the end of the second line (the inbox's subagents chip).
 */
export function AgentRow({
  session,
  nested = false,
  branch,
  hint,
  urgentFirst,
  trailing,
  changedAt,
  title: named,
  onPress,
  onLongPress,
}: RowProps & { session: Session; urgentFirst?: boolean; trailing?: ReactNode; changedAt?: number; title?: string | null }) {
  const styles = useStyles();
  const tree = useBranch(branch, nested);
  const sub = (branch?.depth ?? 0) > 0;
  const t = session.terminal;
  const title = named || agentTitle(session);
  const msg = t.status?.msg && !title.includes(t.status.msg) ? t.status.msg : null;
  const blocked = t.status?.state === "blocked" || t.status?.state === "error";
  const selected = useLastOpened() === session.key;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.row, nested && styles.nested, tree.style, selected && styles.selected, pressed && (nested ? styles.nestedPressed : styles.pressed)]}
    >
      {tree.lines}
      <AgentAvatar session={session} size={tree.size} />
      <View style={styles.text}>
        <Text style={sub ? styles.subTitle : styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Supporting hint={hint} text={msg} style={blocked && styles.blocked} textFirst={urgentFirst && blocked} />
      </View>
      <View style={styles.trailing}>
        <View style={styles.trailingTop}>
          <Text style={styles.age}>{ago(changedAt ?? t.status_ms ?? t.created_ms)}</Text>
          <StatusMark session={session} />
        </View>
        {trailing}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  list: { gap: gap.md },
  head: { flexDirection: "row", alignItems: "center", minHeight: 40, paddingLeft: PAD },
  headTitle: { flex: 1, minHeight: 40, flexDirection: "row", alignItems: "center", gap: gap.sm, borderRadius: shape.small },
  headPressed: { opacity: 0.6 },
  name: { ...emphasized.labelLarge, color: colors.onSurfaceVariant, flexShrink: 1 },
  machine: { ...typography.labelMedium, color: colors.onSurfaceVariant, opacity: 0.8, flexShrink: 1 },
  looseHead: { paddingVertical: gap.sm },
  grow: { flex: 1 },
  count: { ...typography.labelMedium, color: colors.onSurfaceVariant, fontVariant: ["tabular-nums"] },
  s_row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40, paddingRight: PAD, paddingVertical: 6, borderRadius: shape.medium },
  s_icon: { width: ICON + 2, height: ICON + 2, alignItems: "center", justifyContent: "center" },
  s_title: { ...typography.bodyMedium, color: colors.onSurface, flex: 1, minWidth: 0 },
  s_subTitle: { ...typography.bodySmall, fontSize: 13 },
  s_dim: { color: colors.onSurfaceVariant },
  s_hint: { ...typography.bodySmall, color: colors.primary },
  s_meta: { ...typography.labelMedium, color: colors.onSurfaceVariant, fontFamily: fonts.mono, fontWeight: "normal" },
  s_selected: { backgroundColor: colors.secondaryContainer },
  s_pressed: { backgroundColor: colors.surfaceContainerHigh },
  s_branches: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
  s_trunk: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: colors.outlineVariant },
  s_bend: { position: "absolute", top: 0, height: "50%", borderLeftWidth: 1, borderBottomWidth: 1, borderColor: colors.outlineVariant, borderBottomLeftRadius: shape.small },
  s_stem: { position: "absolute", bottom: 0, width: 1, backgroundColor: colors.outlineVariant },
  dim: { color: colors.onSurfaceVariant },
  row: { flexDirection: "row", alignItems: "center", gap: gap.lg, paddingHorizontal: gap.lg, paddingVertical: gap.md, minHeight: 48 },
  nested: { paddingHorizontal: gap.md, paddingVertical: gap.sm },
  child: { paddingVertical: gap.sm },
  branches: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
  trunk: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: colors.outlineVariantSubtle },
  bend: { position: "absolute", top: 0, height: "50%", borderLeftWidth: 1, borderBottomWidth: 1, borderColor: colors.outlineVariantSubtle, borderBottomLeftRadius: shape.small },
  stem: { position: "absolute", bottom: 0, width: 1, backgroundColor: colors.outlineVariantSubtle },
  pressed: { backgroundColor: colors.surfaceContainerHigh },
  nestedPressed: { backgroundColor: colors.surfaceContainerHighest },
  text: { flex: 1, minWidth: 0, gap: 2 },
  trailing: { alignItems: "flex-end", gap: gap.xs },
  trailingTop: { flexDirection: "row", alignItems: "center", gap: gap.sm },
  // The session opened last, as the desktop marks its active tab.
  selected: { backgroundColor: colors.secondaryContainer },
  foldedSummary: { ...typography.labelLarge, flexShrink: 1 },
  title: { ...typography.bodyLarge, color: colors.onSurface },
  subTitle: { ...typography.bodyMedium, color: colors.onSurface },
  msg: { ...typography.bodyMedium, color: colors.onSurfaceVariant },
  path: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 0 },
  blocked: { color: colors.error },
  hint: { color: colors.primary },
  age: { ...typography.labelMedium, color: colors.onSurfaceVariant, fontVariant: ["tabular-nums"] },
  swipe: { overflow: "hidden" },
  swipeAction: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    backgroundColor: colors.error,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: gap.sm,
    paddingRight: gap.xl,
  },
  swipeText: { ...typography.labelLarge, color: colors.onError },
  swipeRow: { backgroundColor: colors.surfaceContainerLow },
  swipeRowNested: { backgroundColor: colors.surfaceContainerHigh },
  swipeRowFlat: { backgroundColor: colors.bg },
  rename: { gap: gap.lg, paddingHorizontal: gap.sm },
}));
