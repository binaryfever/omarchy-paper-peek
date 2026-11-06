# Paper Peek verification map

This directory is the maintained source for verifying the user-facing behavior of Paper Peek. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- The live Omarchy shell on this Wayland display is the only instance. Do not start or restart `omarchy-shell`.
- The plugin checkout is the real directory `~/.config/omarchy/plugins/fmchale.paper-peek`, not a symlink.
- `fmchale.paper-peek` is already on the left of the top bar. If it is not, the drive fails. Do not enable it to make the drive pass.
- One monitor, at origin `0,0`.
- Run `.cursor/skills/verify-paper-peek/verify-paper-peek doctor` and require `verdict: worth-driving`.
- Never drive a shell socket this run did not identify. Doctor refuses when it finds zero or several `omarchy-shell-*.sock` files.

## Driving conventions

- Start every recipe from the live bar. There is no seeded data directory.
- Treat every command as literal. Keep the feature id `bar-label` unchanged.
- Run the drive through `.cursor/skills/verify-paper-peek/verify-paper-peek`.
- The harness crops the widget from `omarchy-shell shell debugBarGeometry` and reads the pixels with `grim` and `tesseract`.
- Record the feature id `bar-label` and the entry `top-bar-left` with the evidence. The drive writes both into `result.txt`.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Proof and skip reporting

- Capture the bar the user sees and the tiled-window positions around that capture, not only a final status line.
- UI proof is `bar-label.png` plus `bar-label.ocr.txt`. There is no ARIA tree for this widget.
- Placement proof is `widget.json` from the shell geometry at capture time.
- Side-effect proof is `clients-before.json`, `clients-after.json`, and `clients-stable.txt` containing `unchanged`.
- Mocks are out of bounds. Do not point the crop at a fixture image, and do not run `scripts/paper-probe`.
- Proof artifacts stay under `~/.local/state/paper-peek/verify-evidence/`. Cleanup must leave them there.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify-paper-peek` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Bar label](./bar-label.md) covers the `Paper Peek` text on the left of the top bar and the requirement that reading it does not move tiled windows.
