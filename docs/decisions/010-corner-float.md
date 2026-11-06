# The corner float is a second layer

The drawer stays the default peek. A corner float is the other way to see the same artboard while you code. `F` in the drawer, the Float label, and `omarchy-shell fmchale.paper-peek layout` switch between them. `layout` returns `float` or `drawer`.

## Why a second layer

The drawer is a layer-shell overlay with `ExclusionMode.Ignore`, so Hyprland does not reserve a tile for it. The float is a second overlay, `fmchale-paper-peek-float`, only as large as the card. A layer surface is per output, so it stays up when you change workspace. The drawer layer hides while the float is up. `open`, `close`, and `toggle` still drive the drawer when the float is down. The hotkey hides the float, and the next press opens the drawer.

The card remembers `x`, `y`, `width`, and `height` in `~/.local/state/paper-peek/float.json`. `current.json` stays the artboard file, and `scripts/paper-fetch` stays its only writer. The first visit parks a 420 by 320 card 16px in from the bottom-right corner. A drag that ends within 64px of a corner snaps there. The minimum size is 180 by 140. Edges and corners resize the card.

Click-through is an empty input mask. `C` on the card, the Clicks label, and `omarchy-shell fmchale.paper-peek clickthrough` toggle it. The command returns `on` or `off`. Keyboard focus is `OnDemand` while the card catches clicks. `Exclusive` would take the keys the editor is using. While clicks pass through, the mask is empty, so `clickthrough` is how you catch clicks again.

The live-refresh timer still runs only while the drawer is open.

## What this leaves out

No new Hyprland bind. The existing Super+Shift+H chord is unchanged.

The running shell has not loaded this QML. `omarchy restart shell` refused because the session is locked. A plugin reload logged `Local plugin changed, reloading: fmchale.paper-peek`, and `qs ipc show` still lists `open`, `close`, `toggle`, and `status`. A new overlay filename was rejected by Qt as `File name case mismatch`. The type loader treats a file that was not in its directory cache as a case error. The entry point is `Drawer.qml` again, and those four commands answer. The float starts the next time the shell loads `Drawer.qml`.

`grim` did not return during `drive bar-label`. The session was locked. This note has no picture of the float.

## Proof

`node --experimental-strip-types src/float-geometry.test.ts` printed `float-geometry.test.ts: ok`.

On a 2400 by 1350 screen, the default box is `x` 1964, `y` 1014, 420 by 320. A box at 56, 56 snaps to 16, 16. A box at 800, 500 stays there. A box shoved off the screen comes back to the edge at the minimum size. An empty state file parses as missing. A state file whose `clickThrough` value is not a boolean is ignored.

`node --experimental-strip-types src/paper-fetch.test.ts` printed `paper-fetch.test.ts: ok`.

`omarchy plugin validate ~/.config/omarchy/plugins/fmchale.paper-peek` exited 0.

`.cursor/skills/verify-paper-peek/verify-paper-peek doctor` printed `verdict: worth-driving`. The widget was in section `left`, visible, 21 by 26 at 204, 0. The monitor was `HDMI-A-1` at 0, 0, scale 1.6.

`.cursor/skills/verify-paper-peek/verify-paper-peek drive bar-label` did not finish. `timeout 45` ended it with status 124. The evidence directory `~/.local/state/paper-peek/verify-evidence/20261106T081704Z-2928388` has `doctor.txt`, `widget.json`, and `clients-before.json`, and no PNG. `cleanup` left that directory in place.
