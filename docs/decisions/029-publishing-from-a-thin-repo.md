# Publishing from a thin repo

Installing Paper Peek cloned 5.6M to run about 390K of plugin. The rest is the
work, not the product: 4.4M of decision records and the mockups inside them,
556K of saved Paper responses, 120K of tests, and `AGENTS.md`. The shell reads
none of it.

So there are two repos. `binaryfever/omarchy-paper-peek` keeps everything and
stays the remote this checkout tracks. `binaryfever/paper-peek` holds only the
files an install needs, and that is the URL the README and the marketplace
listing name.

## What ships

The manifest, the two QML entry points, the two files they import
(`theme-green.js` and `src/drawer-layout.js`), the fetch helper and the four
modules it imports, `package.json`, the README, the LICENSE and the one
screenshot the README shows. Fifteen files, 390K, and 228K of that is the
screenshot.

`AGENTS.md`, `docs/decisions/`, `docs/paper-mcp.md`,
`docs/paper-mcp-samples/`, every `*.test.ts`, `src/paper-probe.ts`,
`scripts/paper-probe`, `.github/workflows/` and `.cursor/` stay behind.

## One repo could not do it

`omarchy plugin add` clones a repository and takes its default branch, so a
release branch inside the one repo would still hand the user the clone of
everything. `.gitattributes` with `export-ignore` only trims `git archive`, not
a clone. `git subtree` and `git filter-repo` would publish a rewritten history
nobody reads. Deleting the records was never an option: they are the account of
why the plugin is shaped the way it is.

## The published repo did not take the better name

`omarchy-` matches the convention in Omarchy's own documentation, and the
install command would have read better with it. Keeping it on the dev repo
costs one line in the README and keeps every merged pull request URL working,
and the name a user types is still a name they only type once. The install
directory does not come from the repo name in any case:
`omarchy-plugin-add` clones to a staging directory, validates it, reads `.id`
out of `manifest.json` and moves the clone to
`~/.config/omarchy/plugins/<id>`, so `paper-peek` installs as
`binaryfever.paper-peek`.

## The list is checked, not trusted

A hand-kept list of files to publish is a list that goes stale the first time
someone adds a module, and the failure arrives as a plugin that will not start
on someone else's machine. So `PUBLISHED_PATHS` in `src/publish.ts` is checked
from both sides. `referencedPaths` reads every published file and collects
every path it names — a quoted QML import, a relative JS or TS import,
`"$root/..."` in a shell wrapper, the absolute plugin path the drawer builds
for the fetch helper, and a relative markdown link — and the publish is refused
if any of them is not published. `src/publish.test.ts` fails on a file under
`src/` that is neither published nor named dev-only, so a new module has to be
a decision rather than an oversight.

`scripts/publish` stages the list into `~/.cache/paper-peek-publish`, which is
outside `~/.config/omarchy/plugins` because the shell scans that directory for
plugins, and outside `~/.cache/paper-peek` because the shot cache sweeps that
one to a budget. It runs the reference check on the stage, runs `omarchy plugin
validate` on it, and only then commits. One commit per manifest version, tagged
`v<version>`, and it pushes only with `--push`.

## Proof

A publish into a local bare repository wrote 15 files and 387K, committed
`Paper Peek 0.0.1` and tagged `v0.0.1`. A second run printed `no change to
publish for 0.0.1` and made no second commit. With a dangling import appended
to `src/durable-file.ts`, the publish printed `src/durable-file.ts names
src/added-later.ts, which is not published`, exited 2, and left the previous
commit as the tip. Every `src/*.test.ts` prints `ok`.
