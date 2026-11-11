import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { lstatSync, readFileSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  PUBLISHED_PATHS,
  isTextPath,
  listFiles,
  missingReferences,
  referencedPaths,
} from "./publish.ts"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

// A file under src/ is either published or named here. Anything else is a new
// module nobody decided about, which is the mistake this list exists to catch.
const DEV_ONLY_SRC = ["publish.ts", "paper-probe.ts"]

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`assert failed: ${message}`)
    process.exit(1)
  }
}

async function runTests(): Promise<void> {
  const published = new Set(PUBLISHED_PATHS)

  assert(new Set(PUBLISHED_PATHS).size === PUBLISHED_PATHS.length, "the published list has no duplicates")
  assert(
    [...PUBLISHED_PATHS].sort().join("\n") === PUBLISHED_PATHS.join("\n"),
    "the published list is sorted",
  )
  for (const path of PUBLISHED_PATHS) {
    assert(!path.startsWith("/") && !path.includes(".."), `${path} is a plain relative path`)
    assert(!path.endsWith(".test.ts"), `${path} is not a test`)
    assert(!lstatSync(join(root, path)).isSymbolicLink(), `${path} is not a symlink`)
    assert(lstatSync(join(root, path)).isFile(), `${path} is a regular file in the checkout`)
  }

  // The work stays behind.
  for (const path of ["AGENTS.md", "docs/paper-mcp.md", "scripts/paper-probe", ".github/workflows/test.yml"]) {
    assert(!published.has(path), `${path} is not published`)
  }
  for (const path of PUBLISHED_PATHS) {
    assert(!path.startsWith("docs/decisions/"), "no decision record is published")
    assert(!path.startsWith("docs/paper-mcp-samples/"), "no saved Paper response is published")
  }

  // Every src file is a decision: published, or dev-only on purpose.
  for (const entry of readdirSync(join(root, "src"))) {
    if (entry.endsWith(".test.ts") || DEV_ONLY_SRC.includes(entry)) continue
    assert(published.has(`src/${entry}`), `src/${entry} is published or listed as dev-only`)
  }

  // The manifest's entry points have to ship, or the install cannot load.
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as {
    entryPoints?: Record<string, string>
  }
  for (const entryPoint of Object.values(manifest.entryPoints ?? {})) {
    assert(published.has(entryPoint), `the ${entryPoint} entry point is published`)
  }

  assert(isTextPath("README.md"), "markdown is read as text")
  assert(!isTextPath("docs/drawer.png"), "a screenshot is not read as text")

  // Reference forms.
  assert(
    referencedPaths('import QtQuick\nimport "theme-green.js" as ThemeGreen\n', "BarWidget.qml").join() ===
      "theme-green.js",
    "a quoted QML import is a reference and a module import is not",
  )
  assert(
    referencedPaths('import "src/drawer-layout.js" as Layout\n', "Drawer.qml").join() === "src/drawer-layout.js",
    "a QML import into a subdirectory is a reference",
  )
  assert(
    referencedPaths('import { commitFile } from "./durable-file.ts"\n', "src/shot-cache.ts").join() ===
      "src/durable-file.ts",
    "a relative import resolves against the importing file",
  )
  assert(
    referencedPaths('import { readFileSync } from "node:fs"\n', "src/shot-cache.ts").length === 0,
    "a built-in module is not a reference",
  )
  assert(
    referencedPaths('exec node --experimental-strip-types "$root/src/paper-fetch.ts" "$@"\n', "scripts/paper-fetch")
      .join() === "src/paper-fetch.ts",
    "a shell wrapper's $root path is a reference",
  )
  assert(
    referencedPaths('"/omarchy/plugins/binaryfever.paper-peek/scripts/paper-fetch"\n', "Drawer.qml").join() ===
      "scripts/paper-fetch",
    "the absolute plugin path the drawer builds is a reference",
  )
  assert(
    referencedPaths("![shot](docs/drawer.png)\n", "README.md").join() === "docs/drawer.png",
    "a relative markdown link is a reference",
  )
  assert(
    referencedPaths("[omarchy](https://plugins.omarchy.org) and [top](#paper-peek)\n", "README.md").length === 0,
    "a URL and an anchor are not references",
  )
  assert(
    referencedPaths('import "Drawer.qml" as Self\n', "Drawer.qml").length === 0,
    "a file naming itself is not a missing reference",
  )

  // The real guard: nothing the published files name is left behind.
  const leftBehind = missingReferences(root)
  assert(
    leftBehind.length === 0,
    `every path the published files name is published (missing: ${leftBehind
      .map((reference) => `${reference.from} -> ${reference.path}`)
      .join(", ")})`,
  )

  // A runtime module added and forgotten fails the check.
  const temp = await mkdtemp(join(tmpdir(), "paper-peek-publish-"))
  try {
    await mkdir(join(temp, "src"), { recursive: true })
    await writeFile(join(temp, "src/shot-cache.ts"), 'import { later } from "./added-later.ts"\n')
    const found = missingReferences(temp, ["src/shot-cache.ts"])
    assert(found.length === 1, "an unpublished import is reported")
    assert(found[0]?.path === "src/added-later.ts", "the missing path is named")
    assert(found[0]?.from === "src/shot-cache.ts", "the file that names it is named")

    await mkdir(join(temp, ".git"), { recursive: true })
    await writeFile(join(temp, ".git/HEAD"), "ref: refs/heads/main\n")
    await writeFile(join(temp, "manifest.json"), "{}\n")
    assert(listFiles(temp).join() === "manifest.json,src/shot-cache.ts", "listFiles sorts and skips .git")
  } finally {
    await rm(temp, { recursive: true, force: true })
  }

  console.log("publish.test.ts: ok")
}

runTests().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
