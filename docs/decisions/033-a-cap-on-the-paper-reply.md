# A cap on every Paper reply

`rpc` in `src/paper-fetch.ts` reads a Paper reply into one string and then parses it. The marketplace review of commit `5531d33` asked for one hard byte cap on that body, including a non-200. The cap is 2097152 bytes, two times 1024 times 1024.

The read stops when the next byte would pass the cap, and that reply fails before `parseSse`. The failure is `paper-down`, which is the same failure as Paper being closed, so the last cached image stays and nothing new is written over it. A non-200 whose body fits under the cap is still `paper-down`. A non-200 whose body does not fit stops at the same cap.

## The sample it clears

The largest saved reply, `docs/paper-mcp-samples/nothing-selected/get_screenshot.json`, is 261602 bytes. The JPEG beside it is 195879 bytes. Decision 002 recorded a shot of 271840 bytes. The largest 2× shot measured in decision 026 is the 1440 by 900 artboard asked for at 2, which came back 2000 by 1250 and 285485 bytes, with the note that Paper had resized it to fit its 2000 pixel long edge.

Wrapped the way `get_screenshot` arrives, that JPEG is an SSE body of 380853 bytes: the base64 image, the JSON envelope, and that resize note. The cap sits 1716299 bytes above that body, 5.5 times its size. The saved 1× reply is smaller than this 2× body, so it sits further under the cap. The headroom is there because a busier frame at the same 2000 pixel edge can weigh more than the one measured that day, and the cap still has to clear it.

## What this leaves

A body that stays under this cap and never ends still fails on the 8 second deadline from decision 032. `scripts/paper-probe` stays the sample recorder and is unchanged. The published repo stays on commit `5531d33`.
