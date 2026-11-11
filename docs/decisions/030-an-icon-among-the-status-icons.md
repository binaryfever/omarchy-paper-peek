# An icon among the status icons

The bar widget was a plain coloured circle and it defaulted to the `left`
section, which put it next to the workspace numbers. Both are now changed: the
circle is the bar font's framed-picture glyph, and the manifest defaults to
`right`.

## Left is for the workspaces

Of Omarchy's own bar entries, only `ActiveWindow` defaults to `left`. Tailscale,
Dropbox, Elsewhen and the keyboard layout all default to `right`, into the
cluster that holds bluetooth, network, audio and the monitor. Paper Peek is the
same kind of thing — a state you glance at and a button you press — so it
belongs in that cluster.

Worse than being out of convention, a bare green circle sitting immediately
after the workspace numbers reads as another workspace. The left section is for
the workspaces; nothing else should be mistakeable for one.

## A glyph, still coloured

`Ui/WidgetButton` draws a single private-use codepoint from the bar's own font
as an icon, which is how every first-party icon on that bar is drawn. The glyph
is `nf-md-image-outline`, U+F0976, present in JetBrainsMono Nerd Font, the
family `monospace` resolves to here. Outline weight, so it carries the same
visual weight as the bluetooth and wifi glyphs beside it rather than shouting
over them.

The three states did not change and neither did their colours: the glyph is
tinted with the theme accent for Connected, urgent for Not connected and muted
for No artboard, exactly as the circle was. The tooltip still names the state,
and the drawer's own footer still draws the circle, because there it sits
beside the word and is not competing with any icons.

## The tray is a choice, not the default

An entry in the `tray` section is drawn inside the tray's drawer, behind the
chevron, so it is hidden until that drawer is expanded. That is a reasonable
place for someone who wants a quiet bar, and it is where this machine's own bar
puts it. It is not the published default: a fresh install that shows nothing on
the bar looks like an install that failed. The manifest says `right`, and the
bar picker moves it from there in one step.
