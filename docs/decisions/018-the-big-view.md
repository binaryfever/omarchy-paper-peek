# The artboard opens at the size of the screen

A click on the artboard, or `Space`, covers the monitor with the same cached
JPEG. A click anywhere, or `Escape`, puts the drawer back. The small view is
still what opens first.

`docs/decisions/016-pinned-shot.md` stopped the artboard from scrolling, and
`docs/decisions/017-layout-from-the-mockups.md` capped it at the size the
layout canvas drew it at. Both were right for reading the artboard beside
code, and both leave it too small to read the artboard itself. A 390 by 664
artboard draws at 324 by 552 in a 480 drawer. The big view draws that same
artboard at 764 by 1300, measured off the screenshot below.

## Why a third surface

The drawer's window already covers the monitor and masks its input down to the
480 strip, so the obvious move was to open that mask and paint over the whole
window. The float card is a second window, though, and the big view has to
cover that one too. A third window covers both, and it keeps the drawer's
reveal animation and the float's drag gestures out of the new state.

It maps after the other two on the same layer, so it stacks over them. It
carries no mask, so a click anywhere on the screen lands on it and closes it.

## Why the backdrop is opaque

The theme's popup background carries its own alpha, for the blur behind a
panel. At 94 percent over the desktop the windows underneath still read, and
the float card showed through as a bright patch in the corner. The backdrop
now takes the theme's color at full alpha. The drawer underneath is untouched:
the strip is pixel for pixel what it was when the big view opens and when it
closes, scroll offset and all.

## Why only one size

Fit to screen, and nothing else. A 1:1 toggle would want pan bounds, a drag
state and a second way out of the view. The artboards this reads are phone and
page screenshots, and on this 2400 by 1350 screen fit-to-screen is already
2.4 times the drawer's size.

## What this leaves out

Paper sends the screenshot at the artboard's own size. A 390 by 664 artboard
arrives as a 390 by 664 JPEG, so the big view scales it about three times and
the type goes soft, though it still reads. `get_screenshot` takes a `scale`
argument, and its own description says 2 is the setting for reading small
text. Fetching at that scale is its own change: it touches `scripts/paper-fetch`,
the shot cache budget from `docs/decisions/015-shot-cache-budget.md`, and every
JPEG already on disk at 1x. FMC-702 carries it.

A wide artboard, taller than 16 by 9 is wide, still fits by its height. There
is no caption in the big view, so the artboard's name is only on the drawer
behind it.

## Proof

Every `src/*.test.ts` printed `ok`. `drawer-layout.test.ts` covers `zoomFrame`
for a portrait artboard, a wide one, a 16 by 9 one that fits by its height
instead, an unmeasured one, a box too small for its own margin, and an empty
box. One case asserts the big view is at least twice the drawer's artboard.

`omarchy plugin validate ~/.config/omarchy/plugins/fmchale.paper-peek` exited 0.

`omarchy restart shell` loaded the QML with no warning from the plugin.
`Space` opened and closed the big view from the drawer, `Escape` closed it, and
`Escape` again closed the drawer, so the drawer's own key did not change.
`F` still floats. `hyprctl layers` showed `fmchale-paper-peek-zoom` over
`fmchale-paper-peek` and over `fmchale-paper-peek-float`.

A zoom round trip added no `fetch` line to `~/.local/state/paper-peek/refresh.log`,
only the `check` lines the two second watch was already writing.

`magick compare` put the drawer strip at 0.07 differing pixels out of 1658880
across a zoom round trip, which is antialiasing noise.

`docs/decisions/018-small-view.png` is the drawer on a 390 by 664 artboard.
`docs/decisions/018-big-view.png` is the same artboard in the big view.
