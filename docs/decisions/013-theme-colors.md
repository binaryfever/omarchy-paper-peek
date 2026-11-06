# The live dot uses the theme's green

The drawer, the corner float, and the artboard list already take color, type, and borders from the shell theme. The live status dot did not. It was painted `#6fbf73`.

## Why the dot reads `green`

Not-live already uses `Commons.Color.urgent`, the theme red. Off uses `Commons.Color.muted`. Live should use the theme's green, which is the `green` key in `colors.toml`. Nord's green is `#a3be8c`. The old dot was a different green, so it matched no theme.

`Commons.Color.loadColors` keeps foreground, background, accent, urgent, and muted. It drops `green`. The bar reads that one key itself. A missing key, or a value that is not a 6-digit hex color, uses `Commons.Color.accent`.

`omarchy theme set` replaces `~/.local/state/omarchy/current/theme` and then calls `omarchy-shell shell applyTheme`. That call runs `loadColors` and `loadShell`. `loadShell` assigns `Commons.Color.shellValues` after the new directory is in place. The colors file is not watched, because the theme command deletes the directory and moves a new one in. The bar reloads `colors.toml` when `shellValues` changes. The status file honors `XDG_STATE_HOME`. The theme path stays `~/.local/state/omarchy/current/theme/colors.toml`, because that is the path `Commons.Color` reads.

## What this leaves out

Layout, the three status words, and the drawer, float, and artboard list are unchanged. A search of the QML and JS for a hardcoded hex color finds none.

The running bar still shows the old dot. A save logged `Local plugin changed, reloading: fmchale.paper-peek`. A save of invalid QML logged the same line and no compile error, so the shell is still painting the widget it started with. `omarchy restart shell` printed `Refusing to restart Omarchy shell while the session is locked.`

## Proof

`node --experimental-strip-types src/theme-green.test.ts` printed `theme-green.test.ts: ok`. The same runner printed ok for `src/settings.test.ts`, `src/paper-fetch.test.ts`, `src/paper-probe.test.ts`, and `src/float-geometry.test.ts`.

The same parser, run on the active Nord `colors.toml`, printed `live-green #a3be8c`.

`omarchy plugin validate ~/.config/omarchy/plugins/fmchale.paper-peek` exited 0.

`.cursor/skills/verify-paper-peek/verify-paper-peek doctor` printed `verdict: worth-driving`. The slot was `204,0 21x26`, section `left`, visible. The monitor was `HDMI-A-1` at `0,0`, scale 1.6.

`drive bar-label` was stopped after 22 seconds. It wrote `doctor.txt`, `widget.json`, `crop.txt`, and `clients-before.json` under `~/.local/state/paper-peek/verify-evidence/20261106T094131Z-3082874`, and no PNG. `grim -g 196,0 53x34` is the step that does not return. `cleanup` left that directory in place.
