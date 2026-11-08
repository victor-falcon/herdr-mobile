// Everything that types into a terminal: the key bar, direct typing through a
// hidden field, and the message composer. Raw bytes go on the attach stream
// (instant, and hc's "someone is typing" hold doesn't apply to them); before it
// is attached, keys and text go through hc instead.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react";
import { Alert, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { utf8Encode } from "../hc/bytes";
import { HcError, type HcConnection } from "../hc/connection";
import { updateSettings, useSettings } from "../settings";
import { makeStyles, fonts, radius, space, useColors } from "../ui/theme";
import { CLUSTER_START, KEY_ROWS, keyBytes, type BarKey } from "./keys";
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
    if (!write(keyBytes(name, terminal.current?.appCursor() ?? false))) call("terminal.keys", { keys: [name] }).catch(fail);
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

  return (
    <>
      <View style={styles.keybar}>
        {KEY_ROWS.map((row, r) => (
          <View key={r} style={styles.keyRow}>
            {row.map((k, i) => (
              <BarSlot
                key={k.key}
                slot={k}
                style={i === CLUSTER_START ? styles.clusterStart : undefined}
                message={message}
                ctrl={ctrl}
                keyboardOpen={keyboardHeight > 0}
                onMode={() => setMode(message ? "direct" : "message")}
                onCtrl={() => setCtrl((c) => !c)}
                onKeyboard={toggleKeyboard}
                onKey={pressKey}
              />
            ))}
          </View>
        ))}
      </View>
      {message ? (
        <View style={[styles.composer, { paddingBottom: Math.max(bottom, space.sm) }]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={onMessageChange}
            placeholder="Message"
            placeholderTextColor={colors.muted}
            autoCorrect
            spellCheck
            multiline
            submitBehavior="newline"
          />
          <Pressable style={[styles.send, (!text.trim() || sending) && styles.off]} disabled={!text.trim() || sending} onPress={() => void send(text)}>
            <Text style={styles.sendText}>{sending ? "…" : "Send"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ height: Math.max(bottom, keyboardHeight ? 0 : space.xs) }}>
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
    </>
  );
});

const ICONS: Partial<Record<string, keyof typeof Ionicons.glyphMap>> = {
  paste: "clipboard-outline",
  enter: "return-down-back",
  up: "arrow-up",
  down: "arrow-down",
  left: "arrow-back",
  right: "arrow-forward",
};

/** One slot of the key bar: the bar's own controls, or a key it sends. */
function BarSlot({ slot, style, message, ctrl, keyboardOpen, onMode, onCtrl, onKeyboard, onKey }: {
  slot: BarKey;
  style?: object;
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
      return <Key style={style} icon={message ? "terminal-outline" : "chatbox-outline"} accessibilityLabel={message ? "Type directly" : "Write a message"} onPress={onMode} />;
    case "ctrl":
      return <Key style={style} label="ctrl" active={ctrl} onPress={onCtrl} />;
    case "keyboard":
      // Always in its slot so no key moves; the composer has its own keyboard.
      return <Key style={style} icon={keyboardOpen ? "chevron-down-outline" : "keypad-outline"} accessibilityLabel={keyboardOpen ? "Hide keyboard" : "Open keyboard"} disabled={message} onPress={onKeyboard} />;
    default: {
      const icon = ICONS[slot.key];
      const name = slot.key === "paste" ? "Paste" : slot.label;
      return <Key style={style} label={slot.label} icon={icon} accessibilityLabel={icon ? name : undefined} tonal={slot.arrow} onPress={() => onKey(slot.key)} />;
    }
  }
}

/** A Material 3 button for the key bar: tonal for arrows, filled when a toggle is on. */
function Key({ label = "", icon, onPress, active, tonal, disabled, style, accessibilityLabel }: {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  active?: boolean;
  tonal?: boolean;
  disabled?: boolean;
  style?: object;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const styles = useStyles();
  const ink = active ? colors.onAccent : tonal ? colors.onTonal : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [styles.key, tonal && styles.keyTonal, active && styles.keyActive, pressed && styles.keyPressed, disabled && styles.keyDisabled, style]}
      onPress={onPress}
    >
      {({ pressed }) => (
        <>
          {pressed && <View style={[styles.stateLayer, { backgroundColor: ink }]} />}
          {icon ? <Ionicons name={icon} size={20} color={ink} /> : <Text style={[styles.keyText, { color: ink }, /^\d$/.test(label) && styles.keyDigit]}>{label}</Text>}
        </>
      )}
    </Pressable>
  );
}

const KEY_GAP = 6;

const useStyles = makeStyles((colors) => ({
  keybar: { padding: space.sm, gap: KEY_GAP, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  keyRow: { flexDirection: "row", gap: KEY_GAP },
  clusterStart: { marginLeft: KEY_GAP },
  key: { flex: 1, minWidth: 0, height: 44, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surfaceHigh, alignItems: "center", justifyContent: "center" },
  keyTonal: { backgroundColor: colors.tonal },
  keyActive: { backgroundColor: colors.accent },
  // Material 3 Expressive: a pressed button squares off a little.
  keyPressed: { borderRadius: radius.md - 2 },
  keyDisabled: { opacity: 0.38 },
  stateLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.12 },
  keyText: { fontSize: 13, fontFamily: fonts.mono, fontWeight: "500" },
  keyDigit: { fontSize: 15 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, paddingHorizontal: space.sm, paddingTop: space.sm, backgroundColor: colors.surface },
  input: { flex: 1, maxHeight: 120, color: colors.text, backgroundColor: colors.bg, borderRadius: 18, paddingHorizontal: 14, paddingVertical: space.sm, fontSize: 15 },
  send: { backgroundColor: colors.accent, borderRadius: 18, paddingHorizontal: space.lg, height: 36, justifyContent: "center" },
  sendText: { color: colors.onAccent, fontWeight: "700" },
  off: { opacity: 0.4 },
  capture: { position: "absolute", left: 0, top: 0, width: 1, height: 1, opacity: 0, color: "transparent" },
}));
