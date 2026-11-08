import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Share, Text, View } from "react-native";
import { fleet, setMachines, useFleet, useMachines } from "../src/fleet-store";
import type { MachineConfig } from "../src/hc/fleet";
import { phonePublicKey } from "../src/ssh/ssh-transport";
import { hostKeys } from "../src/storage";
import { Avatar } from "../src/ui/Avatar";
import { Button } from "../src/ui/Button";
import { ButtonGroup, GroupButton } from "../src/ui/ButtonGroup";
import { Card, Cell, Row, Section } from "../src/ui/Group";
import { useKeyboardHeight } from "../src/ui/keyboard";
import { explainError, linkAvatarColors } from "../src/ui/machine-display";
import { TextField } from "../src/ui/TextField";
import { LargeTopAppBar } from "../src/ui/TopAppBar";
import { fonts, makeStyles, shape, space, typography, useColors } from "../src/ui/theme";

export default function Machines() {
  const colors = useColors();
  const styles = useStyles();
  const { links } = useFleet();
  const { machines } = useMachines();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const keyboard = useKeyboardHeight();

  useEffect(() => {
    phonePublicKey().then(setPublicKey, (e) => setPublicKey(`Could not create a key: ${e.message}`));
  }, []);

  const remove = (m: MachineConfig) =>
    Alert.alert(`Remove ${m.name}?`, "Its terminals keep running there.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void setMachines(machines.filter((x) => x.id !== m.id)) },
    ]);

  const trustNewKey = async (m: MachineConfig) => {
    await hostKeys.forget(`${m.host}:${m.port}`);
    fleet.reconnect();
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <LargeTopAppBar title="Machines" back />
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: 48 + keyboard }]} keyboardShouldPersistTaps="handled">
        {links.length > 0 && (
          <Card>
            {links.map((l) => {
              const m = l.config;
              const address = `${m.user}@${m.host}${m.port !== 22 ? `:${m.port}` : ""}`;
              const seen = l.machines.length > 0 ? ` · sees ${l.machines.map((x) => `${x.name} (${x.state})`).join(", ")}` : "";
              const problem = l.state !== "connected" && l.error ? explainError(l.error, m) : undefined;
              return (
                <View key={m.id}>
                  <Row
                    top
                    label={m.name}
                    left={<Avatar icon="server-outline" {...linkAvatarColors(l.state, colors)} />}
                    hint={
                      <>
                        <Text style={styles.address}>{address}</Text>
                        {l.state === "connected" ? <Text style={styles.coreLine}>{`\nherdr-core ${l.version} · core “${l.core?.name}”${seen}`}</Text> : null}
                      </>
                    }
                  >
                    <Button variant="text" title="Remove" accessibilityLabel={`Remove ${m.name}`} tint={{ fill: "transparent", ink: colors.error }} onPress={() => remove(m)} />
                  </Row>
                  {problem && (
                    <View style={styles.problem}>
                      <Text style={styles.problemText}>{problem}</Text>
                      {l.error?.includes("HOST_KEY_CHANGED") && (
                        <Button title="Trust its new host key" tint={{ fill: colors.surfaceContainerLowest, ink: colors.onErrorContainer }} onPress={() => void trustNewKey(m)} />
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </Card>
        )}

        {adding ? (
          <AddMachine
            onCancel={() => setAdding(false)}
            onAdd={async (m) => {
              await setMachines([...machines, m]);
              setAdding(false);
            }}
          />
        ) : (
          <Button variant="filled" size="medium" icon="add" title="Add a machine" onPress={() => setAdding(true)} />
        )}

        <Section title="This phone's SSH key">
          <Cell>
            <View style={styles.stack}>
              <View style={styles.explain}>
                <Ionicons name="key-outline" size={24} color={colors.onSurfaceVariant} />
                <Text style={styles.muted}>Add it to ~/.ssh/authorized_keys on each machine. The phone runs herdr-core there over SSH.</Text>
              </View>
              <Text selectable style={styles.key}>
                {publicKey ?? "…"}
              </Text>
              {publicKey?.startsWith("ssh-") && (
                <ButtonGroup accessibilityLabel="Key actions">
                  <GroupButton flex={1} icon="copy-outline" label="Copy" onPress={() => void Clipboard.setStringAsync(publicKey)} />
                  <GroupButton flex={1} icon="share-social-outline" label="Share" onPress={() => void Share.share({ message: publicKey })} />
                </ButtonGroup>
              )}
            </View>
          </Cell>
        </Section>
      </ScrollView>
    </View>
  );
}

function AddMachine({ onAdd, onCancel }: { onAdd: (m: MachineConfig) => void; onCancel: () => void }) {
  const styles = useStyles();
  const [host, setHost] = useState("");
  const [user, setUser] = useState("");
  const [port, setPort] = useState("22");
  const [name, setName] = useState("");
  const ready = !!host.trim() && !!user.trim() && Number(port) > 0;

  return (
    <Section title="Add a machine">
      <Cell>
        <View style={styles.stack}>
          <Field label="Host" mono value={host} onChange={setHost} placeholder="server or 100.64.0.1" />
          <Field label="User" mono value={user} onChange={setUser} placeholder="your user" />
          <Field label="Port" mono value={port} onChange={setPort} keyboardType="number-pad" />
          <Field label="Name (optional)" value={name} onChange={setName} placeholder={host || "server"} />
          <View style={styles.actions}>
            <Button variant="outlined" size="medium" title="Cancel" onPress={onCancel} />
            <Button
              variant="filled"
              size="medium"
              title="Add"
              disabled={!ready}
              style={styles.flex}
              onPress={() =>
                onAdd({
                  id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
                  name: name.trim() || host.trim(),
                  host: host.trim(),
                  user: user.trim(),
                  port: Number(port),
                })
              }
            />
          </View>
        </View>
      </Cell>
    </Section>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboardType?: "number-pad"; mono?: boolean }) {
  const styles = useStyles();
  return (
    // Hosts and users are typed exactly: no capitals, corrections or spaces the keyboard adds after a dot.
    <TextField
      label={props.label}
      inputStyle={props.mono && styles.mono}
      value={props.value}
      onChangeText={props.onChange}
      placeholder={props.placeholder}
      keyboardType={props.keyboardType ?? "url"}
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
    />
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.xl, gap: 20 },
  address: { fontFamily: fonts.mono, fontSize: 13 },
  coreLine: { ...typography.bodySmall },
  // Lines up with the row's text: 16 padding + 40 avatar + 16 gap.
  problem: {
    marginLeft: 72,
    marginRight: space.lg,
    marginBottom: space.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
    gap: space.md,
    borderRadius: shape.large,
    backgroundColor: colors.errorContainer,
    alignItems: "flex-start",
  },
  problemText: { ...typography.bodyMedium, color: colors.onErrorContainer },
  explain: { flexDirection: "row", alignItems: "flex-start", gap: space.lg },
  muted: { ...typography.bodyMedium, color: colors.onSurfaceVariant, flex: 1 },
  key: {
    color: colors.onSurface,
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: colors.surfaceContainerHigh,
    padding: space.md,
    borderRadius: shape.medium,
  },
  mono: { fontFamily: fonts.mono, fontSize: 15 },
  actions: { flexDirection: "row", gap: space.sm, paddingTop: space.xs },
  flex: { flex: 1 },
  stack: { gap: space.md },
}));
