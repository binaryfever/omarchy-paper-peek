# What the plugin guide asks for

Paper Peek was read against Omarchy's development and publishing guides at
plugins.omarchy.org. Nothing it does breaks a rule. Four things fell short of
what the guides ask for, and this note records the three choices among them.

## The license is MIT

A listing needs a license file beside the README. MIT is what the guide's own
example carries and what the shell's plugins use. It asks nothing of anyone
installing this.

## The manifest carries its author and description

The publishing guide's manifest table marks both required, and first party
manifests carry both. Ours had neither, so a listing would have had nothing to
show but the name.

## The dot comes from the theme

The bar widget drew its dot as a fixed 8 by 8 with a radius of 4. The guide
asks for the theme's own sizing on a one-off constant like that. It is now
`Style.spacing.sm * 2` across, with the radius following the height, which is
how the drawer's status line has always built the same dot. On the current
theme it draws at the same size it did.

## The tests clean up after themselves

`src/paper-fetch.test.ts` made scratch directories with `mkdtemp` and removed
three of them. 336 had collected under the temp directory, 1.6 MB, the oldest
from 6 November. Every scratch directory now goes on one list that the
existing `finally` empties, so a run that fails partway still cleans up. The
shipped plugin never did this; only the test did.

## Proof

Every `src/*.test.ts` printed `ok`, and a full run left the temp directory at
the same count it started at.

`omarchy plugin validate ~/.config/omarchy/plugins/fmchale.paper-peek` exited
0 with the new manifest fields. `omarchy restart shell` loaded the QML with no
warning from the plugin, and the bar's dot still draws green on a live Paper.
