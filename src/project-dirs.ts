/** Only plain path characters and globs, so a pattern can't break out of the shell probe. */
const SAFE_DIR = /^~\/[A-Za-z0-9._\-/*?]+$/;

/** A shell script that prints every folder matching the given ~/… globs, one per line. */
export function projectProbe(dirs: string[]): string {
  const globs = dirs
    .map((d) => d.trim().replace(/\/+$/, ""))
    .filter((d) => SAFE_DIR.test(d))
    .map((d) => `"$HOME"/${d.slice(2)}`);
  if (globs.length === 0) return "true";
  return `for d in ${globs.join(" ")}; do [ -d "$d" ] && printf "%s\\n" "$d"; done; true`;
}

/** Splits what the settings field holds into patterns: commas, spaces or new lines between them. */
export function parseProjectDirs(text: string): string[] {
  return text.split(/[\s,]+/).filter(Boolean);
}
