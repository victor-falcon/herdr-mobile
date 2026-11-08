import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState, type ReactNode } from "react";
import { Alert, Animated, PanResponder, Pressable, Text, View } from "react-native";
import { fleet } from "../fleet-store";
import type { Session } from "../hc/fleet";
import { folderName, type Space, type SpaceTab, type TabItem } from "../spaces";
import { Button } from "./Button";
import { confirmClose } from "./close-session";
import { StatusDot } from "./Dot";
import { ago, agentTitle, sessionTitle, shortPath } from "./session-display";
import { Sheet, SheetAction } from "./Sheet";
import { TextField } from "./TextField";
import { makeStyles, fonts, radius, space as gap, useColors } from "./theme";

type Props = {
  spaces: Space[];
  loose: Session[];
  showMachine: boolean;
  onSelect: (s: Session) => void;
  onStart: (space: Space) => void;
};

/** What a row closes and renames: a whole tab, or one pane of a split tab. */
type RowTarget = {
  title: string;
  space: Space | null;
  tab: SpaceTab | null;
  /** The terminals Close ends: the pane or the tab's, with the sub-agents they started. */
  sessions: Session[];
  /** "tab" when closing these closes the tab. */
  scope: "tab" | "pane";
};

type Actions = { onSelect: (s: Session) => void; onMenu: (t: RowTarget) => void; onClose: (t: RowTarget) => void };

/** A session and the sub-agents listed after it. */
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
const tabTitle = (tab: SpaceTab) => (tab.name && !/^\d+$/.test(tab.name) ? tab.name : null);

export function SpaceList({ spaces, loose, showMachine, onSelect, onStart }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const [menu, setMenu] = useState<RowTarget | null>(null);
  const [renaming, setRenaming] = useState<Renaming | null>(null);
  const [spaceMenu, setSpaceMenu] = useState<Space | null>(null);

  const close = (t: RowTarget) => {
    const what = t.scope === "tab" ? "Its programs end and the tab closes on every screen." : "Its program ends and the pane closes on every screen.";
    void confirmClose(t.title, t.sessions, what);
  };
  const actions: Actions = { onSelect, onMenu: setMenu, onClose: close };

  return (
    <View>
      {spaces.map((sp) => (
        <View key={sp.key} style={styles.space}>
          <View style={styles.head}>
            <Pressable
              onLongPress={() => setSpaceMenu(sp)}
              accessibilityRole="button"
              accessibilityHint="Hold for options"
              style={({ pressed }) => [styles.headTitle, pressed && styles.headPressed]}
            >
              <Text style={styles.name} numberOfLines={1}>
                {sp.name}
              </Text>
              {sp.factory && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>factory</Text>
                </View>
              )}
              {showMachine && <Text style={styles.machine}>{sp.target.label}</Text>}
            </Pressable>
            <Pressable
              hitSlop={10}
              onPress={() => onStart(sp)}
              accessibilityRole="button"
              accessibilityLabel={`New tab in ${sp.name}`}
              style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </Pressable>
          </View>
          {sp.tabs.map((tab) => (
            <TabRows key={tab.key} space={sp} tab={tab} actions={actions} />
          ))}
        </View>
      ))}
      {loose.length > 0 && (
        <View style={styles.space}>
          <View style={styles.head}>
            <Text style={[styles.name, styles.dim]}>Not in a space</Text>
          </View>
          {loose.map((s) => {
            const target: RowTarget = { title: agentTitle(s), space: null, tab: null, sessions: [s], scope: "pane" };
            return (
              <Swipe key={s.key} onClose={() => close(target)}>
                <AgentRow session={s} sub={false} onPress={() => onSelect(s)} onLongPress={() => setMenu(target)} />
              </Swipe>
            );
          })}
        </View>
      )}

      <Sheet visible={!!menu} onClose={() => setMenu(null)}>
        {menu && (
          <>
            <View style={styles.menuHead}>
              <Text style={styles.menuTitle} numberOfLines={1}>
                {menu.title}
              </Text>
              {menu.tab && menu.scope === "pane" && <Text style={styles.menuMeta}>A pane of {tabTitle(menu.tab) ?? "a split tab"}</Text>}
            </View>
            {menu.tab && menu.space && (
              <SheetAction
                label="Rename tab"
                detail={tabTitle(menu.tab) ? `Now “${menu.tab.name}”` : "It has no name yet"}
                onPress={() => {
                  const { space, tab } = menu;
                  if (!space || !tab) return;
                  setRenaming({
                    title: "Rename tab",
                    placeholder: "Tab name (empty: its number)",
                    initial: tabTitle(tab) ?? "",
                    save: (name) => fleet.renameTab(space.target, space.id, tab.id, name),
                  });
                  setMenu(null);
                }}
              />
            )}
            {menu.sessions.length > 0 && (
              <SheetAction
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
          </>
        )}
      </Sheet>
      <Sheet visible={!!spaceMenu} onClose={() => setSpaceMenu(null)}>
        {spaceMenu && (
          <>
            <View style={styles.menuHead}>
              <Text style={styles.menuTitle} numberOfLines={1}>
                {spaceMenu.name}
              </Text>
              {!!spaceMenu.folder && <Text style={styles.menuMeta}>{shortPath(spaceMenu.folder)}</Text>}
            </View>
            <SheetAction
              label="Rename space"
              detail={`Now “${spaceMenu.name}”`}
              onPress={() => {
                const sp = spaceMenu;
                setRenaming({
                  title: "Rename space",
                  placeholder: `Space name (empty: ${folderName(sp.folder) || "its folder"})`,
                  initial: sp.name,
                  save: (name) => fleet.renameSpace(sp.target, sp.id, name),
                });
                setSpaceMenu(null);
              }}
            />
          </>
        )}
      </Sheet>
      <RenameSheet renaming={renaming} onClose={() => setRenaming(null)} />
    </View>
  );
}

/** What the rename sheet edits: a tab or a space. */
type Renaming = { title: string; placeholder: string; initial: string; save: (name: string) => Promise<void> };

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
      <View style={styles.rename}>
        <Text style={styles.menuTitle}>{renaming?.title}</Text>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder={renaming?.placeholder}
          autoFocus
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={() => void save()}
          inset
        />
        <Button title="Rename" onPress={() => void save()} loading={saving} />
      </View>
    </Sheet>
  );
}

