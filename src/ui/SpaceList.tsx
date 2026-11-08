import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState, type ReactNode } from "react";
import { Alert, Animated, PanResponder, Pressable, Text, View } from "react-native";
import { fleet } from "../fleet-store";
import type { Session } from "../hc/fleet";
import { folderName, type Space, type SpaceTab, type TabItem } from "../spaces";
import { Avatar, StatusAvatar } from "./Avatar";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { confirmClose } from "./close-session";
import { Card } from "./Group";
import { IconButton } from "./IconButton";
import { ago, agentTitle, sessionTitle, shortPath } from "./session-display";
import { Sheet, SheetAction, SheetActions, SheetHeader } from "./Sheet";
import { TextField } from "./TextField";
import { emphasized, fonts, makeStyles, shape, space as gap, typography, useColors } from "./theme";

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
  /** What the menu's avatar shows: the row's session, a desktop panel or a split tab. */
  lead: Session | "mod" | "tab";
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
    <View style={styles.list}>
      {spaces.map((sp) => {
        const where = [showMachine ? sp.target.label : "", sp.folder ? shortPath(sp.folder) : ""].filter(Boolean).join(" · ");
        return (
          <View key={sp.key} style={styles.space}>
            <View style={styles.head}>
              <Pressable
                onLongPress={() => setSpaceMenu(sp)}
                accessibilityRole="button"
                accessibilityHint="Hold for options"
                style={({ pressed }) => [styles.headTitle, pressed && styles.headPressed]}
              >
                <View style={styles.nameLine}>
                  <Text style={styles.name} numberOfLines={1}>
                    {sp.name}
                  </Text>
                  {sp.factory && <Chip label="factory" />}
                </View>
                {where ? (
                  <Text style={styles.where} numberOfLines={1}>
                    {where}
                  </Text>
                ) : null}
              </Pressable>
              <IconButton icon="add" variant="tonal" size={48} label={`New tab in ${sp.name}`} onPress={() => onStart(sp)} />
            </View>
            {sp.tabs.length > 0 && (
              <Card>
                {sp.tabs.map((tab) => (
                  <TabRows key={tab.key} space={sp} tab={tab} actions={actions} />
                ))}
              </Card>
            )}
          </View>
        );
      })}
      {loose.length > 0 && (
        <View style={styles.space}>
          <View style={[styles.head, styles.looseHead]}>
            <Text style={[styles.name, styles.dim]} accessibilityRole="header">
              Not in a space
            </Text>
          </View>
          <Card>
            {loose.map((s) => {
              const target: RowTarget = { title: agentTitle(s), space: null, tab: null, sessions: [s], scope: "pane", lead: s };
              return (
                <Swipe key={s.key} onClose={() => close(target)}>
                  <AgentRow session={s} sub={false} onPress={() => onSelect(s)} onLongPress={() => setMenu(target)} />
                </Swipe>
              );
            })}
          </Card>
        </View>
      )}

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
                      placeholder: "Leave empty to use its number",
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
      <Sheet visible={!!spaceMenu} onClose={() => setSpaceMenu(null)}>
        {spaceMenu && (
          <>
            <SheetHeader title={spaceMenu.name} meta={spaceMenu.folder ? shortPath(spaceMenu.folder) : undefined} icon="folder-outline" />
            <SheetActions>
              <SheetAction
                icon="pencil"
                label="Rename space"
                detail={`Now “${spaceMenu.name}”`}
                onPress={() => {
                  const sp = spaceMenu;
                  setRenaming({
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
      <RenameSheet renaming={renaming} onClose={() => setRenaming(null)} />
    </View>
  );
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

/** A tab with one pane is one block of rows; a split tab gets an inner container with its name over its panes. */
function TabRows({ space, tab, actions }: { space: Space; tab: SpaceTab; actions: Actions }) {
  const colors = useColors();
  const styles = useStyles();
  const panes = tab.items.filter((i) => !(i.kind === "session" && i.sub));
  const split = panes.length > 1;
  const whole: RowTarget = { title: tabTitle(tab) ?? "this tab", space, tab, sessions: tabSessions(tab), scope: "tab", lead: "tab" };

  const row = (item: TabItem) => {
    if (item.kind === "mod")
      return <ModRow key={item.key} name={item.name} nested={split} onLongPress={() => actions.onMenu({ ...whole, title: item.name, sessions: [], scope: "pane", lead: "mod" })} />;
    const s = item.session;
    const title = s.terminal.status ? agentTitle(s) : sessionTitle(s);
    // Closing a sub-agent ends only it; the only pane of a tab takes the tab with it.
    const target: RowTarget = item.sub
      ? { title, space, tab, sessions: [s], scope: "pane", lead: s }
      : split
        ? { title, space, tab, sessions: withSubs(tab, s), scope: "pane", lead: s }
        : { ...whole, title, lead: s };
    const onPress = () => actions.onSelect(s);
    const onLongPress = () => actions.onMenu(target);
    return (
      <Swipe key={s.key} nested={split} onClose={() => actions.onClose(target)}>
        {s.terminal.status ? (
          <AgentRow session={s} sub={item.sub} nested={split} onPress={onPress} onLongPress={onLongPress} />
        ) : (
          <TerminalRow session={s} name={split ? null : tab.name} nested={split} onPress={onPress} onLongPress={onLongPress} />
        )}
      </Swipe>
    );
  };
  if (!split) return <View>{tab.items.map(row)}</View>;
  return (
    <View style={styles.splitOuter}>
      <View style={styles.split}>
        <Swipe nested onClose={() => actions.onClose(whole)} disabled={whole.sessions.length === 0}>
          <Pressable onLongPress={() => actions.onMenu(whole)} accessibilityHint="Hold for options" style={({ pressed }) => [styles.tabHead, pressed && styles.nestedPressed]}>
            <Ionicons name="albums-outline" size={20} color={colors.onSurfaceVariant} />
            <Text style={styles.tabName} numberOfLines={1}>
              {tab.name || "New tab"}
            </Text>
          </Pressable>
        </Swipe>
        {tab.items.map(row)}
      </View>
    </View>
  );
}

const REVEAL = 96; // how far the row slides to show Close
const TRIGGER = 72; // past this, letting go asks to close

/** Slide a row left to show Close; let go past the mark and it asks first. */
function Swipe({ children, onClose, disabled, nested }: { children: ReactNode; onClose: () => void; disabled?: boolean; nested?: boolean }) {
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
      <Animated.View style={[nested ? styles.swipeRowNested : styles.swipeRow, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
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
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="button" style={({ pressed }) => [styles.row, nested && styles.nested, pressed && (nested ? styles.nestedPressed : styles.pressed)]}>
      <Avatar icon="terminal-outline" color={colors.onSurfaceVariant} background={colors.surfaceContainerHighest} />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {t.cwd ? (
          <Text style={[styles.msg, styles.path]} numberOfLines={1}>
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
    <Pressable onLongPress={onLongPress} style={({ pressed }) => [styles.row, nested && styles.nested, pressed && (nested ? styles.nestedPressed : styles.pressed)]}>
      <Avatar icon="grid-outline" color={colors.onSurfaceVariant} background={nested ? colors.surfaceContainerLow : colors.surfaceContainerHighest} />
      <View style={styles.text}>
        <Text style={[styles.title, styles.dim]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.msg}>Panel on the desktop</Text>
      </View>
    </Pressable>
  );
}

function AgentRow({ session, sub, nested = false, onPress, onLongPress }: RowProps & { session: Session; sub: boolean }) {
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
      style={({ pressed }) => [styles.row, nested && styles.nested, sub && (nested ? styles.nestedChild : styles.child), pressed && (nested ? styles.nestedPressed : styles.pressed)]}
    >
      <StatusAvatar session={session} size={sub ? 32 : 40} />
      <View style={styles.text}>
        <Text style={sub ? styles.subTitle : styles.title} numberOfLines={1}>
          {title}
        </Text>
        {msg ? (
          <Text style={[styles.msg, blocked && styles.blocked]} numberOfLines={1}>
            {msg}
          </Text>
        ) : null}
      </View>
      <Text style={styles.age}>{ago(t.status_ms ?? t.created_ms)}</Text>
    </Pressable>
  );
}

// How far sub-agents are indented, in a card and inside a split tab (from the design).
const CHILD = 44;
const NESTED_CHILD = 40;

const useStyles = makeStyles((colors) => ({
  list: { gap: gap.xl },
  space: { gap: gap.sm },
  head: { flexDirection: "row", alignItems: "center", gap: gap.sm, paddingLeft: gap.sm },
  looseHead: { minHeight: 48 },
  headTitle: { flex: 1, gap: 2, alignSelf: "stretch", justifyContent: "center", borderRadius: shape.small },
  headPressed: { opacity: 0.6 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: gap.sm },
  name: { ...emphasized.titleLarge, color: colors.onSurface, flexShrink: 1 },
  where: { ...typography.labelMedium, color: colors.onSurfaceVariant },
  dim: { color: colors.onSurfaceVariant },
  row: { flexDirection: "row", alignItems: "center", gap: gap.lg, paddingHorizontal: gap.lg, paddingVertical: gap.md, minHeight: 48 },
  child: { paddingLeft: CHILD, paddingTop: gap.xs },
  nested: { paddingHorizontal: gap.md, paddingVertical: gap.sm },
  nestedChild: { paddingLeft: NESTED_CHILD, paddingTop: 0 },
  pressed: { backgroundColor: colors.surfaceContainerHigh },
  nestedPressed: { backgroundColor: colors.surfaceContainerHighest },
  splitOuter: { padding: gap.sm },
  split: { borderRadius: shape.large, backgroundColor: colors.surfaceContainerHigh, overflow: "hidden", paddingBottom: gap.xs },
  tabHead: { flexDirection: "row", alignItems: "center", gap: gap.sm, minHeight: 40, paddingHorizontal: gap.md, paddingTop: 10, paddingBottom: 2 },
  tabName: { ...emphasized.titleSmall, color: colors.onSurfaceVariant, flexShrink: 1 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...typography.bodyLarge, color: colors.onSurface },
  subTitle: { ...typography.bodyMedium, color: colors.onSurface },
  msg: { ...typography.bodyMedium, color: colors.onSurfaceVariant },
  path: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 0 },
  blocked: { color: colors.error },
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
  rename: { gap: gap.lg, paddingHorizontal: gap.sm },
}));
