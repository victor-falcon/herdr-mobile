import { requireOptionalNativeModule } from "expo-modules-core";

export type MaterialRoles = {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  surface: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  outline: string;
  outlineVariant: string;
  onSurface: string;
  onSurfaceVariant: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  tertiary: string;
  tertiaryContainer: string;
};

/** What the phone reports: a role its Android version lacks is missing. */
export type SystemRoles = { light: Partial<MaterialRoles>; dark: Partial<MaterialRoles> };

const native = requireOptionalNativeModule<{ roles(): SystemRoles | null }>("MaterialColors");

/** The phone's dynamic (wallpaper) color roles, or null off Android 14+. */
export function systemRoles(): SystemRoles | null {
  try {
    return native?.roles() ?? null;
  } catch {
    return null;
  }
}
