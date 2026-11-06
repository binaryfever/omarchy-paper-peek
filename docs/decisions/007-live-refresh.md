# The open drawer follows the file stamp

Paper's MCP server has no watch tool. `list_resources` returns `updatedAt` for each file. That number is the change signal.

`paper-fetch watch` reads the number for the drawer's file and compares it with `updatedAt` on the shot sidecar. The same number prints `unchanged` and does not call `get_screenshot`. A different number, including a sidecar that has no number yet, prints `changed`. The drawer then runs the existing `shot` command, which stores the new number with the JPEG.

The drawer timer runs only while the drawer is open, the status word is `live`, and an artboard is chosen. The interval is two seconds, the same interval as the status probe. Closing the drawer stops the timer.

A closed file prints `unchanged`, because a screenshot of a closed file opens a tab. A missing `updatedAt` also prints `unchanged`. Paper down prints `down`. Each check and each fresh screenshot is a line in `~/.local/state/paper-peek/refresh.log`.

The script resolves its own path, so `scripts/paper-fetch` runs when the project directory is a symlink. The drawer calls the real plugin path.

## What this leaves out

An edit that does not move the file's `updatedAt` does not refresh the drawer. A change on another artboard in the same file does move that number, and the shown shot refreshes.

The running shell has not loaded the new timer. `omarchy restart shell` refused because the session is locked. A plugin reload logged `Local plugin changed, reloading: fmchale.paper-peek`, and opening the drawer still wrote no `check` lines. The new timer starts the next time the shell loads `Drawer.qml`.

`grim` did not return a crop while the session was locked, so this note has no picture of the drawer.

## Proof

`node --experimental-strip-types src/paper-fetch.test.ts` printed `paper-fetch.test.ts: ok`.

Against live Paper, file `01M3FYEHC2WZ9YC2DC3AJMX995` and node `1-0`, 30 `watch` calls over 63 seconds appended 30 `check ... unchanged` lines and no `fetch` line. `projects.json` kept mtime `1793946204`.

Setting the sidecar `updatedAt` to `1` made the next watch print `changed`. The following `shot` exited 0, wrote `updatedAt` `1790658894817`, and moved `timestamp` from `2026-11-06T06:23:24.581Z` to `2026-11-06T06:29:52.215Z`. The next watch printed `unchanged`.

With the drawer closed, `refresh.log` stayed at 34 lines for 8 seconds. The status command still printed `live`. `.cursor/skills/verify-paper-peek/verify-paper-peek doctor` printed `verdict: worth-driving`. The bar slot was `204,0 21x26`, section `left`, visible.

Before any of this, `quickshell` pid `2674427` used 0.08% of one core over 12 seconds (1 tick at 100 Hz). Load average was 0.16 on 16 cores. That sample is the shell that is still running the previous drawer. It does not include the new timer.
