// Updates come as APKs: CI builds every push to main and publishes it as a GitHub
// release tagged build-<versionCode>. The app looks for a newer one on launch and
// when it returns to the foreground; installing hands the APK to Android's installer.
import Constants from "expo-constants";
import { Directory, File, Paths } from "expo-file-system";
import { getContentUriAsync } from "expo-file-system/legacy";
import { startActivityAsync } from "expo-intent-launcher";
import { useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";

export type Release = { build: number; apk: string; title: string };

const repo: string | undefined = Constants.expoConfig?.extra?.releasesRepo;
/** The build this APK is: its Android versionCode. */
export const currentBuild = Number(Constants.expoConfig?.android?.versionCode ?? 0);
export const updatesEnabled = Platform.OS === "android" && !!repo;

let available: Release | null = null;
const listeners = new Set<() => void>();
const set = (r: Release | null) => {
  available = r;
  for (const l of listeners) l();
};

/** Which code is running. */
export function currentUpdate(): string {
  return `build ${currentBuild}`;
}

/** The newest release when it is newer than this build, else null. */
export async function checkForUpdate(): Promise<Release | null> {
  if (!updatesEnabled) return null;
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
  if (res.status === 404) return null; // no release yet
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const body = (await res.json()) as { tag_name?: string; name?: string; assets?: { name: string; browser_download_url: string }[] };
  const build = Number(/^build-(\d+)$/.exec(body.tag_name ?? "")?.[1] ?? 0);
  const apk = body.assets?.find((a) => a.name.endsWith(".apk"))?.browser_download_url;
  const release = build > currentBuild && apk ? { build, apk, title: body.name || `Build ${build}` } : null;
  set(release);
  return release;
}

/** Download the release's APK and open Android's installer on it. */
export async function installUpdate(release: Release): Promise<void> {
  const dir = new Directory(Paths.cache, "updates");
  if (dir.exists) dir.delete();
  dir.create({ idempotent: true });
  const file = await File.downloadFileAsync(release.apk, new File(dir, `herdr-mobile-${release.build}.apk`), { idempotent: true });
  const uri = await getContentUriAsync(file.uri);
  // FLAG_GRANT_READ_URI_PERMISSION, so the installer can read the file.
  await startActivityAsync("android.intent.action.VIEW", { data: uri, type: "application/vnd.android.package-archive", flags: 1 });
}

let lastCheck = 0;
function checkNow() {
  // GitHub allows 60 unauthenticated calls an hour; once every ten minutes is plenty.
  if (Date.now() - lastCheck < 10 * 60_000) return;
  lastCheck = Date.now();
  checkForUpdate().catch(() => {});
}

/** Check on launch and whenever the app comes back to the foreground. */
export function startUpdateChecks() {
  if (!updatesEnabled) return;
  checkNow();
  AppState.addEventListener("change", (s) => {
    if (s === "active") checkNow();
  });
}

/** The newer release found by the last check, if any. */
export function useAvailableUpdate(): Release | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => available,
  );
}
