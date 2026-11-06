# Settings live in one file

People change Paper Peek from `~/.config/paper-peek/settings.json`. The drawer reads that file when it loads, and again when the file changes. `inotifywait` watches `~/.config/paper-peek`, so a new drawer side does not need another shell restart. Loading this version of `Drawer.qml` the first time still needs `omarchy restart shell`, because the shell keeps the overlay it already started.

## Why the file sits outside the plugin

The plugin directory is the git checkout. A settings file there would be committed, and saving it would reload the plugin. The user's file is `~/.config/paper-peek/settings.json`. Tests point `PAPER_PEEK_SETTINGS` at another path.

## What the file controls

`src/settings.ts` parses the object. A missing key stays at its default. A bad value falls back, and `paper-fetch settings` writes a `paper-peek:` line to stderr. The drawer logs that warning too.

The keys are `toggleHotkey` (`SUPER + SHIFT + H`), `browserHotkey` (empty), `drawerSide` (`right`), `drawerWidth` (`480`), `refreshIntervalMs` (`2000`), `defaultMode` (`drawer`), and `paperAddress` (`127.0.0.1:29979`). The README lists the same keys.

`defaultMode` is `drawer`, `float`, or `dock`. It chooses the next open. It does not move a peek that is already showing.

`refreshIntervalMs` drives the status timer and the artboard watch. The watch still runs only while the drawer or the docked tile is open. Values outside 500 to 60000 fall back to 2000. Widths outside 240 to 1200 fall back to 480.

`paperAddress` is a host and a port. Requests use that host and port on the path `/mcp`. `PAPER_MCP_URL` wins when you run `paper-fetch` yourself. When the settings file exists, the drawer passes the file's address into its helper processes.

## Hotkeys

Super+Shift+H is already bound in `~/.config/hypr/bindings.lua` to `omarchy-shell fmchale.paper-peek toggle`. With no settings file, the plugin does not add or remove binds. When the file names a different toggle, or a browser chord, the plugin runs `hyprctl eval` with `o.bind`. It removes the previous chord that carries the same description. It does not edit `bindings.lua`. It leaves a chord alone when that chord's description belongs to something else, and it logs a warning.

An empty `browserHotkey` adds no bind. The browser command is `omarchy-shell fmchale.paper-peek browser`.

## What this leaves out

The corner float does not follow `drawerSide`. Float position stays in `float.json`. Theme colors are unchanged.

## Proof

`node --experimental-strip-types src/settings.test.ts` printed `settings.test.ts: ok`. The same runner printed ok for `src/paper-fetch.test.ts`, `src/paper-probe.test.ts`, and `src/float-geometry.test.ts`.

`scripts/paper-fetch apply-hotkeys` with no settings file left the toggle bind at modmask 65, key H, dispatcher `__lua`. A file that set `browserHotkey` to `SUPER + ALT + F12` added one bind, description `Open Paper Peek browser`, modmask 72. Deleting that file and running `apply-hotkeys` again removed the new bind. The toggle bind was still the original Lua bind.

`omarchy plugin validate` on the real plugin directory exited 0. `verify-paper-peek doctor` printed `verdict: worth-driving`.

This session could not show the drawer move. `omarchy-shell fmchale.paper-peek browser` returned `Function not found` after the reload log and after `omarchy-shell shell rescanPlugins`. `omarchy restart shell` refused because the session is locked. `drive bar-label` started `grim` and that capture did not return, so there is no screenshot.
