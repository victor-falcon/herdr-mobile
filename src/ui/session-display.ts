import type { Session } from "../hc/fleet";
import type { Colors } from "./theme";

export function statusColor(state: string | undefined, colors: Colors): string {
  switch (state) {
    case "working":
      return colors.working;
    case "blocked":
      return colors.blocked;
    case "error":
      return colors.error;
    case "done":
    case "idle":
      return colors.done;
    default:
      return colors.idle;
  }
}

/** What a person would call it: its name, the agent's own title, or the program. */
export function sessionTitle(s: Session): string {
  const t = s.terminal;
  return t.name || t.status?.title || t.title || t.foreground?.name || t.argv[0] || t.address;
}

/** /home/me/x and /Users/me/x both read as ~/x. */
export function shortPath(path: string): string {
  return path.replace(/^\/(home|Users)\/[^/]+/, "~");
}

export function ago(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return "";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function agentTitle(s: Session): string {
  const t = s.terminal;
  const raw = t.status?.title || t.title || t.name || t.status?.app || t.argv[0]?.split("/").pop() || sessionTitle(s);
  const folder = t.cwd.replace(/\/+$/, "");
  const base = folder.slice(folder.lastIndexOf("/") + 1);
  const trimmed = raw.replace(/^\S{1,2}\s+-\s+/, "").replace(new RegExp(` - ${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
  return trimmed || raw;
}

