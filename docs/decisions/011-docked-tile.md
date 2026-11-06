# The docked tile is a window the plugin opens

`omarchy-shell fmchale.paper-peek dock` opens the current artboard in a normal window. Hyprland tiles that window, so the workspace splits between the code and the design. `undock` hides it. Closing the window does the same. The hotkey hides the tile the way it hides the corner float, and the next press opens the drawer.

## Why the plugin opens the window

The drawer and the corner float are layer-shell overlays. `ExclusionMode.Ignore` keeps them out of `hyprctl clients`, which is the point of those two modes. A tiled client has to be an xdg toplevel. Quickshell's `FloatingWindow` is that toplevel. Omarchy's dev gallery already puts one inside a plugin, and Hyprland matches it as class `org.quickshell`. A second viewer process would redraw the browser and the refresh timer that `Drawer.qml` already owns. The plugin opens the window itself.

The only Hyprland rule for `org.quickshell` maximizes the dev gallery by title. The tile's title is `Paper Peek`, so that rule does not apply. No new bind. Super+Shift+H stays the drawer and float hotkey.

## What the tile shows

The drawer body moves into the window for as long as the tile is up, then moves back. The browser, the shot, and the remembered artboard stay that one body. `current.json` stays the artboard file. `scripts/paper-fetch` stays the only writer. The live-refresh timer runs while the drawer is open or the tile is up. The corner float still does not run it.

`dock` while the tile is already up leaves the one window. `undock` while it is down is a no-op. `open` closes the tile and shows the drawer, so the body has one parent. `close` still only hides the drawer and the float.

## What this leaves out

The running shell did not load this `Drawer.qml`. A plugin reload logged `Local plugin changed, reloading: fmchale.paper-peek`, and `dock` and `layout` both returned `Function not found`. `omarchy restart shell` refused because `solitaryBlockedBy` contains `LOCK` and `omarchy-shell lock status` reports `secure`. There is no lock layer in `hyprctl layers`. Restarting the shell was left alone.

## Proof

`node --experimental-strip-types src/paper-fetch.test.ts` printed `paper-fetch.test.ts: ok`.

`node --experimental-strip-types src/float-geometry.test.ts` printed `float-geometry.test.ts: ok`.

`omarchy plugin validate ~/.config/omarchy/plugins/fmchale.paper-peek` exited 0.

A separate Quickshell config, not the Omarchy shell, opened a `FloatingWindow` titled `Paper Peek`. `hyprctl clients` listed it as class `org.quickshell`, `floating` false, on workspace 1, at `[1231, 38]`, size `[1152, 1300]`. `grim` did not return, so this note has no picture. The process was killed. Workspace 1's tiled windows were then each 152px to the left of the snapshot taken before the window opened. Sizes were unchanged except one window, 1753px wide before and 1752px after. `hyprctl dispatch` on this build accepts a lua dispatcher, and the classic `movewindowpixel` command did not move them back.

`.cursor/skills/verify-paper-peek/verify-paper-peek doctor` printed `verdict: worth-driving`. The bar slot was `204,0 21x26`, section `left`, visible. The monitor was `HDMI-A-1` at `0,0`, scale 1.6.

`drive bar-label` was stopped after 25 seconds. It wrote `clients-before.json`, `crop.txt`, `doctor.txt`, `geometry.json`, `plugin.json`, and `widget.json` under `~/.local/state/paper-peek/verify-evidence/20261106T084724Z-2983177`, and no PNG. `grim` is the step that does not return.
