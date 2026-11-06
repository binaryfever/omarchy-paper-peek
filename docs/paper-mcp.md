# Paper MCP

## Screenshot

Format is image/jpeg. Width is 2000 pixels. Height is 1763 pixels.
Decoded size is 195879 bytes. The server note was "Note: Image was resized to 2000x1763px to fit size limits.".

Width and height are the JPEG frame header in
docs/paper-mcp-samples/nothing-selected/screenshot.jpg.
The tool JSON has neither field.

## Nothing selected

get_selection payload:

```json
{
  "selectedNodes": [],
  "count": 0
}
```

get_screenshot used file 01M3NSDXNCKM0QFAGTRH3BF0CC and node BN1-0. The node is the
first artboard returned by get_basic_info. The selection count was 0.

The full tool result, including the file prelude, is
docs/paper-mcp-samples/nothing-selected/get_selection.json.

## paper-fetch

`scripts/paper-fetch` talks to Paper and writes `~/.cache/paper-peek`. `PAPER_PEEK_CACHE` overrides that directory. `PAPER_MCP_URL` overrides `http://127.0.0.1:29979/mcp`.

Commands:

- `paper-fetch projects`
- `paper-fetch pages <fileId> [--refresh]`
- `paper-fetch artboards <fileId> <pageId> [--refresh]`
- `paper-fetch shot <fileId> <nodeId>`
- `paper-fetch shot --file <fileId> --node <nodeId>`

`projects` calls `list_resources` with limit 200. Each file in `projects.json` has `id`, `name`, and `folder`. `folder` is the parent folder id, or null when Paper omits `parentId`. The file also records `kind` (`open-file`, `closed-file`, or `folder`), `active` on an open file, and `truncated`.

`pages/<fileId>.json` has `fileId` and `pages`. Each page has `id`, `name`, and `order`. `order` is the position among entries whose type is `page`. Dividers are omitted.

`artboards/<fileId>/<pageId>.json` has `fileId`, `pageId`, and `artboards`. Each artboard has `id`, `name`, and `width`. `width` is the `get_basic_info` number when Paper measured it. When that number is missing, the command calls `get_screenshot` and stores the JPEG width.

`shots/<fileId>/<nodeId>.jpg` is the JPEG. The sibling `.json` has `name`, `file`, `page`, `timestamp`, `note`, and `byteLength`. `name` and `page` come from the artboard cache for that file. They are null when that cache has no matching node. Node ids such as `1-0` repeat across files, so the directory is the file id.

`pages` and `artboards` read the cache when the file is present and `--refresh` is absent. That read does not call Paper. `--refresh`, or a missing cache file, calls `get_basic_info` with the file id. `artboards` also passes the page id. A second run without `--refresh` does not call Paper.

`get_screenshot` runs for `shot` only when `list_resources` marks that file open. A closed file does not open a tab. When a JPEG is already stored, that command exits 0 and leaves the file in place. With no JPEG, it exits 2 and stderr is `file-closed`.

Exit codes:

- 0. The command wrote a cache file, served a page or artboard cache, or returned a stored project list or JPEG.
- 2. The command could not read Paper, or it refused the request. stderr is `paper-down`, `bad-payload`, `bad-image`, `file-closed`, `unknown-file`, `not-a-file`, or `list-truncated`. Existing cache files stay in place.
- 3. The arguments are wrong. stderr is `bad-args` or `bad-id`.

`projects` and `shot` still return a stored file when Paper is down, and that command exits 0. `pages` and `artboards` do the same when their cache file is already present, because checking Paper would be a call. With no cache file, those commands exit 2.
