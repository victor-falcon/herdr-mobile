import { requireOptionalNativeModule } from "expo-modules-core";

export type MaterialRoles = {
  primary: string;
  onPrimary: string;
  surface: string;
  surfaceContainer: string;
  surfaceContainerHighest: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  outlineVariant: string;
  onSurface: string;
  onSurfaceVariant: string;
  error: string;
  tertiary: string;
  tertiaryContainer: string;
};

const native = requireOptionalNativeModule<{ roles(): { light: MaterialRoles; dark: MaterialRoles } | null }>("MaterialColors");

/** The phone's dynamic (wallpaper) color roles, or null off Android 14+. */
export function systemRoles(): { light: MaterialRoles; dark: MaterialRoles } | null {
  try {
    return native?.roles() ?? null;
  } catch {
    return null;
  }
}
