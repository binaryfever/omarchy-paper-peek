# The corner float goes

The float card is removed. `docs/decisions/010-corner-float.md` is reversed.
The drawer, the big view from `docs/decisions/018-the-big-view.md`, and the
docked tile from `docs/decisions/011-docked-tile.md` are what is left.

## Why

The float answered one want: the artboard bigger than the drawer draws it,
and still beside the code. It answered it with a card you drag by its strip,
resize from any edge, snap to a corner, and switch in and out of click-through
with `C`. That card carried a second copy of the artboard, a second status
dot, its own geometry file at `~/.local/state/paper-peek/float.json`, its own
`scripts/float-geometry` to snap it, and its own key handler. 494 of the 1600
lines in `Drawer.qml` were its.

The big view answers the same want in one click and one key, with no geometry
to save. Anyone who wants the artboard in a window they can tile has the
docked tile, which is a real Hyprland window and so is the window manager's
problem rather than this plugin's.

## What went

`Drawer.qml` lost the float window, the card, the strip, the drag and resize
gestures, the click-through mode, and `screenSize`, `parseFloatText`,
`clampFloat`, `placeDefault`, `applyFloatText`, `saveFloat`, `dragFloat`,
`resizeFloat`, `finishFloatSize`, `snapFloat`, `applySnapText`, `enterFloat`,
`leaveFloatToDrawer` and `togglePassClicks`. `src/drawer-layout.js` lost
`floatTitle` and the float action. `src/float-geometry.ts`,
`src/float-geometry.test.ts` and `scripts/float-geometry` are deleted.

`F` in the drawer now does nothing. The header strip is Zoom and Browse, plus
Back when the drawer is holding a page.

The `layout` and `clickthrough` IPC methods are gone, and
`omarchy-shell fmchale.paper-peek layout` answers `Function not found.` There
was nothing left for them to switch. `toggle`, `open`, `browser`, `close`,
`status`, `zoom`, `dock` and `undock` stay.

`float` is no longer a `PeekMode`. A settings file that still says
`defaultMode: float` opens the drawer and logs one `paper-peek:` warning, the
same as any other value that is not a mode.

## What stays on disk

`~/.local/state/paper-peek/float.json` is left where it is. Nothing reads it
now. It is the user's file, and deleting a user's file to tidy up after a
feature that used to write it is not this change's business.

## Proof

Every `src/*.test.ts` printed `ok`. `drawer-layout.test.ts` walks every view,
hold and zoom combination and asserts no header action is a float.
`settings.test.ts` covers `defaultMode: float` falling back to `drawer` with a
warning.

`omarchy plugin validate ~/.config/omarchy/plugins/fmchale.paper-peek` exited 0.

`omarchy restart shell` loaded the QML with no warning from the plugin.
`hyprctl layers` showed `fmchale-paper-peek` alone, and
`fmchale-paper-peek-zoom` over it while the big view was up. `F` left the
drawer where it was. `Space` opened the big view and `Escape` closed it.
`layout` and `clickthrough` both answered `Function not found.`. `dock` opened
a 1181 by 643 window titled Paper Peek and `undock` closed it.
