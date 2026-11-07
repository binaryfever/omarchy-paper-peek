# The artboard column fills the drawer

The shot and the current page's artboard rows share one scroll in the artboard column. A short JPEG with a short list sits centered in the column. The footer keeps a fixed height for every status, so Paper going down does not move the image. Artboards are not a separate browser view. `scripts/paper-fetch` still writes `current.json`. Return on the artboard column still opens the project browser.

## Why one scroll column

A fixed list pane under a second flick would shrink a tall artboard or leave a gap under a short one. The shot stays fit to the column width, and the rows follow it in the same flick.

We rejected a `PageColumn` child that only centered a column. The drawer still has to know whether the JPEG belongs on the listed page, start `paper-fetch`, and parse the catalog. A child would not shrink that work.

## Proof

`node --experimental-strip-types src/paper-fetch.test.ts` printed `paper-fetch.test.ts: ok`.

`omarchy plugin validate ~/.config/omarchy/plugins/fmchale.paper-peek` exited 0.

`omarchy restart shell` refused because the session lock is secure. The running shell still has the previous drawer, so this note has no picture of the column.
