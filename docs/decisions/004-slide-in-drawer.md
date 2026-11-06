# The drawer is an overlay on the same plugin

The drawer is a second entry point on `fmchale.paper-peek`. The bar label stays a bar widget. The drawer is an overlay: a right-edge layer-shell window with `ExclusionMode.Ignore`, so Hyprland does not reserve a tile for it. Escape closes it. `omarchy-shell fmchale.paper-peek open`, `close`, and `toggle` drive it, and the shell's own `summon`, `hide`, and `toggle` call the same `open()` and `close()`.

## Why an overlay

A bar-widget-only plugin sends `shell toggle` to the chip in the bar. That chip is not a layer-shell surface, so it cannot sit over tiled windows. The overlay loader is the host path that already does. `keepLoaded` keeps the IPC target alive while the drawer is closed, and lets the slide finish after `close()`.

The layer covers the monitor and ignores exclusive zones. The painted drawer is a strip on the right, and it slides by moving that strip. A short artboard does not shrink the strip. Input is limited to the strip, so the windows underneath still take clicks. The shell's fullscreen overlay helper waits until its own content covers the monitor. This surface does not use that helper.

## What the drawer reads

`~/.local/state/paper-peek/current.json` names the current artboard. It is hand-written for this change. The fields are `fileId`, `pageId`, and `nodeId`. Each id must match `^[A-Za-z0-9_-]+$`.

The JPEG and the names stay where `scripts/paper-fetch` writes them. The image is `shots/<fileId>/<nodeId>.jpg`. The header is the project name from `projects.json`, the page name from `pages/<fileId>.json`, and the artboard name from `artboards/<fileId>/<pageId>.json`, joined with ` › `. A missing name falls back to the id. A missing file leaves the drawer open with "No cached artboard". The drawer does not run `paper-fetch` and does not call Paper.

`PAPER_PEEK_CACHE` overrides the cache directory, same as the helper. `XDG_STATE_HOME` overrides the state directory.

## What this leaves out

Choosing an artboard in the drawer is a later change. So is the hotkey. There is no list of recent artboards yet. The state file is only the current one.

## Proof from this session

`omarchy-shell fmchale.paper-peek open` returned `ok`. The layer `fmchale-paper-peek` measured 2400 by 1350 at the origin, the size of the only monitor. `toggle` returned `closed` and the layer was gone. Escape closed it too. `omarchy-shell shell toggle` opened it, and `shell hide` closed it. A second `close` returned `ok`. Tiled windows from `hyprctl clients` did not move.

The state file pointed at file `01M3FYEHC2WZ9YC2DC3AJMX995`, page `p-1-0`, node `1-0`. The header was Thoughts in Design site › Page 1 › Tokens. The crop is [004-drawer-open.png](004-drawer-open.png).

A JPEG three times that artboard's height stayed inside the drawer and was cut off at the bottom of the strip. `scripts/paper-fetch` was not modified. The bar drive `drive bar-label` exited 0, OCR read Paper Peek, and tiled windows stayed put.
