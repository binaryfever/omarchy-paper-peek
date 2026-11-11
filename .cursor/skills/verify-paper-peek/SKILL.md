---
name: verify-paper-peek
description: >-
  Drive the Paper Peek Omarchy bar widget on the live shell and capture proof
  that the left-bar label reads "Paper Peek". Use when changing BarWidget.qml,
  the plugin manifest, or bar placement, and before calling a Paper Peek UI task done.
---

# Verify Paper Peek

Paper Peek is an Omarchy shell plugin (`binaryfever.paper-peek`). The running app is one widget on the top bar of the user's Hyprland session. The widget paints the words `Paper Peek`. There is no drawer, page list, or artboard view in the tree yet. `BarWidget.qml` is a label.

The shell is the single long-lived `omarchy-shell` process for this Wayland display. A second shell would fight that process for the bar. Verification never starts one, never restarts the shell, and never enables, disables, moves, or removes the plugin. `omarchy plugin remove binaryfever.paper-peek` deletes the git checkout.

## Launch

There is no server to start and no data directory to seed. The label reads nothing from disk at runtime. `~/.cache/paper-peek/` is not part of this widget. Do not create it.

Ready means the live shell already shows the widget. Run doctor. `verdict: worth-driving` is the ready line. If doctor exits non-zero, stop. Do not run `omarchy restart shell`, `omarchy plugin enable`, or `qs` to make it ready.

The checkout and the installed plugin are the same real directory: `~/.config/omarchy/plugins/binaryfever.paper-peek`. `/home/fred/Projects/omarchy-paper-peek` is a symlink to it. Writes under that directory print `Local plugin changed, reloading: binaryfever.paper-peek` in `journalctl --user -t omarchy-shell`. The bar label still comes from the QML the shell last started with until someone restarts the shell. Verification does not restart it.

Teardown does not stop the shell. Run cleanup after a drive. Cleanup removes only scratch directories this harness created under `/tmp/paper-peek-verify`.

## Doctor

Doctor is read-only. It answers whether this live shell is the instance to drive.

```bash
.cursor/skills/verify-paper-peek/verify-paper-peek doctor
```

Run it from the plugin checkout. Exit 0 and a line `verdict: worth-driving` means:

- `WAYLAND_DISPLAY` is set and that socket exists.
- Exactly one `/run/user/$UID/omarchy-shell-*.sock` exists. Zero or several is a refusal.
- `omarchy-shell shell ping` prints `ok`.
- `~/.config/omarchy/plugins/binaryfever.paper-peek` exists, is not a symlink, and `omarchy plugin validate` on that path exits 0.
- `omarchy plugin list --json` includes `binaryfever.paper-peek` with `enabled` true and kind `bar-widget`. For this plugin, `enabled` means the widget is in the bar. `active: false` is normal. `active` is for bar options, not bar widgets.
- `omarchy-shell shell debugBarGeometry` includes the widget in section `left`, `visible` true, with a non-zero size.
- `hyprctl monitors -j` reports one monitor at origin `0,0`. Any other layout is a refusal, because the screenshot crop uses the geometry coordinates directly and that offset was checked only for an origin of `0,0`.

Doctor does not write a file. A refusal tells you the unmet condition. Do not satisfy it by changing the user's bar.

## Drive

The harness is `verify-paper-peek`. The only mapped drive is the bar label.

```bash
.cursor/skills/verify-paper-peek/verify-paper-peek drive bar-label
```

The command runs doctor again. If doctor fails, it writes the refusal under the evidence directory and exits 1 without calling `grim`. If doctor passes, it:

1. Records tiled window positions from `hyprctl clients -j` (`floating != true`).
2. Records `debugBarGeometry` and the `binaryfever.paper-peek` slot.
3. Crops the slot with `grim -g`. The crop is the slot in logical pixels, 8px to the left when the slot allows it, 24px past the slot's right edge, and 8px below the slot. Those coordinates are what `grim` expects. The PNG is in physical pixels (scale 1.6 on this monitor). Do not multiply the crop by the scale.
4. Reads the crop with `tesseract <png> stdout --psm 7`.
5. Records tiled window positions again. `diff` must be empty.

Pass is exit 0, `result: pass` on stdout, OCR text containing `Paper Peek`, and `tiled_clients: unchanged`. The user-visible proof is the PNG plus the OCR file. The geometry JSON is the placement, not a substitute for the picture.

`scripts/paper-probe` is not a drive. It calls Paper's `get_basic_info`, which opens a background tab, and it rewrites `docs/paper-mcp.md`.

## Evidence

Each drive creates a new directory:

`~/.local/state/paper-peek/verify-evidence/<UTC-timestamp>-<pid>/`

Override the root with `XDG_STATE_HOME` (`$XDG_STATE_HOME/paper-peek/verify-evidence`). The path is outside the plugin tree so the screenshot does not trip the shell's plugin watcher.

Stdout names the directory with `evidence:`. A pass writes:

- `doctor.txt` — doctor output, including `verdict: worth-driving`
- `plugin.json` — the list entry for `binaryfever.paper-peek`
- `geometry.json` — full bar geometry at capture time
- `widget.json` — the Paper Peek slot (`section` `left`, `visible` true)
- `crop.txt` — the `grim -g` argument
- `bar-label.png` — the cropped bar
- `bar-label.ocr.txt` — tesseract stdout, containing `Paper Peek`
- `clients-before.json` and `clients-after.json` — tiled clients (`address`, `class`, `at`, `size`)
- `clients-stable.txt` — `unchanged`
- `result.txt` — `feature: bar-label`, `entry: top-bar-left`, `result: pass`

A failure still leaves that directory. `result.txt` says `result: fail`. Keep it.

There is no accessibility tree for this widget. Do not look for an ARIA snapshot. The PNG and the OCR file are the visible proof. The client JSON pair is the side effect: a capture must not move tiled windows.

## Cleanup

```bash
.cursor/skills/verify-paper-peek/verify-paper-peek cleanup
```

Cleanup deletes leftover `/tmp/paper-peek-verify/<run-id>` directories that contain `owned-by-verify-paper-peek`. A finished drive already removes its own scratch. Cleanup never deletes `~/.local/state/paper-peek/verify-evidence`, never signals `omarchy-shell`, and never edits `shell.json`.

After cleanup, the `evidence:` directory from the drive must still exist. If it does not, cleanup is wrong.

## Helpers

The harness is one executable:

`.cursor/skills/verify-paper-peek/verify-paper-peek`

Invoke it from the plugin checkout with the three commands in Launch, Drive, and Cleanup. There is no other helper.

## Not in the map

Do not add a passing result for a path the map does not list.

- The drawer, project browser, and artboard screenshot in `AGENTS.md` are not built. `BarWidget.qml` has no mouse handler and no hotkey.
- `scripts/paper-probe` captures Paper MCP samples. It is not the bar widget.
- Do not verify the label by reading `text: "Paper Peek"` out of `BarWidget.qml`. That string can be true while the bar still shows an older label.

## Feature map

Read [features/README.md](features/README.md) before a drive, then follow the feature file. One feature is mapped because one user-facing behavior exists.
