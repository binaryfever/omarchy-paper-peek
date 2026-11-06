# How the plugin talks to Paper

The plugin does not open an HTTP connection to Paper. `scripts/paper-fetch` does. `BarWidget.qml` stays a label. A later drawer runs that program and reads the JSON document it prints.

The ticket named `docs/decisions/001-paper-connection.md`. `001` is already the checkout decision, so this record is `002`.

## Why a helper

Qt's QML engine can call Paper. This session posted `initialize` and `list_resources` with `XMLHttpRequest`, and it read the `Mcp-Session-Id` header. A screenshot reply for one artboard was 362773 bytes. That string would sit in `omarchy-shell`, the process that paints the bar. The helper writes a JPEG file and prints the path.

`scripts/paper-probe` stays the sample recorder. It calls `get_basic_info` with no file id, and a nothing-selected run overwrites `docs/paper-mcp.md`. The plugin does not call it.

## What paper-fetch calls

`paper-fetch projects` calls `list_resources` with limit 200. `paper-fetch shot --file <fileId> --node <nodeId>` calls `get_screenshot` with those two ids and no scale. It does not call `get_basic_info`, `get_children`, `get_selection`, or `open_file`.

`get_screenshot` runs only when that command's own `list_resources` result marks the file open. A missing `open` field means closed. The file does not have to be the active tab.

This session called `get_screenshot` for file `01M3NSDXNCKM0QFAGTRH3BF0CC`, node `BN1-0`, while that file was closed. The next `list_resources` showed the file open. Paper has no tool that closes a tab. A screenshot of Thoughts in Design site, file `01M3FYEHC2WZ9YC2DC3AJMX995`, node `1-0`, ran while that file was already open and left the open flags unchanged.

`list_resources` itself does not change which files are open. A project list works when nothing is open. A screenshot of a closed file is refused, so this command does not open a tab.

## Cache

Files live in `~/.cache/paper-peek`, or in `PAPER_PEEK_CACHE` when that variable is set. `projects.json` is the last project list. `shots/<fileId>/<nodeId>.jpg` is the JPEG, with a sibling `.json` for the server note. Node ids such as `1-0` repeat across files, so the path includes the file id. A write goes to a temp file in the same directory and then `rename`, so a crash leaves the previous complete file.

## Left for later

Pages and artboards are FMC-668. `get_basic_info` with a file id opens a background tab, so this ticket does not call it. The drawer is not in this change.

## Proof from this session

`paper-fetch shot --file 01M3FYEHC2WZ9YC2DC3AJMX995 --node 1-0` wrote a JPEG of 1440 by 1750 pixels and 271840 bytes. That command screenshots a file only when its own list marks the file open, so Thoughts in Design site was already open. A following `projects` call showed that file and Audiol iOS both open, and neither was the active tab. The JPEG is [002-artboard.jpg](002-artboard.jpg).

A shot for a file id that was not in the list exited 2 with `unknown-file` and wrote no JPEG.

The installed bar still reads Paper Peek. The crop is [002-bar-label.png](002-bar-label.png). `omarchy plugin validate` on this checkout exited 0.
