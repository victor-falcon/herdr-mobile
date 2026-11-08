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
        return ROLES.associate { (key, name) ->
          key to hex(r.getField(name + if (light) "_light" else "_dark").getInt(null))
        }
      }
      mapOf("light" to scheme(true), "dark" to scheme(false))
    }
  }

  companion object {
    private val ROLES = listOf(
      "primary" to "system_primary",
      "onPrimary" to "system_on_primary",
      "surface" to "system_surface",
      "surfaceContainer" to "system_surface_container",
      "surfaceContainerHighest" to "system_surface_container_highest",
      "secondaryContainer" to "system_secondary_container",
      "onSecondaryContainer" to "system_on_secondary_container",
      "outlineVariant" to "system_outline_variant",
      "onSurface" to "system_on_surface",
      "onSurfaceVariant" to "system_on_surface_variant",
      "error" to "system_error",
      "tertiary" to "system_tertiary",
      "tertiaryContainer" to "system_tertiary_container",
    )
  }
}
