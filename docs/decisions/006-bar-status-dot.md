# The bar dot is one status word

The hello-world label is a dot. The word behind the dot is `live`, `not-live`, or `off`.

## Why one word

Off means `current.json` has no file id and node id. Off wins when Paper is running and nothing is chosen, because that is the empty plugin. Live means an artboard is chosen and `list_resources` answers. Not-live means an artboard is chosen and Paper does not answer. The drawer keeps the cached image and shows the words `not live`.

`paper-fetch status` prints the word and writes `~/.local/state/paper-peek/status`. The drawer runs that command every two seconds. The bar reads the file. `omarchy-shell fmchale.paper-peek status` returns the same word. A click on the dot calls the drawer's existing `open` IPC.

A port check was rejected. `list_resources` is the same reachability test the helper already uses, and the status command does not rewrite `projects.json`.

## What this leaves out

The dot does not choose an artboard. The bar-label drive still looks for the words Paper Peek, so that drive fails. A synthetic Super+Shift+H did not open the layer. The bind is still there and still runs `toggle`.

## Proof from this session

Paper was running and `current.json` named an artboard. `omarchy-shell fmchale.paper-peek status` printed `live`. The crop is [006-bar-dot-live.png](006-bar-dot-live.png).

Moving `current.json` aside made the same command print `off` within three seconds. The crop is [006-bar-dot-off.png](006-bar-dot-off.png). Putting the file back made it print `live` again.

`src/paper-fetch.test.ts` covers the three words. A closed port prints `not-live` and does not write `projects.json`. Paper itself was not quit. For the pictures, the status command was briefly replaced with one that prints `not-live`. The dot turned red. The crop is [006-bar-dot-not-live.png](006-bar-dot-not-live.png). `open` showed the cached artboard and the words `not live`. The crop is [006-drawer-not-live.png](006-drawer-not-live.png). The real command was put back, and status printed `live`.

`toggle` printed `open` and the layer `fmchale-paper-peek` was up. A second `toggle` printed `closed` and the layer was gone. Tiled clients did not move while the drawer was open. `omarchy menu keybindings --print` still lists `SUPER SHIFT + H` as Toggle Paper Peek.

`.cursor/skills/verify-paper-peek/verify-paper-peek drive bar-label` exited 1. OCR did not contain Paper Peek. `clients-stable.txt` said `unchanged`. The slot was 21 by 26.
