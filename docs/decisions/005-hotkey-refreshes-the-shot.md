# Opening the drawer refreshes the shot

`open()` reads `current.json`, shows the cached JPEG, and runs `scripts/paper-fetch shot` with that file id and node id. The drawer slides in on the cache. A zero exit from that command bumps a counter on the image URL (`?v=`), the same form `BackgroundMedia` uses, so Qt loads the new bytes at the same path.

`storeShot` writes `timestamp` in `shots/<fileId>/<nodeId>.json` only after `get_screenshot` for a file that `list_resources` marks open. A closed file or a down Paper server leaves the previous sidecar in place. The drawer keeps the last JPEG.

The hotkey is `SUPER + SHIFT + H` in `~/.config/hypr/bindings.lua`. `omarchy menu keybindings --print` did not list that chord. The bind runs `omarchy-shell fmchale.paper-peek toggle`. Omarchy loads this Lua file. The `{ ipc = "fmchale.paper-peek.toggle" }` helper splits on the first dot and would send the call to `fmchale` instead of the plugin id.

Existing binds are unchanged.

## Proof from this session

`omarchy menu keybindings --print` lists `SUPER SHIFT + H` once, as Toggle Paper Peek. `hyprctl configerrors` printed nothing. Pressing that chord opened the layer `fmchale-paper-peek`. The sidecar timestamp moved from `2026-11-06T04:54:00.660Z` to `2026-11-06T05:30:37.229Z`. A second press removed the layer. Tiled clients from `hyprctl clients` stayed put while the drawer was open and after it closed. The crop is [005-drawer-open.png](005-drawer-open.png).

`.cursor/skills/verify-paper-peek/verify-paper-peek drive bar-label` exited 0. OCR read Paper Peek. Tiled clients stayed put.

A save had already printed `Local plugin changed, reloading: fmchale.paper-peek`. The shell that was already running still opened the drawer without writing a new timestamp. `omarchy restart shell` loaded `open()`, and the press above wrote the new timestamp.
