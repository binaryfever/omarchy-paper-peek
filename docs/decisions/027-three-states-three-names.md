# Three states, three names

The drawer's footer read Live, Not live, or Off. Two problems with that.

"Live" did not say live what. It could be read as the connection being up, or
as the image on screen being current. Both are things the plugin does, so the
word never settled on one.

"Off" was not a connection state at all. It means no artboard has been picked
yet, which is a different kind of fact from Paper being unreachable, and the
footer filed them under the same vocabulary.

## The words

| state | was | is |
| --- | --- | --- |
| artboard picked, Paper answered | Live | Connected |
| artboard picked, Paper silent | Not live | Not connected |
| nothing picked yet | Off | No artboard |

None of them says "Paper". The panel is Paper Peek and the header two lines
above names the file, so putting it in every footer state is noise.

## The fault moved off `off`

FMC-709 made `shownStatus` fall back to `off` whenever the helper could not
run, reasoning that the drawer does not know what Paper is doing and should
give the answer it already has for not knowing. That was true while `off` drew
as "Off".

It stopped being true the moment `off` drew as "No artboard", because in that
state an artboard is picked and visible on screen. A helper that will not run
is a drawer that cannot reach Paper, so the fault now lands on `not-live` and
its urgent dot. The reason is already on the notice line above, so the footer
does not have to carry it.

## The tokens did not move

`peekStatus` still returns `live`, `not-live` and `off`, and the `status` IPC
function still answers with those. They are an interface something else can
script against. Only the drawn words changed.

## The bar keeps its own copy

`BarWidget.qml` draws the same three words in its tooltip, and a test from the
drawer-layout refactor forbids the bar from importing the drawer's layout
module at all. That rule is worth keeping: the bar loads on every shell start
and should not pull in the drawer's layout for one string.

So the bar repeats the three literals, and a test holds them against
`statusWord` for each token. The duplication is deliberate and the test is
what stops the two drifting into separate names for one state.

## Proof

`027-three-states.png` is the footer in each state, captured live.

The middle one was produced by pointing `scripts/paper-fetch` at a binary that
does not exist, which is the FMC-709 fault path: the notice line reads "Paper
Peek reads Paper through Node, and there is no node on the path", the footer
reads Not connected on the urgent dot, and the cached artboard still shows. The
third was produced by moving `current.json` aside, and it was put back.

`qs -p /usr/share/omarchy/shell ipc call fmchale.paper-peek status` printed
`live`, `not-live` and `off` in the three states, unchanged.

`omarchy plugin validate` exits 0 and every `src/*.test.ts` prints `ok`.
