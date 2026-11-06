Paper Peek

An Omarchy shell plugin for viewing Paper designs while you code. A hotkey slides a drawer in from the screen edge over the tiled windows; pressing it again hides it. Inside the drawer you browse project → page → artboard and see the artboard's screenshot. The drawer reopens on the last artboard viewed. No links to paste, and no trip to Paper.

Work is tracked in Linear, project "Paper Peek" (team Fmchale, issue prefix FMC). Each task arrives as a Linear issue with Steps, "Done means," and "Keep" sections. Treat "Done means" as the acceptance test and "Keep" as behavior that must not regress.

How it works
Platform: Omarchy 4 on Arch Linux with Hyprland. The Omarchy shell (omarchy-shell) is a single Quickshell process; every bar widget, panel, and overlay is a plugin.
Plugin code: QML and JavaScript. Entry points are declared in manifest.json at the repo root.
Plugin id: fmchale.paper-peek. Never change it. The omarchy. prefix is reserved for first-party plugins.
Design source: Paper Desktop's local MCP server at http://127.0.0.1:29979/mcp. Paper Desktop must be running. `list_resources` works when no file is open. A screenshot requires the file to already be open, because screenshotting a closed file opens a tab.
Always read by id. Calls without a file id (like get_basic_info) fail with "Open a Paper file" when nothing is open. Pass the file id and node id on every read.
What by-id reads do to Paper: `list_resources` does not change which files are open. `get_basic_info` with a file id opens that file as a background tab, and there is no tool to close it. `get_screenshot` for a file that is already open leaves those flags unchanged. `get_screenshot` for a closed file opens that file. `scripts/paper-fetch` calls `get_screenshot` only when `list_resources` shows the file open.
Cache to keep tabs to a minimum. Call get_basic_info for a project only the first time the user browses into it, or when they explicitly refresh. Serve pages and artboards from the cache otherwise.
Paper tools used (read only): list_resources (projects), get_basic_info and get_children (pages and artboards, by file id), get_screenshot (by node id).
Screenshots are JPEG. The get_screenshot reply shape varies, so parse the image out of whatever content items come back instead of assuming a fixed order. Artboard heights may be missing on inactive pages; take size from the screenshot.
Cache: ~/.cache/paper-peek/ holds projects.json, pages/<fileId>.json, artboards/<fileId>/<pageId>.json, and shots/<fileId>/<nodeId>.jpg with a matching .json. `scripts/paper-fetch` writes those files. `pages` and `artboards` call `get_basic_info` on the first read and on `--refresh`, and serve the cache otherwise. Current and recent artboards live in a state file.
Findings so far: see FMC-664 in Linear and docs/paper-mcp.md.
Rules
Read only against Paper. Never call Paper tools that open files, select, write, edit, or delete anything. The user must never need to open, select, or click anything in Paper for the plugin to work.
Never edit Omarchy's own files under ~/.local/share/omarchy/. Reading them to learn how first-party plugins work is fine. Only change user config: ~/.config/omarchy/, ~/.config/hypr/.
Don't change existing keybindings. Check omarchy menu keybindings --print before adding one.
Paper can be closed. Every code path must handle Paper being unreachable, or an artboard having been deleted, without crashing, and keep showing the last cached image.
Keep the shell light. Plugins run inside the long-lived omarchy-shell process. No busy loops. The status word is polled on a timer. Artboard change checks run only while the drawer is open, and only a changed `updatedAt` from `list_resources` fetches a new screenshot.
Record decisions in docs/decisions/NNN-short-title.md with what was chosen and why.
Repo layout
manifest.json          plugin manifest (id, name, version, kinds, entryPoints)
*.qml                  plugin UI and logic
scripts/               helper scripts (paper-probe for testing, paper-fetch for real data)
docs/paper-mcp.md      what Paper's MCP returns, exit codes, connection notes
docs/paper-mcp-samples/  saved raw responses from Paper
docs/decisions/        decision records
AGENTS.md              this file
Development loop

The git checkout is the real directory ~/.config/omarchy/plugins/fmchale.paper-peek. The folder name is the id in manifest.json. /home/fred/Projects/omarchy-paper-peek is a symlink to that directory, so Cursor still opens the same files.

FMC-666 measured the reload on this machine. While the plugins entry was a symlink to the checkout, a save wrote the target inode. journalctl --user -t omarchy-shell did not print Local plugin changed, reloading: fmchale.paper-peek, and the bar kept the old label. inotifywait -r watches ~/.config/omarchy/plugins and does not walk symlinks.

After the checkout itself was that real directory, the same save printed the journal line. The bar still kept the old label. omarchy-shell shell rescanPlugins left the label unchanged. omarchy restart shell loaded BarWidget.qml from disk. Edit the real directory, then run omarchy restart shell to see a QML change. Leave the plugins path as a real directory.

omarchy plugin validate fails on /home/fred/Projects/omarchy-paper-peek. That path is a symlink, and the validator rejects a symlink that find reports. Validate the real directory.

To take the label off the bar, run omarchy plugin disable fmchale.paper-peek. omarchy plugin remove asks for confirmation and then deletes this checkout, because the directory contains .git.

Verifying work

Run these before calling any task done:

```bash
omarchy plugin validate ~/.config/omarchy/plugins/fmchale.paper-peek
omarchy plugin list
```

Shell logs: `journalctl --user -t omarchy-shell`. A save under the plugin directory prints `Local plugin changed, reloading: fmchale.paper-peek`. The bar shows the new QML after `omarchy restart shell`.
Window layout checks: hyprctl clients (tiled windows must not move when the drawer opens).
Paper checks: scripts/paper-probe (once it exists) lists Paper's tools and runs the read calls.

Then check each item under the issue's "Done means" and confirm nothing listed under "Keep" broke.

Commits
One issue per branch. Use Linear's branch name for the issue (for example fredmchale/fmc-664-inspect-papers-mcp-output).
Mention the issue id in the commit message (for example FMC-664: add paper-probe script).
