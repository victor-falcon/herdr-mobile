import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFleet } from "../src/fleet-store";
import { updateSettings, useSettings, type Agent } from "../src/settings";
import { Row, Section } from "../src/ui/Group";
import { parseProjectDirs } from "../src/project-dirs";
import { TextField } from "../src/ui/TextField";
import { makeStyles, radius, space, useColors } from "../src/ui/theme";
import { applyUpdate, currentUpdate, fetchUpdate, updatesEnabled } from "../src/updates";

export default function SettingsScreen() {
  const styles = useStyles();
  const s = useSettings();
  const { links } = useFleet();
  const up = links.filter((l) => l.state === "connected").length;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section>
        <Row
          label="Machines"
          hint={links.length === 0 ? "None yet" : `${up} of ${links.length} connected · this phone's SSH key`}
          onPress={() => router.push("/machines")}
        />
      </Section>

      <Section title="Terminal">
        <Row label="Text size">
          <View style={styles.stepper}>
            <Small label="A−" onPress={() => void updateSettings({ fontSize: Math.max(8, s.fontSize - 1) })} />
            <Text style={styles.value}>{s.fontSize}</Text>
            <Small label="A+" onPress={() => void updateSettings({ fontSize: Math.min(22, s.fontSize + 1) })} />
          </View>
        </Row>
        <Row
          label="Open sessions at"
          hint={
            s.defaultMode === "fit"
              ? "Phone size: the terminal reflows to fit the phone, and your desktop sees that size until you use it there again."
              : "Full size: watch at your desktop's size, scaled down; pinch to zoom."
          }
        >
          <Segmented value={s.defaultMode} options={[["fit", "Phone"], ["full", "Full"]]} onChange={(v) => void updateSettings({ defaultMode: v })} />
        </Row>
      </Section>

      <Section title="Projects">
        <ProjectDirsField dirs={s.projectDirs} />
      </Section>

      <Section title="Agents">
        <AgentsField agents={s.agents} />
      </Section>

      <Section title="App">
        <Row label={`Herdr Mobile ${Constants.expoConfig?.version ?? ""}`} hint={currentUpdate()}>
          {updatesEnabled && <UpdateButton />}
        </Row>
      </Section>
    </ScrollView>
  );
}

function ProjectDirsField({ dirs }: { dirs: string[] }) {
  const styles = useStyles();
  const [text, setText] = useState(dirs.join(", "));
  const save = () => {
    const next = parseProjectDirs(text);
    setText(next.join(", "));
    void updateSettings({ projectDirs: next });
  };
  return (
    <View>
      <Row label="Project folders" hint="Where Open a project looks on each machine, under your home folder. Separate them with commas; * matches any folder." />
      <TextField
        style={styles.field}
        value={text}
        onChangeText={setText}
        onBlur={save}
        onSubmitEditing={save}
        placeholder="~/Projects/*, ~/Code/*"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="done"
        inset
      />
    </View>
  );
}

type Draft = Agent & { id: number };
let draftId = 0;

/** The agents the + sheet offers. Saved as you leave a field; rows without a command are dropped. */
function AgentsField({ agents }: { agents: Agent[] }) {
  const colors = useColors();
  const styles = useStyles();
  const [drafts, setDrafts] = useState<Draft[]>(() => agents.map((a) => ({ ...a, id: draftId++ })));
  const save = (next: Draft[]) => {
    setDrafts(next);
    void updateSettings({ agents: next.filter((d) => d.command.trim()).map((d) => ({ name: d.name.trim(), command: d.command.trim() })) });
  };
  const edit = (id: number, patch: Partial<Agent>) => setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  return (
    <View>
      <Row label="Agents" hint="What + offers in a space, besides a plain terminal. The first one is what a new project starts." />
      {drafts.map((d) => (
        <View key={d.id} style={styles.agentRow}>
          <TextField style={styles.agentName} value={d.name} onChangeText={(name) => edit(d.id, { name })} onBlur={() => save(drafts)} placeholder="Name" autoCorrect={false} spellCheck={false} inset />
          <TextField
            style={styles.agentCommand}
            value={d.command}
            onChangeText={(command) => edit(d.id, { command })}
            onBlur={() => save(drafts)}
            placeholder="command --flags"
            autoCorrect={false}
            spellCheck={false}
            inset
          />
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${d.name || d.command || "agent"}`} hitSlop={8} onPress={() => save(drafts.filter((x) => x.id !== d.id))}>
            <Ionicons name="close" size={20} color={colors.muted} />
          </Pressable>
        </View>
      ))}
      <View style={styles.agentAdd}>
        <Small label="Add agent" onPress={() => setDrafts((ds) => [...ds, { id: draftId++, name: "", command: "" }])} />
      </View>
    </View>
  );
}

function UpdateButton() {
  const [state, setState] = useState<"idle" | "checking" | "ready" | "latest" | "failed">("idle");
  const label = { idle: "Check for updates", checking: "Checking…", ready: "Restart to update", latest: "Up to date", failed: "Couldn't check" }[state];
  const onPress = async () => {
    if (state === "ready") return void applyUpdate();
    setState("checking");
    try {
      setState((await fetchUpdate()) ? "ready" : "latest");
    } catch {
      setState("failed");
    }
  };
  return <Small label={label} active={state === "ready"} onPress={() => void onPress()} disabled={state === "checking"} />;
}

function Small({ label, onPress, active, disabled }: { label: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.small, active && styles.active, pressed && styles.pressed]} onPress={onPress} disabled={disabled}>
      <Text style={[styles.smallText, active && styles.activeText]}>{label}</Text>
    </Pressable>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.segment} accessibilityRole="radiogroup">
      {options.map(([v, label]) => (
        <Pressable key={v} accessibilityRole="radio" accessibilityState={{ selected: v === value }} style={[styles.seg, v === value && styles.active]} onPress={() => onChange(v)}>
          <Text style={[styles.smallText, v === value && styles.activeText]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: 48, gap: space.xl },
  agentRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginHorizontal: space.md, marginBottom: space.sm },
  agentName: { width: 96 },
  agentCommand: { flex: 1 },
  agentAdd: { flexDirection: "row", marginHorizontal: space.md, marginBottom: space.md },
  field: { marginHorizontal: space.md, marginBottom: space.md },
  value: { color: colors.text, fontSize: 16, minWidth: 28, textAlign: "center", fontVariant: ["tabular-nums"] },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.sm },
  small: { backgroundColor: colors.surfaceHigh, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm - 2 },
  smallText: { color: colors.text, fontSize: 14 },
  pressed: { opacity: 0.7 },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceHigh, borderRadius: radius.sm + 2, padding: 2 },
  seg: { paddingHorizontal: space.md, paddingVertical: space.sm - 2, borderRadius: radius.sm },
  active: { backgroundColor: colors.accent },
  activeText: { color: colors.onAccent, fontWeight: "700" },
}));
