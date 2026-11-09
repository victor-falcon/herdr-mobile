// Everything that types into a terminal: the key bar, direct typing through a
// hidden field, and the message composer. Raw bytes go on the attach stream
// (instant, and hc's "someone is typing" hold doesn't apply to them); before it
// is attached, keys and text go through hc instead.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react";
import { ActivityIndicator, Alert, Keyboard, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { utf8Encode } from "../hc/bytes";
import { HcError, type HcConnection } from "../hc/connection";
import { updateSettings, useSettings } from "../settings";
import type { IconName } from "../ui/icons";
import { corners, MorphPressable, type Corners } from "../ui/press";
import { fonts, makeStyles, shape, space, typography, useColors } from "../ui/theme";
import { CLUSTER_START, KEY_ROWS, hcKeyName, keyBytes, type BarKey } from "./keys";
import type { TerminalHandle } from "./TerminalView";
import { enterSends, SEND_DELAY_MS, withoutTypedNewline, type Change } from "./composer";
import { typedText, withCtrl } from "./typing";

export type TerminalInputHandle = { openKeyboard(): void };

type Props = {
  /** Resets typing state when it changes. */
  sessionKey: string;
  route: { conn: HcConnection; address: string };
  terminal: RefObject<TerminalHandle | null>;
  keyboardHeight: number;
};

const NAMED: Record<string, string> = { " ": "space", "\x7f": "backspace", "\r": "enter" };

export const TerminalInput = forwardRef<TerminalInputHandle, Props>(function TerminalInput({ sessionKey, route, terminal, keyboardHeight }, ref) {
  const colors = useColors();
  const styles = useStyles();
  const settings = useSettings();
  const insets = useSafeAreaInsets();
  const message = settings.inputMode === "message";
  const [ctrl, setCtrl] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const capture = useRef<TextInput>(null);
  const composer = useRef<TextInput>(null);
  const mirror = useRef("");
  const latest = useRef("");
  const lastChange = useRef<Change | null>(null);
  const pendingSend = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fail = (e: unknown) => Alert.alert("Could not reach it", e instanceof Error ? e.message : String(e));
  const call = (method: string, params: object) => route.conn.call(method, { terminal: route.address, ...params });

  const resetMirror = () => {
    mirror.current = "";
    capture.current?.clear();
  };

  const cancelPendingSend = () => {
    if (pendingSend.current) clearTimeout(pendingSend.current);
    pendingSend.current = null;
  };

  const changeText = (next: string) => {
    latest.current = next;
    setText(next);
  };

  useEffect(() => {
    cancelPendingSend();
    changeText("");
    lastChange.current = null;
    setCtrl(false);
    resetMirror();
  }, [sessionKey]);

  useEffect(() => cancelPendingSend, []);

  /** Bytes to the terminal; false when it is not attached yet. */
  const write = (chars: string) => {
    terminal.current?.scrollToBottom();
    return !!terminal.current?.write(utf8Encode(chars));
  };

  const pressKey = (name: string) => {
    resetMirror();
    if (name === "paste") return void paste();
    if (ctrl && name.length === 1) {
      setCtrl(false);
      name = `ctrl+${name}`;
    }
    if (!write(keyBytes(name, terminal.current?.appCursor() ?? false))) call("terminal.keys", { keys: [hcKeyName(name)] }).catch(fail);
  };

  const typeRaw = (chars: string) => {
    if (!chars) return;
    let out = chars;
    const control = ctrl ? withCtrl(out) : null;
    if (control !== null) {
      out = control;
      setCtrl(false);
    }
    if (!write(out)) call("terminal.keys", { keys: [...out].map((c) => NAMED[c] ?? c) }).catch(fail);
  };

  // The clipboard as one paste: wrapped when the program asked for bracketed
  // paste, so a multi-line paste doesn't run line by line.
  const paste = async () => {
    const clip = (await Clipboard.getStringAsync()).replace(/\r?\n/g, "\r");
    if (!clip) return;
    const wrapped = terminal.current?.bracketedPaste() ? `\x1b[200~${clip}\x1b[201~` : clip;
    if (!write(wrapped)) call("terminal.send", { text: clip }).catch(fail);
  };

  const onCaptureChange = (next: string) => {
    const out = typedText(mirror.current, next);
    mirror.current = next;
    typeRaw(out);
    // The line went to the terminal: start the mirror over.
    if (out.includes("\r")) resetMirror();
  };

  // The keyboard's own Enter is an action key on Android (✓ or ⏎); it submits
  // instead of typing a newline.
  const onCaptureSubmit = () => {
    typeRaw("\r");
    resetMirror();
  };

  const send = async (message: string, force = false) => {
    cancelPendingSend();
    const body = message.trimEnd();
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await call("terminal.send", { text: body, force });
      changeText("");
    } catch (e) {
      if (!force && e instanceof HcError && /block/i.test(`${e.kind} ${e.message}`)) {
        Alert.alert("It is waiting on a question", "Typing now may answer its dialog.", [
          { text: "Cancel", style: "cancel" },
          { text: "Send anyway", onPress: () => void send(body, true) },
        ]);
      } else fail(e);
    } finally {
      setSending(false);
    }
  };

  // Enter types a newline, and a lone newline the user typed sends. Dictation
  // apps paste line breaks as Enter too, but right after or right before a burst
  // of text; those stay as newlines in the message.
  const onMessageChange = (next: string) => {
    const now = Date.now();
    const prev = latest.current;
    cancelPendingSend();
    const message = withoutTypedNewline(prev, next);
    if (message !== null && enterSends(lastChange.current, now)) {
      pendingSend.current = setTimeout(() => void send(message), SEND_DELAY_MS);
    }
    lastChange.current = { at: now, grew: next.length - prev.length };
    changeText(next);
  };

  // Android keeps a hidden field focused after the keyboard is dismissed; blur
  // first so focusing opens the keyboard again.
  const openKeyboard = () => {
    if (message) return;
    const input = capture.current;
    if (!input) return;
    if (input.isFocused()) {
      input.blur();
      setTimeout(() => input.focus(), 60);
    } else input.focus();
  };

  useImperativeHandle(ref, () => ({ openKeyboard }));

  const toggleKeyboard = () => {
    if (keyboardHeight === 0) return openKeyboard();
    capture.current?.blur();
    Keyboard.dismiss();
  };

  const setMode = (next: "direct" | "message") => {
    resetMirror();
    setCtrl(false);
    void updateSettings({ inputMode: next });
    if (next === "direct") setTimeout(openKeyboard, 80);
  };

  const bottom = keyboardHeight ? 0 : insets.bottom;

  const slot = (k: BarKey, shapeOf?: Corners) => (
    <BarSlot
      key={k.key}
      slot={k}
      shapeOf={shapeOf}
      message={message}
      ctrl={ctrl}
      keyboardOpen={keyboardHeight > 0}
      onMode={() => setMode(message ? "direct" : "message")}
      onCtrl={() => setCtrl((c) => !c)}
      onKeyboard={toggleKeyboard}
      onKey={pressKey}
    />
  );

  return (
    <View style={styles.panel}>
      <View style={styles.keys}>
        {KEY_ROWS.map((row, r) => (
          <View key={r} style={styles.keyRow}>
            {row.slice(0, CLUSTER_START).map((k) => slot(k))}
            <View style={styles.cluster}>
              {row.slice(CLUSTER_START).map((k, i, cluster) => slot(k, clusterCorners(r, i, cluster.length, KEY_ROWS.length)))}
            </View>
          </View>
        ))}
      </View>
      {message ? (
        <View style={[styles.composer, { paddingBottom: bottom }]}>
          {/* The pill holds the padding (Android drops a TextInput's own) and focuses the field anywhere in it. */}
          <Pressable style={styles.field} onPress={() => composer.current?.focus()} accessible={false}>
            <TextInput
              ref={composer}
              style={styles.input}
              value={text}
              onChangeText={onMessageChange}
              placeholder="Message"
              placeholderTextColor={colors.onSurfaceVariant}
              autoCorrect
              spellCheck
              multiline
              submitBehavior="newline"
            />
          </Pressable>
          <SendButton busy={sending} disabled={!text.trim()} onPress={() => void send(text)} />
        </View>
      ) : (
        <View style={{ height: bottom }}>
          <TextInput
            ref={capture}
            style={styles.capture}
            defaultValue=""
            onChangeText={onCaptureChange}
            onSubmitEditing={onCaptureSubmit}
            submitBehavior="submit"
            returnKeyType="send"
            onKeyPress={(e) => e.nativeEvent.key === "Backspace" && mirror.current === "" && typeRaw("\x7f")}
            multiline
            autoCapitalize="none"
            autoCorrect
            autoComplete="off"
            spellCheck
            importantForAutofill="no"
            caretHidden
          />
        </View>
      )}
    </View>
  );
});