/** A tab with one pane is one row; a split tab gets its name over its panes. */
function TabRows({ space, tab, actions }: { space: Space; tab: SpaceTab; actions: Actions }) {
  const colors = useColors();
  const styles = useStyles();
  const panes = tab.items.filter((i) => !(i.kind === "session" && i.sub));
  const split = panes.length > 1;
  const whole: RowTarget = { title: tabTitle(tab) ?? "this tab", space, tab, sessions: tabSessions(tab), scope: "tab" };

  const row = (item: TabItem) => {
    if (item.kind === "mod") return <ModRow key={item.key} name={item.name} nested={split} onLongPress={() => actions.onMenu({ ...whole, title: item.name, sessions: [], scope: "pane" })} />;
    const s = item.session;
    const title = s.terminal.status ? agentTitle(s) : sessionTitle(s);
    // Closing a sub-agent ends only it; the only pane of a tab takes the tab with it.
    const target: RowTarget = item.sub
      ? { title, space, tab, sessions: [s], scope: "pane" }
      : split
        ? { title, space, tab, sessions: withSubs(tab, s), scope: "pane" }
        : { ...whole, title };
    const onPress = () => actions.onSelect(s);
    const onLongPress = () => actions.onMenu(target);
    return (
      <Swipe key={s.key} onClose={() => actions.onClose(target)}>
        {s.terminal.status ? (
          <AgentRow session={s} sub={item.sub} nested={split} onPress={onPress} onLongPress={onLongPress} />
        ) : (
          <TerminalRow session={s} name={split ? null : tab.name} nested={split} onPress={onPress} onLongPress={onLongPress} />
        )}
      </Swipe>
    );
  };
  if (!split) return <>{tab.items.map(row)}</>;
  return (
    <View>
      <Swipe onClose={() => actions.onClose(whole)} disabled={whole.sessions.length === 0}>
        <Pressable onLongPress={() => actions.onMenu(whole)} style={({ pressed }) => [styles.tabHead, pressed && styles.rowPressed]}>
          <Ionicons name="albums-outline" size={14} color={colors.muted} />
          <Text style={styles.tabName} numberOfLines={1}>
            {tab.name || "New tab"}
          </Text>
        </Pressable>
      </Swipe>
      {tab.items.map(row)}
    </View>
  );
}

const REVEAL = 96; // how far the row slides to show Close
const TRIGGER = 72; // past this, letting go asks to close

