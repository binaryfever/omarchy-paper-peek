# The drawer lends the keyboard back

The drawer's layer surface asked for `WlrKeyboardFocus.Exclusive` while it was
open. Exclusive means every key goes to that surface and nowhere else, for as
long as it is up. So with the drawer open you could click your editor, watch
Hyprland make it the active window, type, and lose every keystroke. A plugin
for reading a design while you code stopped you coding.

`docs/decisions/010-corner-float.md` had already written the rule down for the
float card: "Exclusive would take the keys the editor is using." The drawer was
never held to it. `docs/decisions/004-slide-in-drawer.md` only ever claimed
that clicks pass through, and clicks did. Keys never did.

The drawer is now `OnDemand`. Hyprland hands an OnDemand surface the keyboard
when it maps, so `Escape` and `Space` still work straight after the toggle
hotkey with nothing clicked, and it gives the keyboard up the moment another
window takes focus. Clicking the drawer takes it back.

## The big view moved into the drawer's window

The big view from `docs/decisions/018-the-big-view.md` keeps `Exclusive`. It
covers the monitor, so there is nothing else to type into, and `Escape` has to
reach it.

That forced the surfaces together. While the big view was a second window,
closing it unmapped an Exclusive surface, and the keyboard came back belonging
to no one: `Escape` no longer reached the drawer, and typing no longer reached
the window either, until something was clicked. Both are the same surface now,
so leaving the big view is a change of one property on a window that never
unmaps, and the focus never goes anywhere to come back from.

The big view had its own window because the float card was a second window that
it had to cover. `docs/decisions/019-remove-the-corner-float.md` deleted the
float, so there was nothing left to cover. The `fmchale-paper-peek-zoom` layer
is gone, and the drawer's own mask opens from the strip to the whole screen
while the big view is up, the way the Omarchy bar opens its mask during a drag.

## Proof

A scratch terminal ran `cat > file` and `wtype` typed at it. With the drawer
open and that terminal focused, the text arrives. A `Space` with it focused
typed a space into it instead of opening the big view. Before this change,
with the same window focused by the same dispatcher, nothing arrived at all.

Straight after `open`, with nothing clicked: `Space` raised the big view,
`Escape` dropped it with the drawer still open, `Escape` again closed the
drawer, and typing then reached the terminal. The big view also still opens
over the docked tile.

Every `src/*.test.ts` printed `ok`.
`omarchy plugin validate ~/.config/omarchy/plugins/fmchale.paper-peek` exited 0,
and `omarchy restart shell` loaded the QML with no warning from the plugin.
