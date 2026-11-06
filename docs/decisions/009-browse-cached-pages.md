# A project opens its pages

Picking a project in the browser lists that project's pages from the cache. It does not open the project's last artboard, and it does not call Paper.

The hotkey still opens the current artboard. The Recent group still lists the last five. `resolve-project` still jumps to a remembered artboard for a caller that asks for that jump. The drawer does not ask.

## Why picking a project lists pages

[008](008-remembered-artboards.md) checked the remembered artboard when you picked its project. That check calls `get_basic_info` on an open file, and it replaces the page list with the shot. A project you have already viewed then has no way to reach its other artboards.

FMC-674 needs every artboard, from the keyboard or from the mouse, with no Paper call while the pages and artboards are already cached. Refresh remains the command that reads the project from Paper again.

Enter on the shot opens the project list. Arrow keys move, Enter goes in, Backspace goes back one level, and Escape leaves the browser. Escape on the shot still closes the drawer.

## Proof

`node --experimental-strip-types src/paper-fetch.test.ts` printed `paper-fetch.test.ts: ok`. A remembered project's cached pages and artboards make no Paper calls. The artboard rows keep the cache order.

`omarchy plugin validate ~/.config/omarchy/plugins/fmchale.paper-peek` exited 0.

`omarchy restart shell` refused because the session is locked. The running shell still has the previous drawer, so this note has no picture of the page list. `.cursor/skills/verify-paper-peek/verify-paper-peek drive bar-label` reached `grim` and did not return. The bar is a status dot, and the lock covered the screen.
