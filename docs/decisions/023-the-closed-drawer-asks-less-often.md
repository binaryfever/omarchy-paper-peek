# The closed drawer asks less often

The status check runs at its own rate while the drawer is open and at a
fifteenth of that while it is closed. Opening the drawer runs one check
straight away.

## Why

The check ran every two seconds from login to logout, whether or not the
drawer had ever been opened. Each run is a process start and a request to
Paper: `scripts/paper-fetch` is a shell shim that execs Node, and Node on this
machine resolves through a mise shim before any of our code runs. Measured
here, one run costs 0.18 seconds of wall time and 0.14 of CPU. At one run
every two seconds that is about 9% of a core, held for as long as the session
lasts, to keep one dot on the bar current.

While the drawer is closed that dot is the only thing reading the answer.
Nobody watches a dot the way they watch an artboard, and the drawer runs its
own check the moment it opens, so a closed drawer can ask every half minute
and lose nothing a person would notice.

While the drawer is open the old rate is right. The artboard is on screen, and
`docs/decisions/007-live-refresh.md` ties what it shows to what Paper reports.

## What changed

`statusTimer` in `Drawer.qml` takes `refreshIntervalMs` while `opened` or
`docked`, and `refreshIntervalMs * idleStatusFactor` otherwise. The factor is
15, so the default 2000 becomes 30000. It is derived rather than set on its
own, so a theme of one knob stays one knob: a user who slows the open rate
slows the closed one with it.

Changing a running timer's interval restarts its countdown, so opening the
drawer would otherwise hold the last slow answer for a further two seconds, in
front of the one person looking at it. `onOpenedChanged` and `onDockedChanged`
run a check at once instead.

The artboard watch is untouched. It already ran only while the drawer was
open.

## What it measures

Recorded by sampling the process table for the status process:

* closed, 40 seconds: two runs, 30.0 seconds apart
* open, 12 seconds: six runs, at 2.0, 2.1, 1.9, 2.0 and 2.0 seconds apart,
  the first 0.06 seconds after the open

Over an hour with the drawer closed that is 120 process starts instead of
1800.

## Proof

Every `src/*.test.ts` printed `ok`. `drawer-layout.test.ts` reads `Drawer.qml`
and fails if the closed drawer goes back to the open rate; the check was
confirmed by removing the backoff and watching it fail.

`omarchy plugin validate ~/.config/omarchy/plugins/fmchale.paper-peek` exited
0. `omarchy restart shell` loaded the QML with no warning from the plugin, and
the dot still reads Live.