const ICONS: Partial<Record<string, IconName>> = {
  paste: "clipboard-outline",
  enter: "return-down-back",
  up: "arrow-up",
  down: "arrow-down",
  left: "arrow-back",
  right: "arrow-forward",
};

/**
 * The arrow cluster is one connected group over two rows: tight inner corners,
 * and the group's own four outer corners on the keys at its corners. The
 * shared segmentCorners joins a single row, so it can't say this.
 */
function clusterCorners(row: number, index: number, count: number, rows: number): Corners {
  const [tl, tr, br, bl] = corners(CLUSTER_INNER);
  const top = row === 0;
  const bottom = row === rows - 1;
  const left = index === 0;
  const right = index === count - 1;
  return [top && left ? CLUSTER_OUTER : tl, top && right ? CLUSTER_OUTER : tr, bottom && right ? CLUSTER_OUTER : br, bottom && left ? CLUSTER_OUTER : bl];
}

/** One slot of the key bar: the bar's own controls, or a key it sends. */
function BarSlot({ slot, shapeOf, message, ctrl, keyboardOpen, onMode, onCtrl, onKeyboard, onKey }: {
  slot: BarKey;
  shapeOf?: Corners;
  message: boolean;
  ctrl: boolean;
  keyboardOpen: boolean;
  onMode: () => void;
  onCtrl: () => void;
  onKeyboard: () => void;
  onKey: (key: string) => void;
}) {
  switch (slot.key) {
    case "mode":
      return <Key icon={message ? "terminal-outline" : "chatbox-outline"} accessibilityLabel={message ? "Type directly" : "Write a message"} onPress={onMode} />;
    case "ctrl":
      return <Key label="ctrl" active={ctrl} onPress={onCtrl} />;
    case "keyboard":
      // Always in its slot so no key moves; the composer has its own keyboard.
      return <Key icon={keyboardOpen ? "chevron-down-outline" : "keypad-outline"} accessibilityLabel={keyboardOpen ? "Hide keyboard" : "Open keyboard"} disabled={message} onPress={onKeyboard} />;
    default: {
      const icon = ICONS[slot.key];
      const name = slot.key === "paste" ? "Paste" : slot.label;
      return <Key shapeOf={shapeOf} label={slot.label} icon={icon} accessibilityLabel={icon ? name : slot.spoken} tonal={slot.arrow} onPress={() => onKey(slot.key)} />;
    }
  }
}

