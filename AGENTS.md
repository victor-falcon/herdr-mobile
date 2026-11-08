# herdr-mobile

Android and iOS client for herdr-core (`hc`), built with Expo.

- Check: `pnpm test` (needs `hc` on PATH) and `pnpm typecheck`.
- A push to `main` builds a signed APK in CI and publishes it as a GitHub release (`build-N`); installed apps offer it as an update. Land only finished, checked work there.
- Release APKs are signed with the key named by `HERDR_SIGNING` (a properties file; locally `~/.config/herdr-mobile/signing.properties`, in CI from the `HERDR_KEYSTORE_*` secrets).
- The USB Pixel 7 on `mini` runs only the development client. Never install a preview or production APK on it. See docs/pixel-7.md.
- Build APKs locally with `eas build --local` in the Nix Android shell. Run a cloud build only when asked. See docs/releasing.md.
