# An icon among the status icons

The bar widget was a plain green circle and it defaulted to the `left`
section, which put it next to the workspace numbers. All three are now changed:
it is the bar font's artboard glyph, it takes its colours from the theme's own
roles, and the manifest defaults to `right`.

## Left is for the workspaces

Of Omarchy's own bar entries, only `ActiveWindow` defaults to `left`. Tailscale,
Dropbox, Elsewhen and the keyboard layout all default to `right`, into the
cluster that holds bluetooth, network, audio and the monitor. Paper Peek is the
same kind of thing — a state you glance at and a button you press — so it
belongs in that cluster.

Worse than being out of convention, a bare green circle sitting immediately
after the workspace numbers reads as another workspace. The left section is for
the workspaces; nothing else should be mistakeable for one.

## A frame, not a photograph

`Ui/WidgetButton` draws a single private-use codepoint from the bar's own font
as an icon, which is how every first-party icon on that bar is drawn. Outline
weight, so it carries the same visual weight as the bluetooth and wifi glyphs
beside it rather than shouting over them.

The first try was `nf-md-image-outline`, a framed picture, and it read as a
photo viewer. An artboard is a canvas you lay a design out on, and the mark for
that everywhere else is a frame with handles at its corners. The glyph is
`nf-md-vector-square`, U+F0001, present in JetBrainsMono Nerd Font, the family
`monospace` resolves to here.

## The colours are roles, not a green

The circle painted Connected with the theme's `green` key, which
`docs/decisions/013-theme-colors.md` chose on the reasoning that urgent was
already red and muted already grey. Following a palette is not the same as
following a theme: `Commons.Color` keeps foreground, background, accent, urgent
and muted, and `green` is not among them, so the bar had to read `colors.toml`
itself to get one. That is a role the shell does not have.

Connected now draws in `Commons.Color.accent`, Not connected in
`Commons.Color.urgent`, No artboard in `Commons.Color.muted` — the same three
roles the drawer's footer dot already drew, so the two cannot drift. The
tooltip still names the state. `theme-green.js`, its test and its entry in
`PUBLISHED_PATHS` are gone with the green.

## The tray is a choice, not the default

An entry in the `tray` section is drawn inside the tray's drawer, behind the
chevron, so it is hidden until that drawer is expanded. That is a reasonable
place for someone who wants a quiet bar, and it is where this machine's own bar
puts it. It is not the published default: a fresh install that shows nothing on
the bar looks like an install that failed. The manifest says `right`, and the
bar picker moves it from there in one step.
