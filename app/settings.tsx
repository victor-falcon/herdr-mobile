import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { router, Stack } from "expo-router";
import { useState, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFleet } from "../src/fleet-store";
import { updateSettings, useSettings, type Agent } from "../src/settings";
import { Button } from "../src/ui/Button";
import { ButtonGroup, GroupButton, GroupValue } from "../src/ui/ButtonGroup";
import { Card, Row, Section } from "../src/ui/Group";
import { IconButton } from "../src/ui/IconButton";
import type { IconName } from "../src/ui/icons";
import { parseProjectDirs } from "../src/project-dirs";
import { TextField } from "../src/ui/TextField";
import { LargeTopAppBar } from "../src/ui/TopAppBar";
import { fonts, makeStyles, space, typography, useColors } from "../src/ui/theme";
import { checkForUpdate, currentUpdate, installUpdate, updatesEnabled } from "../src/updates";

export default function SettingsScreen() {
  const styles = useStyles();
  const s = useSettings();
  const { links } = useFleet();
  const up = links.filter((l) => l.state === "connected").length;
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <LargeTopAppBar title="Settings" back />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Row
            icon="server-outline"
            label="Machines"
            hint={links.length === 0 ? "None yet" : `${up} of ${links.length} connected · this phone's SSH key`}
            onPress={() => router.push("/machines")}
          />
        </Card>

        <Section title="Terminal">
          <Row icon="text-outline" label="Text size">
            <ButtonGroup accessibilityLabel="Text size">
              <GroupButton icon="remove" width={48} accessibilityLabel="Smaller text" onPress={() => void updateSettings({ fontSize: Math.max(8, s.fontSize - 1) })} />
              <GroupValue>{s.fontSize}</GroupValue>
              <GroupButton icon="add" width={48} accessibilityLabel="Larger text" onPress={() => void updateSettings({ fontSize: Math.min(22, s.fontSize + 1) })} />
            </ButtonGroup>
          </Row>
          <Block
            icon="phone-portrait-outline"
            label="Open sessions at"
            hint={
              s.defaultMode === "fit"
                ? "Phone size: the terminal reflows to fit the phone, and your desktop sees that size until you use it there again."
                : "Full size: watch at your desktop's size, scaled down; pinch to zoom."
            }
          >
            <Choice
              value={s.defaultMode}
              options={[
                ["fit", "Phone"],
                ["full", "Full"],
              ]}
              onChange={(v) => void updateSettings({ defaultMode: v })}
            />
          </Block>
        </Section>

        <Section title="Projects">
          <ProjectDirsField dirs={s.projectDirs} />
        </Section>

        <Section title="Agents">
          <AgentsField agents={s.agents} />
        </Section>

        <Section title="App">
          <Row icon="information-circle-outline" label={`Herdr Mobile ${Constants.expoConfig?.version ?? ""}`} hint={currentUpdate()}>
            {updatesEnabled && <UpdateButton />}
          </Row>
        </Section>
      </ScrollView>
    </View>
  );
}

/** A row whose control sits under its text, full width: an icon, a label, a hint, then the control. */
function Block({ icon, label, hint, children }: { icon: IconName; label: string; hint: string; children: ReactNode }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.block}>
      <Ionicons name={icon} size={24} color={colors.onSurfaceVariant} style={styles.blockIcon} />
      <View style={styles.blockBody}>
        <View style={styles.blockText}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
        {children}
      </View>
    </View>
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
    <Block
      icon="folder-outline"
      label="Project folders"
      hint="Where Open a project looks on each machine, under your home folder. Separate them with commas; * matches any folder."
    >
      <TextField
        label="Folders"
        inputStyle={styles.mono}
        value={text}
        onChangeText={setText}
        onBlur={save}
        onSubmitEditing={save}
        placeholder="~/Projects/*, ~/Code/*"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="done"
      />
    </Block>
  );
}

type Draft = Agent & { id: number };
let draftId = 0;

/** The agents the + sheet offers. Saved as you leave a field; rows without a command are dropped. */
function AgentsField({ agents }: { agents: Agent[] }) {
  const styles = useStyles();
  const [drafts, setDrafts] = useState<Draft[]>(() => agents.map((a) => ({ ...a, id: draftId++ })));
  const save = (next: Draft[]) => {
    setDrafts(next);
    void updateSettings({ agents: next.filter((d) => d.command.trim()).map((d) => ({ name: d.name.trim(), command: d.command.trim() })) });
  };
  const edit = (id: number, patch: Partial<Agent>) => setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  return (
    <Block icon="sparkles-outline" label="Agents" hint="What + offers in a space, besides a plain terminal. The first one is what a new project starts.">
      {drafts.map((d) => (
        <View key={d.id} style={styles.agentRow}>
          <TextField
            style={styles.agentName}
            label="Name"
            value={d.name}
            onChangeText={(name) => edit(d.id, { name })}
            onBlur={() => save(drafts)}
            autoCorrect={false}
            spellCheck={false}
          />
          <TextField
            style={styles.agentCommand}
            label="Command"
            inputStyle={styles.mono}
            value={d.command}
            onChangeText={(command) => edit(d.id, { command })}
            onBlur={() => save(drafts)}
            placeholder="command --flags"
            autoCorrect={false}
            spellCheck={false}
          />
          <IconButton icon="close" size={40} label={`Remove ${d.name || d.command || "agent"}`} onPress={() => save(drafts.filter((x) => x.id !== d.id))} />
        </View>
      ))}
      <View style={styles.addAgent}>
        <Button variant="tonal" icon="add" title="Add agent" onPress={() => setDrafts((ds) => [...ds, { id: draftId++, name: "", command: "" }])} />
      </View>
    </Block>
  );
}

function UpdateButton() {
  const [state, setState] = useState<"idle" | "checking" | "downloading" | "latest" | "failed">("idle");
  const label = { idle: "Check for updates", checking: "Checking…", downloading: "Downloading…", latest: "Up to date", failed: "Couldn't update" }[state];
  // Finds the newest build and, when it is newer, downloads it into Android's installer.
  const onPress = async () => {
    setState("checking");
    try {
      const release = await checkForUpdate();
      if (!release) return setState("latest");
      setState("downloading");
      await installUpdate(release);
      setState("idle");
    } catch {
      setState("failed");
    }
  };
  const busy = state === "checking" || state === "downloading";
  // While busy it turns filled and ignores taps, keeping its label readable (disabled would fade it).
  return (
    <Button
      variant={busy ? "filled" : "tonal"}
      title={label}
      onPress={() => {
        if (!busy) void onPress();
      }}
    />
  );
}

/** A full-width connected choice: the selected segment is filled primary, fully round, with a check. */
function Choice<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <View accessibilityRole="radiogroup">
      <ButtonGroup>
        {options.map(([v, label]) => (
          <GroupButton key={v} flex={1} label={label} icon={v === value ? "checkmark" : undefined} selected={v === value} onPress={() => onChange(v)} />
        ))}
      </ButtonGroup>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.xl, paddingBottom: 48, gap: 20 },
  block: { flexDirection: "row", alignItems: "flex-start", gap: space.lg, padding: space.lg },
  blockIcon: { marginTop: 2 },
  blockBody: { flex: 1, gap: space.md },
  blockText: { gap: 2 },
  label: { ...typography.bodyLarge, color: colors.onSurface },
  hint: { ...typography.bodyMedium, color: colors.onSurfaceVariant },
  mono: { fontFamily: fonts.mono, fontSize: 15 },
  agentRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  agentName: { width: 84 },
  agentCommand: { flex: 1 },
  addAgent: { flexDirection: "row" },
}));
