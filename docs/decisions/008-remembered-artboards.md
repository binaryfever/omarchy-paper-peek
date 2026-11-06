# The last artboard is remembered per project

The hotkey opens the artboard you were viewing. Each project keeps its own last artboard, and the browser lists the last five viewed artboards, newest first. One file, `~/.local/state/paper-peek/current.json`, holds all of that. `scripts/paper-fetch` is the only writer. The drawer reads the file and runs the helper.

## What the file holds

The top-level `fileId`, `pageId`, and `nodeId` are still the artboard the hotkey opens. An older file with only those three fields still counts. The first resolve adds `byFile` and `recent` around it.

`byFile` maps a project file id to the last artboard viewed in that project. `recent` keeps five artboards across projects, newest first. Viewing an artboard again moves it to the front and does not add a second row.

## When an artboard is gone

On open, and when you pick a project, the helper asks Paper whether that artboard is still there.

An open file is checked with `get_basic_info` for its page. If the node is missing, the drawer opens the browser and shows `That artboard is gone.` The missing artboard is dropped from `recent` and from that project's slot. Other projects stay.

A closed file is not checked. `get_basic_info` would open a background tab, and Paper has no tool that closes one. The drawer keeps the cached shot. Paper down does the same. A project list that is truncated and does not include the file also keeps the shot, because the file might still exist past the limit.

## The browser

The running drawer had no browser yet. The recent list and the fallback need one, so this change adds the project, page, and artboard lists.

`Browse` opens it. `Recent` is the first group. Projects are grouped by folder. A folder that is itself named Projects is that one header, not a second copy. Pages stay in Paper's order. Picking an artboard stores it and shows the shot. Arrow keys move, Enter opens the row, Backspace goes up a level, and Escape leaves the browser.

Pages and artboards come from the cache. `Refresh` is the call that reads Paper again.

The live-refresh timer is unchanged. It still runs only while the drawer is open, the status word is `live`, and an artboard is chosen.

## What this leaves out

The shell that is running now did not load this QML. `omarchy restart shell` refused because the session is locked. `grim` did not return a crop, so this note has no picture of the drawer. The hotkey chord is unchanged.

## Proof from this session

`node --experimental-strip-types src/paper-fetch.test.ts` printed `paper-fetch.test.ts: ok`.

Against live Paper, resolve of file `01M3FYEHC2WZ9YC2DC3AJMX995`, page `p-1-0`, node `1-0` printed `{"kind":"shot"}`. A node id `missing-node` on that open file printed `{"kind":"projects","notice":"That artboard is gone."}`.

`browser projects` listed Tokens for Thoughts in Design site, then the Audiol artboard that was viewed after it, newest first. `resolve-project` for each file printed `{"kind":"shot"}`. The user's `current.json` was left byte for byte as it was before those commands. They used `PAPER_PEEK_STATE` on a temp file.

`omarchy-shell fmchale.paper-peek open` on the already running shell returned `ok`. The layer `fmchale-paper-peek` was 2400 by 1350. Tiled clients did not move. `close` removed the layer. That shell is still the previous drawer. Its `current.json` did not gain `recent`.

`.cursor/skills/verify-paper-peek/verify-paper-peek doctor` printed `verdict: worth-driving`. `drive bar-label` reached `grim` and did not return. The bar is a status dot, so that drive was already expected to miss the words Paper Peek.
