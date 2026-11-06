# Pages and artboards stay on disk

`scripts/paper-fetch` now writes `pages/<fileId>.json` and `artboards/<fileId>/<pageId>.json`. The first read, and `--refresh`, call `get_basic_info` with a file id. Every later read of the same file serves the cache and does not call Paper.

## Why the cache is the default

`get_basic_info` with a file id opens that file as a background tab. Paper has no tool that closes the tab. A drawer that listed pages on every open would leave a tab behind on every visit. The cache makes the first visit the only visit that opens one.

`get_screenshot` is still refused when `list_resources` shows the file closed. FMC-667 measured that a screenshot of a closed file opens the file. The shot path stays `shots/<fileId>/<nodeId>.jpg` for the same reason as that decision. Node ids such as `1-0` are reused across files.

FMC-668 names `shots/<nodeId>.jpg` and a shot that writes while the file is closed. Those two would undo the measurements above. `shot <fileId> <nodeId>` is accepted, stored under the file id, and still refused when the file is closed.

When `get_basic_info` omits an artboard width, the artboard command calls `get_screenshot` and stores the JPEG width. That call happens after `get_basic_info`, so the file is already a background tab.

## What this leaves out

The drawer is still a later change. `BarWidget.qml` does not call Paper.

## Proof from this session

`pages`, `artboards`, and `shot` ran for file `01M3FYEHC2WZ9YC2DC3AJMX995`, page `p-1-0`, node `1-0`. The JPEG is 1440 by 1750 pixels and 271840 bytes. It is the same file as [002-artboard.jpg](002-artboard.jpg). A second `pages` run left the cache file's mtime unchanged. `list_resources` before and after showed both desktop files open and neither active. The bar crop is [002-bar-label.png](002-bar-label.png). `omarchy plugin validate` exited 0.
