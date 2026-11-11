# Bar label

The bar label is the words Paper Peek on the left side of the top bar, after the workspace numbers. Looking at it does not open a panel and does not move tiled windows.

## Sub-features

- `bar-placed` shows the Paper Peek slot on the left of the top bar.
- `bar-label` shows the readable text Paper Peek in that slot.

## How to get to it (user POV)

- Look at the left side of the top bar, after the workspace numbers. The words Paper Peek are already there. There is no click, menu item, or hotkey.

## Driving it with verify-paper-peek

Preconditions:

- `verify-paper-peek doctor` prints `verdict: worth-driving`.
- The doctor output includes `plugin: binaryfever.paper-peek`, `enabled: true`, `section: left`, and `visible: true`.
- `active: false` in that output still counts as worth driving.
- One monitor is at origin `0,0`.

- **Check the instance.** Confirm the live shell is the one to look at. Run `.cursor/skills/verify-paper-peek/verify-paper-peek doctor`. Exit code 0. Stdout contains `verdict: worth-driving`, `section: left`, and `visible: true`.
- **Look at the label.** Look at the left side of the top bar. Run `.cursor/skills/verify-paper-peek/verify-paper-peek drive bar-label`. Exit code 0. Stdout contains `result: pass` and a line `evidence:` followed by a directory path.
- **Confirm the words.** Read the OCR of that crop. The file `bar-label.ocr.txt` in the evidence directory contains `Paper Peek`. The file `bar-label.png` in the same directory is the crop those words came from.
- **Confirm placement.** Read the slot recorded with the crop. `widget.json` in the evidence directory has `"id": "binaryfever.paper-peek"`, `"section": "left"`, and `"visible": true`.
- **Confirm windows stayed put.** Compare tiled clients from before and after the crop. `clients-stable.txt` in the evidence directory contains `unchanged`.
- **Proof.** The drive writes the files above. `result.txt` contains `feature: bar-label`, `entry: top-bar-left`, and `result: pass`.

## Gotchas

- `active: false` in `omarchy plugin list` does not mean the label is hidden. `enabled: true` means the widget is on the bar.
- A tight crop of the slot can cut off the last letter. The drive pads the crop. Assert `Paper Peek` in `bar-label.ocr.txt`, not a hand-copied rectangle.
- `grim -g` takes logical coordinates. Multiplying the slot by the monitor scale crops the wrong place.
- Doctor refuses when the monitor origin is not `0,0`, when more than one monitor is connected, or when more than one shell socket exists. That refusal is the result. Do not invent an offset and continue.
- The geometry x position changes when the workspace strip changes width. Read `geometry:` from doctor or `widget.json` from the drive. Do not reuse a previous x.
- `omarchy plugin validate /home/fred/Projects/omarchy-paper-peek` fails because that path is a symlink. The harness validates `~/.config/omarchy/plugins/binaryfever.paper-peek`.
- Saving a file under the plugin directory reloads the plugin record. It does not by itself repaint the label. Verification does not restart the shell to force a repaint.
- Reading `text: "Paper Peek"` from `BarWidget.qml` is not proof that the bar shows those words.
- `scripts/paper-probe` talks to Paper and rewrites docs. It does not show the bar label.
- Cleanup must leave the evidence directory in place. A missing PNG after cleanup means the run failed.