const KEY_RADIUS = 14;
const KEY_ON_RADIUS = shape.small;
const CLUSTER_OUTER = shape.large;
const CLUSTER_INNER = 6;
const CLUSTER_GAP = 4;
/** Keys, the composer field and the send button are all this tall. */
const CONTROL = 48;

/** Pressed, a key's corners spring to about half: Material 3 Expressive's press morph. */
function pressedCorners([tl, tr, br, bl]: Corners): Corners {
  const half = (r: number) => Math.max(3, Math.round(r / 2));
  return [half(tl), half(tr), half(br), half(bl)];
}

/** A key of the bar: plain, tonal for arrows, primary and squared off when a toggle is on. */
function Key({ label = "", icon, onPress, active, tonal, disabled, shapeOf, accessibilityLabel }: {
  label?: string;
  icon?: IconName;
  onPress: () => void;
  active?: boolean;
  tonal?: boolean;
  disabled?: boolean;
  /** Corner radii, for keys in the arrow cluster. */
  shapeOf?: Corners;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const styles = useStyles();
  const ink = active ? colors.onPrimary : tonal ? colors.onSecondaryContainer : colors.onSurface;
  const fill = active ? colors.primary : tonal ? colors.secondaryContainer : colors.surfaceContainerHighest;
  const rest = shapeOf ?? corners(active ? KEY_ON_RADIUS : KEY_RADIUS);
  return (
    <MorphPressable
      rest={rest}
      pressed={pressedCorners(rest)}
      ink={ink}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!active }}
      style={styles.key}
      surface={[styles.keySurface, { backgroundColor: fill, opacity: disabled ? 0.38 : 1 }]}
    >
      {icon ? <Ionicons name={icon} size={20} color={ink} /> : <Text style={[styles.keyText, { color: ink }, /^\d$/.test(label) && styles.keyDigit, !/[a-z\d]/i.test(label) && styles.keySymbol]}>{label}</Text>}
    </MorphPressable>
  );
}

/** The composer's 48px filled round send button, with a spinner while it sends. */
function SendButton({ busy, disabled, onPress }: { busy: boolean; disabled: boolean; onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <MorphPressable
      rest={corners(CONTROL / 2)}
      pressed={corners(shape.medium)}
      ink={colors.onPrimary}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityLabel="Send"
      accessibilityState={{ busy }}
      surface={[styles.send, { opacity: disabled && !busy ? 0.38 : 1 }]}
    >
      {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="arrow-up" size={24} color={colors.onPrimary} />}
    </MorphPressable>
  );
}

const KEY_GAP = 6;

const useStyles = makeStyles((colors) => ({
  // Docked under the terminal, never over it.
  panel: {
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: shape.extraLarge,
    borderTopRightRadius: shape.extraLarge,
    paddingTop: space.md,
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
  },
  keys: { gap: KEY_GAP },
  keyRow: { flexDirection: "row", gap: KEY_GAP },
  cluster: { flex: 3, minWidth: 0, flexDirection: "row", gap: CLUSTER_GAP, marginLeft: KEY_GAP },
  key: { flex: 1, minWidth: 0 },
  keySurface: { height: CONTROL },
  keyText: { fontSize: 13, fontFamily: fonts.monoMedium, fontWeight: "normal" },
  keyDigit: { fontSize: 15 },
  // Symbol-only labels like ⇧⏎ fall back to a thin font that reads small at 13.
  keySymbol: { fontSize: 20 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, paddingTop: space.md },
  field: {
    flex: 1,
    minHeight: CONTROL,
    justifyContent: "center",
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: CONTROL / 2,
    paddingHorizontal: 20,
    paddingVertical: space.md,
  },
  input: { ...typography.bodyLarge, maxHeight: 96, padding: 0, color: colors.onSurface },
  send: { width: CONTROL, height: CONTROL, backgroundColor: colors.primary },
  capture: { position: "absolute", left: 0, top: 0, width: 1, height: 1, opacity: 0, color: "transparent" },
}));
