# Bound the image and the note before they are stored

`jpegFromToolResult` in `src/paper-fetch.ts` base64-decodes the image block and keeps the following text block as the note. `storeShot` then writes the JPEG and the sidecar, and `shot` prints the result, note included. The marketplace review of commit `5531d33` asked for a bound on the decoded image and the text fields before they are cached or printed. Decision 033 caps the bytes on the socket. These bounds sit after that parse, on the image and the note.

## The numbers

The image data string is refused when it is longer than 1572864 characters, 1536 times 1024. The check is the length of that string, and it returns before `Buffer.from`, so the decode does not run. The largest 2× JPEG measured, 285485 bytes in decision 026, is 380648 base64 characters. This bound is 1192216 characters above that string, 4.1 times its length.

The decoded bytes are refused when they are longer than 1048576 bytes, 1024 times 1024. The check is `byteLength` after the decode and before `storeShot`. 1048576 is 763091 bytes above the 285485 byte measurement, 3.7 times it. A string that passes the character bound can still decode to 1179648 bytes, and that shot is refused here rather than stored.

The note is refused when it is longer than 1024 characters. The check is the string length, and it returns before the note is written to the sidecar or printed. The note Paper attaches when it resizes a shot, `Note: Image was resized to 2000x1763px to fit size limits.`, is 58 characters. 1024 is 966 characters above that sentence.

An image string of 1572865 characters, a real JPEG padded with characters the base64 decoder ignores, still fits under the 2097152 byte body cap. The body cap accepts that reply. The character bound is what refuses it.

## What a refusal does

Each of these returns `bad-image`, the same failure as a shot that is not a JPEG. The last cached image stays. The new JPEG is not written, and neither is the sidecar. A missing image block is still `bad-image`. The size of a shot that is stored still comes from the JPEG frame.

## What this leaves

The 8 second deadline from decision 032 still fails a body that never ends. The body cap from decision 033 is unchanged. `scripts/paper-probe` stays the sample recorder. The published repo stays on commit `5531d33`.

## Proof

An image string one character over the bound, built so the base64 decoder would still recover the JPEG, writes no JPEG and no sidecar. A decoded JPEG one byte over the bound does the same, and its base64 form is inside the character bound, so the byte check is the one that refuses it. A note one character over the bound writes no sidecar and is not printed. The fixture note still comes back on a fresh shot. A local server that accepts and never ends the body still fails as `paper-down` inside the deadline.

Every `src/*.test.ts` printed `ok`.
