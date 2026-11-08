import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { fleet } from "../fleet-store";
import { getSettings } from "../settings";
import type { Space } from "../spaces";
import { defaultAgentCommand, spaceFor, startAgent, startSpace, useProjects, type Project } from "./new-session";
import { Sheet } from "./Sheet";
import { TextField } from "./TextField";
import { makeStyles, fonts, radius, space as gap, useColors } from "./theme";

type Item = { heading: string } | { project: Project; open: Space | undefined };

export function ProjectSheet({ visible, spaces, onClose }: { visible: boolean; spaces: Space[]; onClose: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const [query, setQuery] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const targets = visible ? fleet.targets() : [];
  const { projects, loading } = useProjects(targets, visible);

  const items = useMemo((): Item[] => {
    const q = query.trim().toLowerCase();
    const shown = projects.filter((p) => !q || `${p.owner}/${p.repo}`.toLowerCase().includes(q));
    const many = new Set(shown.map((p) => p.target.coreId)).size > 1;
    const out: Item[] = [];
    let last = "";
    for (const p of shown) {
      if (many && p.target.coreId !== last) out.push({ heading: p.target.label });
      last = p.target.coreId;
      out.push({ project: p, open: spaceFor(p, spaces) });
    }
    return out;
  }, [projects, spaces, query]);

  const close = () => {
    setQuery("");
    onClose();
  };

  const pick = async (p: Project, open: Space | undefined) => {
    setStarting(p.folder);
    try {
      const key = open ? await startAgent(open, defaultAgentCommand()) : await startSpace(p.target, p.folder);
      close();
      router.push({ pathname: "/session/[key]", params: { key } });
    } catch (e) {
      Alert.alert("Could not start it", e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(null);
    }
  };

  return (
    <Sheet visible={visible} onClose={close}>
      <TextField style={styles.search} value={query} onChangeText={setQuery} placeholder="Open a project" autoCorrect={false} spellCheck={false} inset />
      {loading && <ActivityIndicator style={styles.loading} color={colors.muted} />}
      {!loading && items.length === 0 && <Text style={styles.note}>{query ? `Nothing matches “${query}”.` : `No projects in ${getSettings().projectDirs.join(", ") || "any folder"}.`}</Text>}
      <FlatList
        data={items}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(it) => ("heading" in it ? `h:${it.heading}` : `${it.project.target.coreId}:${it.project.folder}`)}
        renderItem={({ item }) =>
          "heading" in item ? (
            <Text style={styles.heading}>{item.heading}</Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.project.owner}/${item.project.repo}`}
              disabled={!!starting}
              onPress={() => void pick(item.project, item.open)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed, starting && starting !== item.project.folder && styles.off]}
            >
              <Text style={styles.name} numberOfLines={1}>
                <Text style={styles.owner}>{item.project.owner}/</Text>
                {item.project.repo}
              </Text>
              {starting === item.project.folder ? (
                <ActivityIndicator color={colors.text} />
              ) : item.open ? (
                <View style={styles.open}>
                  <Text style={styles.openText}>open</Text>
                </View>
              ) : null}
            </Pressable>
          )
        }
      />
    </Sheet>
  );
}

const useStyles = makeStyles((colors) => ({
  search: { marginHorizontal: gap.xs, marginBottom: gap.sm },
  loading: { marginVertical: gap.xl },
  note: { color: colors.muted, fontSize: 14, padding: 14 },
  heading: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginHorizontal: 14, marginTop: gap.md, marginBottom: gap.xs },
  row: { flexDirection: "row", alignItems: "center", gap: gap.sm, paddingHorizontal: 14, paddingVertical: 13, borderRadius: radius.md },
  pressed: { backgroundColor: colors.surfaceHigh },
  off: { opacity: 0.4 },
  name: { flex: 1, color: colors.text, fontSize: 15, fontFamily: fonts.mono, fontWeight: "700" },
  owner: { color: colors.muted, fontWeight: "400" },
  open: { borderRadius: radius.sm, backgroundColor: colors.accent + "26", paddingHorizontal: gap.sm - 2, paddingVertical: 2 },
  openText: { color: colors.accent, fontSize: 11, fontWeight: "700" },
}));
