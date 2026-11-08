import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { fleet } from "../fleet-store";
import { getSettings } from "../settings";
import type { Space } from "../spaces";
import { Chip } from "./Chip";
import { defaultAgentCommand, spaceFor, startAgent, startSpace, useProjects, type Project } from "./new-session";
import { segmentCorners, type Position } from "./press";
import { LoadingIndicator } from "./Shapes";
import { Sheet } from "./Sheet";
import { emphasized, fonts, makeStyles, shape, space as gap, typography, useColors } from "./theme";

type Item = { heading: string; first: boolean } | { project: Project; open: Space | undefined; position: Position };

export function ProjectSheet({ visible, spaces, onClose }: { visible: boolean; spaces: Space[]; onClose: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const [query, setQuery] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const search = useRef<TextInput>(null);
  const targets = visible ? fleet.targets() : [];
  const { projects, loading } = useProjects(targets, visible);

  const items = useMemo((): Item[] => {
    const q = query.trim().toLowerCase();
    const shown = projects.filter((p) => !q || `${p.owner}/${p.repo}`.toLowerCase().includes(q));
    const many = new Set(shown.map((p) => p.target.coreId)).size > 1;
    const out: Item[] = [];
    shown.forEach((p, i) => {
      const before = shown[i - 1]?.target.coreId;
      const after = shown[i + 1]?.target.coreId;
      // Each machine's projects are one segmented group.
      const starts = before !== p.target.coreId;
      const ends = after !== p.target.coreId;
      if (many && starts) out.push({ heading: p.target.label, first: out.length === 0 });
      out.push({ project: p, open: spaceFor(p, spaces), position: starts && ends ? "only" : starts ? "first" : ends ? "last" : "middle" });
    });
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
      <Pressable style={styles.search} onPress={() => search.current?.focus()} accessible={false}>
        <Ionicons name="search" size={24} color={colors.onSurfaceVariant} />
        <TextInput
          ref={search}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Open a project"
          placeholderTextColor={colors.onSurfaceVariant}
          cursorColor={colors.primary}
          selectionColor={colors.primary}
          accessibilityLabel="Open a project"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="search"
        />
      </Pressable>
      {loading && (
        <View style={styles.loading}>
          <LoadingIndicator size={48} label="Loading projects" />
        </View>
      )}
      {!loading && items.length === 0 && <Text style={styles.note}>{query ? `Nothing matches “${query}”.` : `No projects in ${getSettings().projectDirs.join(", ") || "any folder"}.`}</Text>}
      <FlatList
        data={items}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        keyExtractor={(it) => ("heading" in it ? `h:${it.heading}` : `${it.project.target.coreId}:${it.project.folder}`)}
        renderItem={({ item }) => {
          if ("heading" in item) return <Text style={[styles.heading, !item.first && styles.headingLater]}>{item.heading}</Text>;
          const [tl, tr, br, bl] = segmentCorners(item.position, shape.largeIncreased, shape.extraSmall, "column");
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.project.owner}/${item.project.repo}`}
              accessibilityState={{ disabled: !!starting, busy: starting === item.project.folder }}
              disabled={!!starting}
              onPress={() => void pick(item.project, item.open)}
              style={({ pressed }) => [
                styles.row,
                { borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl },
                pressed && styles.pressed,
                starting && starting !== item.project.folder && styles.off,
              ]}
            >
              <Text style={styles.name} numberOfLines={1}>
                <Text style={styles.owner}>{item.project.owner}/</Text>
                {item.project.repo}
              </Text>
              {starting === item.project.folder ? <LoadingIndicator size={24} label="Starting" /> : item.open ? <Chip label="open" style={styles.chip} /> : null}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

const useStyles = makeStyles((colors) => ({
  search: { flexDirection: "row", alignItems: "center", gap: gap.lg, height: 56, paddingHorizontal: gap.lg, borderRadius: shape.full, backgroundColor: colors.surfaceContainerHigh, marginBottom: gap.sm },
  searchInput: { ...typography.bodyLarge, flex: 1, color: colors.onSurface, padding: 0 },
  loading: { alignItems: "center", paddingVertical: gap.xl },
  note: { ...typography.bodyMedium, color: colors.onSurfaceVariant, padding: gap.md },
  list: { gap: 2, paddingTop: gap.sm, paddingBottom: gap.sm },
  heading: { ...emphasized.titleSmall, color: colors.primary, paddingHorizontal: gap.xs, paddingTop: gap.md, paddingBottom: gap.sm },
  headingLater: { paddingTop: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: gap.md, paddingHorizontal: gap.lg, minHeight: 56, backgroundColor: colors.surfaceContainerLowest },
  pressed: { backgroundColor: colors.surfaceContainerHigh },
  off: { opacity: 0.38 },
  name: { flex: 1, color: colors.onSurface, fontSize: 15, lineHeight: 20, fontFamily: fonts.monoMedium },
  owner: { color: colors.onSurfaceVariant, fontFamily: fonts.mono },
  chip: { borderRadius: shape.small, paddingHorizontal: 10, paddingVertical: 4 },
}));
