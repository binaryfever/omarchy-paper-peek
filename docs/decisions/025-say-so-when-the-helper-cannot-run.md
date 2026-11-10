# Say so when the helper cannot run

Paper Peek reads Paper through `scripts/paper-fetch`, a shell shim that execs
Node. With no Node on the path the shim exits 127 and prints nothing to
stdout, which is exactly what the helper does when Paper is closed. The drawer
treated the two the same way: last cached shot, no explanation, and a status
line that still said Live. One of those faults is the reader's to fix and the
other is not, and the drawer gave them nothing to tell them apart.

## Only 126 and 127 are the shim's own

A shell answers 127 when it cannot find what it was asked to run, and 126 when
it finds it but may not run it. Those two codes are the shim failing to start,
not the helper reporting on Paper. Every other code is the helper speaking,
and the drawer already has words for what it says. So `helperFault` names
those two and returns an empty string for everything else, including 0 and the
helper's own exit 3.

The fault is taken from the exit code of runs that already happen — the status
check and the command path — so nothing new runs on a timer. A run that works
returns an empty string and clears whatever a broken one left behind.

## The fault takes the notice slot

The drawer keeps one text slot under the header. A helper that will not run
outranks a notice from one that did, because every other line in the drawer is
then describing a cache that cannot be refreshed, and the reader is owed the
reason. `noticeLine` prefers the fault and falls back to the notice.

For the same reason the fault suppresses "Nothing cached yet" the way a notice
already did. Otherwise the drawer answers the reader twice: the fault says
there is no Node, and the placeholder offers a competing explanation beside it.

## A fault retires the status word

This one was only visible once the fault line was on screen. The status word
and its dot come from a file the helper writes, read back through a `FileView`
at startup. That file outlives the helper that wrote it, so with the shim
broken the footer kept saying **Live** directly under the line explaining that
nothing could be checked.

A drawer that cannot run its helper does not know what Paper is doing. The
honest answer to not knowing is the one it already has for not knowing, so
`shownStatus` returns `off` whenever a fault is set, and the dot, the word and
the `status` IPC function all go through it. Nothing changes while the helper
works.

## Proof

With `scripts/paper-fetch` pointed at a binary that does not exist, the shim
exits 127, and the drawer names Node as the reason, keeps showing the last
cached artboard, and reads **Off** with a muted dot. See `025-fault.png`.

With the shim restored the line is gone and the footer reads **Live** again,
from the same cache and the same artboard. See `025-healthy.png`.

A shim with its execute bit cleared exits 126, which is the other message, and
`omarchy plugin validate` exits 0. Every `src/*.test.ts` printed `ok`.
