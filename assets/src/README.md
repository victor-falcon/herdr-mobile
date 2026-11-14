# Icon sources

The PNGs in `assets/` are exported from these SVGs at 1024x1024:

```sh
for n in icon foreground background monochrome; do
  rsvg-convert -w 1024 -h 1024 assets/src/$n.svg -o assets/$n.png
done
```

- `icon.svg` is the legacy (non-adaptive) icon, also used by iOS.
- `foreground.svg`, `background.svg` and `monochrome.svg` are the Android adaptive icon layers (108dp canvas). The goat path is the same in all three logo files; change it in each.
- `monochrome.png` is also the notification icon.
