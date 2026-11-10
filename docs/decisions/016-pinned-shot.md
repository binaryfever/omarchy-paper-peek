# The shot fits its pane

The artboard image contain-fits a region that does not scroll. The artboard rows sit under a rule in a second region that scrolls on its own. The new regions reverse `docs/decisions/014-artboard-column.md`. That decision fit the image to the column width. It scrolled the image and the rows together.

## Why the regions split

A 393 by 852 artboard fit to the drawer width is taller than the pane. The width-fit column puts the first artboard row below the fold. Scrolling that column moves the image. The image scales into the shot region. The well under the rule shows as many as four rows. The well steps down toward one row. Stepping down keeps the shot visible. The first artboard row stays on screen whenever the shot is visible. The list's scroll offset is not the shot's position.

## What this leaves out

The corner float still has no artboard list. `scripts/paper-fetch` still writes `current.json` alone. The footer stays one fixed line. A status change does not move the image.

## Proof

`node --experimental-strip-types src/drawer-layout.test.ts` printed `drawer-layout.test.ts: ok`.

`omarchy plugin validate ~/.config/omarchy/plugins/fmchale.paper-peek` exited 0. That path is the real plugin directory.
