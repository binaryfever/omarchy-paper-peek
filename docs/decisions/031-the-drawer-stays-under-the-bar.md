# The drawer stays under the bar

Clicking the bar icon opened the drawer and then there was no way to close it
by the same route: the drawer covered the bar, so the icon underneath could not
be reached. Two separate faults, both now fixed.

## The surface took the bar's space

The drawer anchors to all four edges and painted a strip down one side of a
full-screen surface, with `exclusionMode: ExclusionMode.Ignore`. Ignore means
the surface both reserves nothing and ignores what anything else has reserved,
so it covered the bar's strip, and the drawer's input mask took every click
over that corner of the bar with it.

Omarchy's own dock has the same shape of problem and answers it with
`ExclusionMode.Normal` and `exclusiveZone: 0`: reserve nothing, but stay inside
what is left after the bar's reservation. The drawer now does the same. On this
machine the surface moved from `0,0 2400x1350` to `0,26 2400x1324`, which is
the bar's 26 px, and `hyprctl clients` is identical either side of a toggle, so
nothing tiled moved. That keep still holds.

## The icon only ever opened

`BarWidget.qml` called the `open` IPC target, not `toggle`, so even a reachable
icon would only have opened an already-open drawer. The hotkey has always
toggled. The icon does now too.

## What this costs

The drawer is the bar's thickness shorter, and `preview.png` was captured
before this, with the drawer running to the top of the screen. The image is
honest about the plugin but no longer pixel-exact; it is worth recapturing
whenever the listing is next touched.
