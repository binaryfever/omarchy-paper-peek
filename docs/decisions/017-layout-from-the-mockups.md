# The drawer follows the layout mockups

The header, the rows, the footer and the float strip now carry what the
"Paper Peek Drawer Layout" canvas proposed. `docs/decisions/016-pinned-shot.md`
split the shot from its rows. This note finishes the rest of the same pass.

## What changed

The shot pane stops at `chrome.shotAspect` times the drawer's width, plus a
margin. The canvas draws the artboard 480 wide by 580 tall. A 393 by 852
artboard lands at 266 by 576 on a 480 drawer, whole. It used to take every
pixel the rows left, so on a 1350 tall screen it filled the drawer's width at
480 by 1040. The rows take the room past the cap, so
`docs/decisions/016-pinned-shot.md`'s four-row well is now a floor, not a
ceiling.

The image keeps `Style.spacing.rowPaddingX` on all four sides. Contain-fit puts
one of its axes on the pane's edge: the width for a landscape artboard, the
height for a portrait one. So a 1920 by 1080 artboard sat on the drawer's
border down both long edges, and a 393 by 852 one sat on the header's rule and
on the rule over its own rows. The cap carries the same margin, so the artboard
keeps the size the canvas drew it at and the margin goes around it. Rows still
bleed to the drawer's edge. The float card's artboard keeps that margin off the
card's border and off its strip.

The header title is one line. It elides. The trail sits `Style.spacing.sm`
under it, so the two lines no longer touch. A long artboard name used to wrap
and push the content down.

A repeated artboard name carries its ordinal. Page `p-H-0` holds four artboards
called `01 Light · Home`. The rows read `1 of 4` through `4 of 4` at
`Style.font.caption` on the right gutter. The node id stays out of the row. The
caption over the rows reads `Artboards · 40`.

A recent row's project is right-aligned on the far gutter. The artboard name and
the project each elide on their own.

A rule sits over the status line, as one sits under the header.

The float strip leads with the status dot, then the artboard name at
`Style.font.body`, elided. The name used to be a bold title that clipped.

## Why the cap follows the width, not the height

A share of the screen's height would redraw the artboard at a different size on
every monitor. The drawer's width is fixed by the settings file, so a cap tied
to it holds the artboard at the size it was drawn at. A landscape artboard
still fits the width and keeps its margin above and below.

## Why not every number from the canvas

The canvas measured a 14px gutter and a 22px footer. The drawer uses
`Style.spacing.rowPaddingX` and `Style.spacing.popupRowHeight`. A theme moves
both. A pinned pixel would not follow it.

## Proof

Every `src/*.test.ts` printed `ok`, `drawer-layout.test.ts` among them.

`omarchy plugin validate ~/.config/omarchy/plugins/fmchale.paper-peek` exited 0.

`omarchy restart shell` loaded the QML with no warning from the plugin. The
drawer, the project browser, the page list and the float card were each opened
and photographed. `docs/decisions/017-artboard-ordinals.png` is the artboard
well on that page of four identical names.

`docs/decisions/017-drawer.png` is the whole drawer on a 390 by 664 artboard.
That one fits by its height, so it shows the margin over the artboard and under
it. `docs/decisions/017-landscape.png` is a 1440 wide artboard in the same
drawer. That one fits by its width, so it shows the margin either side. Between
them every edge of the pane is covered. `docs/decisions/017-float.png` is the
corner card, with the same margin off its border and off its strip's rule.

On this 480 wide drawer the shot pane is 600 tall. A 393 by 852 artboard draws
at 266 by 576 inside it, which is the size the canvas drew. The rows take the
rest of the screen's height.
