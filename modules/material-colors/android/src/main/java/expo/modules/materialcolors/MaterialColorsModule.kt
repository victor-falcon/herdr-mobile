package expo.modules.materialcolors

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The phone's Material You color roles (Android 14+), drawn from its wallpaper.
class MaterialColorsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MaterialColors")

    // Both schemes as #rrggbb by role name, or null where the system has no roles.
    Function("roles") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return@Function null
      val context = appContext.reactContext ?: return@Function null
      fun hex(id: Int) = String.format("#%06X", 0xFFFFFF and context.getColor(id))
      fun scheme(light: Boolean): Map<String, String> {
        val r = android.R.color::class.java
        // A role this Android version lacks is left out; the app's baseline fills it in.
        return ROLES.mapNotNull { (key, name) ->
          val field = runCatching { r.getField(name + if (light) "_light" else "_dark") }.getOrNull() ?: return@mapNotNull null
          key to hex(field.getInt(null))
        }.toMap()
      }
      mapOf("light" to scheme(true), "dark" to scheme(false))
    }
  }

  companion object {
    private val ROLES = listOf(
      "primary" to "system_primary",
      "onPrimary" to "system_on_primary",
      "primaryContainer" to "system_primary_container",
      "onPrimaryContainer" to "system_on_primary_container",
      "surface" to "system_surface",
      "surfaceContainerLowest" to "system_surface_container_lowest",
      "surfaceContainerLow" to "system_surface_container_low",
      "surfaceContainer" to "system_surface_container",
      "surfaceContainerHigh" to "system_surface_container_high",
      "surfaceContainerHighest" to "system_surface_container_highest",
      "secondaryContainer" to "system_secondary_container",
      "onSecondaryContainer" to "system_on_secondary_container",
      "outline" to "system_outline",
      "outlineVariant" to "system_outline_variant",
      "onSurface" to "system_on_surface",
      "onSurfaceVariant" to "system_on_surface_variant",
      "error" to "system_error",
      "onError" to "system_on_error",
      "errorContainer" to "system_error_container",
      "onErrorContainer" to "system_on_error_container",
      "tertiary" to "system_tertiary",
      "tertiaryContainer" to "system_tertiary_container",
    )
  }
}
