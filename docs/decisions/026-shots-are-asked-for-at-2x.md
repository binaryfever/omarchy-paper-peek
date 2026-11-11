# Shots are asked for at 2x

Paper renders a screenshot at the artboard's own size. A 390 by 664 artboard
arrives as a 390 by 664 JPEG. The drawer draws it at 324 wide, where that is
plenty, and the big view draws it at 764 by 1300 logical pixels, which on a 1.6
scale monitor is 1223 by 2080 device pixels. That is a 3.14x upscale of a 390
wide JPEG, and the type in it is mushy.

`get_screenshot` takes a numeric `scale`. Its own description calls 1 the
default and 2 "for reading small text or inspecting fine details". One fetch at
2 serves both views, because the drawer decodes the JPEG at the width it draws.

## The measuring call stays at 1

Two calls in the plugin ask Paper for a screenshot and they are asking
different questions. `shot` wants an image to draw, and takes 2. The call in
`artboards` that fills a missing width wants the artboard's own width, which is
the number Paper answers at 1. They are separate constants rather than one,
because the next person to change either should have to say which they mean.

## The sidecar records what was asked for, not what came back

Paper caps a shot's long edge at 2000 pixels whatever scale is requested.
Measured against file 01M3FYEHC2WZ9YC2DC3AJMX995:

| artboard | scale 1 | scale 2 |
| --- | --- | --- |
| 390 x 664 | 390x664, 60509 bytes | 780x1328, 170788 bytes |
| 1440 x 900 | 1440x900, 160145 bytes | 2000x1250, 285485 bytes |

So the 1440 artboard asked for at 2 comes back at 1.39x, with a note saying it
was resized to fit size limits. If the sidecar recorded the scale Paper
delivered, every wide artboard would read as below 2 forever and refetch on
every check. Recording the request is what makes the staleness test terminate.
A sidecar written before the field existed has no `scale` at all, and reads
as 1.

## Old shots refetch once

`watch` only reported a change when Paper's `updatedAt` moved, so an artboard
cached at 1x would have stayed soft until somebody edited it. `watch` now also
reports a change when the sidecar's scale is below 2. The shot that replaces it
records 2, and the check goes quiet again. The 1x JPEG keeps being served until
the new one lands, and when Paper is down the cached one is still what shows.

## The budget

The cache budget from FMC-695 is counted in bytes, so it needs no change and
simply holds fewer artboards. The measured growth is not the 4x that twice the
pixels on each axis suggests, because JPEG compresses it away: 2.82x on the 390
artboard and 1.78x on the capped 1440 one. Against the 38 shots cached here,
averaging 83 KB at 1x, the default 200 MB cap held roughly 2400 artboards and
should now hold somewhere over 1000. The current artboard and the five recents
are still held back from eviction.

## Proof

`026-scale-compare.png` is the same band of the same artboard, both upscaled to
the 1223 pixels the big view draws at. The 1x crop is the state before this
change.

Live, with no edit made in Paper: opening the drawer replaced the cached
`EA-0.jpg` with a 780 by 1328 JPEG of 170772 bytes whose sidecar reads
`"scale":2` against the same `updatedAt` of 1793966262612 it had before. The
refresh log shows one `fetch` line and then `unchanged` on every check after
it, so it settled after a single refetch.

`omarchy plugin validate` exits 0 and every `src/*.test.ts` prints `ok`.

## What this does not reach

The issue asked for no visible upscaling in the big view. At 2 the upscale
falls from 3.14x to 1.57x, which is a large improvement and still not none.
Closing it entirely on a 1.6 scale monitor needs scale 3, which Paper's 2000
pixel cap happens to allow for a tall narrow artboard like this one and does
not allow for a 1440 wide one. That is a separate decision about spending four
times the cache on the artboards that can use it, and it was not made here.