/** Slide a row left to show Close; let go past the mark and it asks first. */
function Swipe({ children, onClose, disabled }: { children: ReactNode; onClose: () => void; disabled?: boolean }) {
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
        <Ionicons name="close-circle-outline" size={18} color={colors.onAccent} />
        <Text style={styles.swipeText}>Close</Text>
      </Animated.View>
      <Animated.View style={[styles.swipeRow, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

type RowProps = { nested?: boolean; onPress: () => void; onLongPress: () => void };

/** A terminal with no agent in it: its program (or the tab's name) and where it is. */
function TerminalRow({ session, name, nested = false, onPress, onLongPress }: RowProps & { session: Session; name: string | null }) {
  const colors = useColors();
  const styles = useStyles();
  const t = session.terminal;
  // A tab Herdr only numbered says nothing: show the program instead.
  const title = name && !/^\d+$/.test(name) ? name : sessionTitle(session);
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="button" style={({ pressed }) => [styles.row, nested && styles.nested, pressed && styles.rowPressed]}>
      <View style={styles.indicator}>
        <Ionicons name="terminal-outline" size={16} color={colors.muted} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {t.cwd ? (
          <Text style={styles.msg} numberOfLines={1}>
            {shortPath(t.cwd)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** A pane the desktop draws itself (files, changes, a viewer): shown, but only there. */
function ModRow({ name, nested, onLongPress }: { name: string; nested: boolean; onLongPress: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable onLongPress={onLongPress} style={({ pressed }) => [styles.row, nested && styles.nested, pressed && styles.rowPressed]}>
      <View style={styles.indicator}>
        <Ionicons name="grid-outline" size={15} color={colors.muted} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.title, styles.dim]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.msg}>Panel on the desktop</Text>
      </View>
    </Pressable>
  );
}

function AgentRow({ session, sub, nested = false, onPress, onLongPress }: RowProps & { session: Session; sub: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  const t = session.terminal;
  const title = agentTitle(session);
  const msg = t.status?.msg && !title.includes(t.status.msg) ? t.status.msg : null;
  const blocked = t.status?.state === "blocked" || t.status?.state === "error";
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, nested && styles.nested, sub && (nested ? styles.nestedChild : styles.child), pressed && styles.rowPressed]}
    >
      <View style={styles.indicator}>
        <StatusDot session={session} size={10} spin />
      </View>
      <View style={styles.flex}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {msg ? (
          <Text style={[styles.msg, blocked && { color: colors.blocked }]} numberOfLines={1}>
            {msg}
          </Text>
        ) : null}
      </View>
      <Text style={styles.age}>{ago(t.status_ms ?? t.created_ms)}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  space: { marginBottom: gap.lg },
  head: { flexDirection: "row", alignItems: "center", gap: gap.sm, paddingHorizontal: gap.sm, minHeight: 36 },
  headTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: gap.sm, alignSelf: "stretch", borderRadius: radius.sm },
  headPressed: { opacity: 0.6 },
  name: { color: colors.text, fontSize: 15, fontWeight: "700", fontFamily: fonts.mono, flexShrink: 1 },
  dim: { color: colors.muted },
  tag: { borderRadius: radius.sm, backgroundColor: colors.accent + "26", paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { color: colors.accent, fontSize: 10, fontWeight: "700" },
  machine: { color: colors.muted, fontSize: 12 },
  flex: { flex: 1 },
  add: { width: 32, height: 32, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  addPressed: { backgroundColor: colors.surfaceHigh },
  row: { flexDirection: "row", alignItems: "center", gap: gap.md, paddingLeft: gap.sm, paddingRight: gap.sm, paddingVertical: gap.md, borderRadius: radius.md },
  child: { paddingLeft: gap.xl + gap.sm },
  nested: { paddingLeft: gap.xl },
  nestedChild: { paddingLeft: gap.xl * 2 },
  tabHead: { flexDirection: "row", alignItems: "center", gap: gap.sm, paddingHorizontal: gap.sm, paddingTop: gap.sm, paddingBottom: gap.xs, borderRadius: radius.md },
  tabName: { color: colors.muted, fontSize: 13, fontWeight: "600", flexShrink: 1 },
  rowPressed: { backgroundColor: colors.surface },
  indicator: { width: 20, alignItems: "center" },
  title: { color: colors.text, fontSize: 15 },
  msg: { color: colors.muted, fontSize: 13, marginTop: 2 },
  age: { color: colors.muted, fontSize: 12, fontFamily: fonts.mono },
  swipe: { borderRadius: radius.md, overflow: "hidden" },
  swipeAction: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    borderRadius: radius.md,
    backgroundColor: colors.blocked,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: gap.xs,
    paddingRight: gap.lg,
  },
  swipeText: { color: colors.onAccent, fontSize: 14, fontWeight: "700" },
  swipeRow: { backgroundColor: colors.bg },
  menuHead: { paddingHorizontal: 14, paddingBottom: gap.md, gap: 4 },
  menuTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  menuMeta: { color: colors.muted, fontSize: 13 },
  rename: { paddingHorizontal: 6, paddingBottom: gap.md, gap: gap.md },
}));
