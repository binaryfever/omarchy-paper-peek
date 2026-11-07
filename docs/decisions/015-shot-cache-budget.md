# The shot cache stays under a size budget

Browsing more artboards writes more JPEGs under `~/.cache/paper-peek/shots/`. `cacheBudgetMb` caps that directory. The default is 200. One megabyte is 1024 times 1024 bytes, so the default cap is 209715200 bytes. The setting accepts an integer from 0 through 1048576. A missing key, a non-integer, or a number outside that range falls back to 200, and `paper-fetch settings` writes a `paper-peek:` warning. The README lists the same key.

0 is a legal budget. It keeps the current artboard and the five recents, and it removes the other shots.

## Why the sweep sits on the write

The directory grows when `storeShot` saves a JPEG. The sweep runs after that pair is on disk. A crash during the sweep leaves the pair in place, and the next save sweeps again.

`watchArtboard` compares the Paper `updatedAt` already stored in the sidecar. The watch tick does not read `shots/`. The sweep has no timer of its own, and it never calls Paper.

## What stays on disk

The drawer opens again on the last artboard, and the browser lists five recents. Those images have to be on disk for that next open, so they stay even when the budget is 0. The sweep records each kept shot as a directory name and a byte count. The delete list has no path for a kept shot.

When the protected shots already weigh more than the budget, the sweep removes unprotected shots and then stops. The protected files stay.

`byFile` is the artboard last opened in each project. That list grows with every project, so those shots are outside the keep set.

## When current.json cannot be read

A missing `current.json` means nothing is remembered. Unprotected shots can be removed.

If the file cannot be read, the JSON fails to parse, or the value is not an object, memory is unknown. `parseMemory` would turn that text into an empty selection and the sweep would delete the image on screen. Unknown keeps every JPEG. It still removes a stale temp and an empty file-id directory.

The top-level `fileId` and `nodeId` stay when both are Paper ids, even when `pageId` is blank. The drawer builds the image path from those two fields.

## What this leaves out

`Drawer.qml` is unchanged. `projects.json`, `pages/`, and `artboards/` sit outside the budget. There is no lock file and no `shots/index.json`. A sweep writes no refresh-log line. An unrecognized name under `shots/` stays, is not counted, and keeps its directory from being removed.

## Proof

`node --experimental-strip-types src/settings.test.ts` printed `settings.test.ts: ok` and exited 0. The same runner printed ok and exited 0 for `src/shot-cache.test.ts`, `src/paper-fetch.test.ts`, `src/paper-probe.test.ts`, and `src/float-geometry.test.ts`.

`git diff --stat` does not list `Drawer.qml`.
