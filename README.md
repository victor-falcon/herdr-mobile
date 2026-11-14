
# Herdr Mobile

A native Android and iOS client for [herdr-core](https://github.com/herdrdev/herdr-core)
(`hc`): watch, start, and talk to the coding agents (Pi, Claude Code, and
others) running on all your machines from your phone. It connects to each
machine over SSH and runs `herdr-core connect` there, so it needs no server,
bridge, relay, or plugin on your machines. Tailscale or any other network
that reaches SSH works.

- **Spaces:** your Herdr desktop app spaces on every machine, each with its
  agents (those that need you first, sub-agents under their parent). Factory
  spaces come last. Tap an agent to open it; swipe right on it to go back.
- **Terminal:** live, in color, with the images agents draw, at phone size or
  your desktop's size (switch in the ⋯ menu). Swipe up or down to scroll its history, or a full-screen program. Tap
  it and type: keys go straight to the terminal, and the keyboard suggests and
  corrects words as in any app. The key bar
  sends esc, tab, arrows, ctrl combinations and the clipboard instantly.
  Message mode is for prose to agents: Enter sends it, and hc pastes it and
  presses Enter.
- **Spaces, tabs and panes:** New space asks which machine (when there is
  more than one) and opens a shell in its home folder, as the desktop's new
  space does; cd wherever you want and rename it. A space's + opens a new tab
  with a terminal in its folder; hold a tab for a new pane beside it. Hold a
  space or tab to rename it: a tab's name shows over its agent's own title.
- **Manage:** interrupt, copy output, kill.

## Requirements

- herdr-core (`hc`) on each machine you want to reach:

  ```sh
  curl -fsSL https://releases.herdr.dev/core/install.sh | sh
  ```

- An SSH server on each machine that the phone can reach.

## Install

**Android:** there is no public APK download yet. To build one, see
[Build an APK](docs/releasing.md#build-an-apk).

**iOS:** build the app on a Mac with Xcode and install it on your own iPhone:

```sh
pnpm install
npx expo prebuild --platform ios
npx expo run:ios --device --configuration Release
```

The first run asks Xcode to sign the app. Open `ios/Herdr.xcworkspace`, pick
your team under Signing & Capabilities, and trust the developer profile on the
phone (Settings → General → VPN & Device Management). An install signed with a
free personal team expires after 7 days. Run the last command again to renew
it.

## Connect your machines

The app makes its own Ed25519 SSH key. Copy its public key from
Settings → Machines → Copy and add it to `~/.ssh/authorized_keys` on each
machine. Then add each machine in Settings → Machines. The app trusts the
first host key a machine presents and pins it.

The app connects to every machine you add and merges their lists. A machine
that another machine added with `hc machine add` shows up through that machine
too, as `hc ls` would show it. When the app also reaches that machine
directly, each terminal is listed once and the direct connection is used.

## Updates

On Android, the app downloads updates when it starts or comes back to the
foreground, then offers Restart on the Spaces screen. Settings shows which
version is running and can check for updates.

On iOS, build and install the app again to update it.

## Limitations

iOS suspends the app's connections while it is in the background. Machines
reconnect when you open the app again.

## Contributing

See [docs/development.md](docs/development.md).
