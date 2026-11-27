# A hung Paper reply gives the slot back

`scripts/paper-fetch` posts to Paper and then reads the whole reply. The post
and that read share one deadline of 8 seconds. When the deadline fires, the
helper fails with `paper-down`, the same result it already returns when the
connection is refused, and the caller keeps the last cached image. A reply
that finishes inside the deadline is read as before.

## Why eight seconds

The open drawer asks every 2000 ms. The closed drawer asks at 15 times that,
30000 ms. While a helper is running, the drawer skips the next status check,
the artboard watch, and the next shot. A Paper that accepts the connection and
never finishes the body used to hold that slot until the process was killed.

Eight seconds is four times the default open refresh. A 2× shot is a JPEG
whose long edge Paper caps at 2000 pixels. The largest one measured, a 1440 by
900 artboard asked for at 2, came back at 285485 bytes. On loopback that body
is a small part of a second once Paper has rendered it, and a helper that only
lists resources was measured at 0.18 seconds of wall time. The remaining time
is for the render, including an artboard heavier than the two that were
measured, and a shot that takes about as long as one refresh still arrives.

Those same eight seconds hand the slot back after four open-drawer intervals,
and before the closed drawer is due to ask again. The deadline stays 8 seconds
when someone changes `refreshIntervalMs`. That setting is how often the drawer
asks. This number is how long one ask may take.

## What changed

`rpc` in `src/paper-fetch.ts` passes one `AbortSignal.timeout` into the POST.
The body is read on that same signal, so a reply that starts and never ends
fails the same way as a connection that never answers. `scripts/paper-probe`
is unchanged.

## Proof

A local server that accepts, writes the start of a body, and never ends it
makes `paper-fetch shot` exit 2 with stderr `paper-down`, inside the deadline.
With a JPEG already stored, the same server leaves that file in place and the
command reports the cached shot with reason `paper-down`. A server that
accepts and sends no bytes at all fails the same way, which is the post half
of the same deadline. A small, well-formed reply still returns a fresh shot,
and it returns before the deadline.

Every `src/*.test.ts` printed `ok`.
