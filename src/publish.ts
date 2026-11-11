// What the plugin publishes, and the command that publishes it.
//
// The dev repo carries the decision records and their mockups, the saved Paper
// responses, the tests and AGENTS.md. The shell reads none of them, so an
// install should not clone them. PUBLISHED_PATHS is the list of files that do
// ship, and referencedPaths keeps that list honest: every relative path a
// published file names has to be published alongside it, or the publish is
// refused instead of shipping an install that cannot start.

import { spawnSync } from "node:child_process"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs"
import { dirname, join, normalize, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { realpathSync } from "node:fs"

export const PUBLISH_REPO = "https://github.com/binaryfever/paper-peek"

// Sorted, so a file added later lands in an obvious place.
export const PUBLISHED_PATHS: readonly string[] = [
  "BarWidget.qml",
  "Drawer.qml",
  "LICENSE",
  "README.md",
  "docs/drawer.png",
  "manifest.json",
  "package.json",
  "scripts/paper-fetch",
  "src/drawer-layout.js",
  "src/durable-file.ts",
  "src/paper-fetch.ts",
  "src/peek-memory.ts",
  "src/settings.ts",
  "src/shot-cache.ts",
  "theme-green.js",
]

export interface Reference {
  readonly from: string
  readonly path: string
}

const BINARY_SUFFIXES = [".png", ".jpg", ".jpeg", ".gif", ".ico"]

export function isTextPath(path: string): boolean {
  return !BINARY_SUFFIXES.some((suffix) => path.endsWith(suffix))
}

function rootRelative(fromPath: string, specifier: string): string | null {
  if (specifier === "" || specifier.startsWith("/")) return null
  const joined = normalize(join(dirname(fromPath), specifier))
  if (joined === "." || joined === "" || joined.startsWith("..")) return null
  return joined
}

function fromRoot(specifier: string): string | null {
  if (specifier === "") return null
  const cleaned = normalize(specifier)
  if (cleaned === "." || cleaned.startsWith("..")) return null
  return cleaned
}

// Every form the plugin's own files use to name another of its files: a QML
// import, a relative JS or TS import, "$root/..." in a shell wrapper, the
// absolute plugin path the drawer builds for the fetch helper, and a relative
// markdown link.
export function referencedPaths(source: string, fromPath: string): readonly string[] {
  const found = new Set<string>()
  const add = (path: string | null): void => {
    if (path !== null && path !== fromPath) found.add(path)
  }

  if (fromPath.endsWith(".qml")) {
    for (const match of source.matchAll(/^[ \t]*import[ \t]+"([^"]+)"/gm)) {
      add(rootRelative(fromPath, match[1] ?? ""))
    }
  }
  for (const match of source.matchAll(/(?:from|import|require)[ \t]*\(?[ \t]*"(\.{1,2}\/[^"]+)"/g)) {
    add(rootRelative(fromPath, match[1] ?? ""))
  }
  for (const match of source.matchAll(/\$\{?root\}?\/([A-Za-z0-9._/-]+)/g)) {
    add(fromRoot(match[1] ?? ""))
  }
  for (const match of source.matchAll(
    /plugins\/[A-Za-z0-9][A-Za-z0-9._-]*\/((?:scripts|src|docs)\/[A-Za-z0-9._/-]+)/g,
  )) {
    add(fromRoot(match[1] ?? ""))
  }
  if (fromPath.endsWith(".md")) {
    for (const match of source.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = match[1] ?? ""
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue
      add(rootRelative(fromPath, target))
    }
  }
  return [...found].sort()
}

// Paths the published files name that are not published themselves.
export function missingReferences(root: string, paths: readonly string[] = PUBLISHED_PATHS): readonly Reference[] {
  const published = new Set(paths)
  const missing: Reference[] = []
  for (const path of paths) {
    if (!isTextPath(path)) continue
    const full = join(root, path)
    if (!existsSync(full)) continue
    for (const reference of referencedPaths(readFileSync(full, "utf8"), path)) {
      if (published.has(reference)) continue
      missing.push({ from: path, path: reference })
    }
  }
  return missing
}

export function listFiles(dir: string, prefix = ""): readonly string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (prefix === "" && entry.name === ".git") continue
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) found.push(...listFiles(join(dir, entry.name), path))
    else found.push(path)
  }
  return found.sort()
}

interface Options {
  readonly push: boolean
  readonly repo: string
  readonly dir: string
  readonly help: boolean
}

const USAGE = `Usage: scripts/publish [--push] [--repo <url>] [--dir <path>]

Stages the published files into a checkout of the thin repo, refuses a stage
that names a file it does not carry or that fails omarchy plugin validate, then
makes one commit per manifest version and tags it. Pushes only with --push.
`

function defaultWorkDir(): string {
  const cache = process.env.XDG_CACHE_HOME
  const base = cache !== undefined && cache !== "" ? cache : join(process.env.HOME ?? ".", ".cache")
  // Outside ~/.config/omarchy/plugins, which the shell scans for plugins, and
  // outside ~/.cache/paper-peek, which the shot cache sweeps to a budget.
  return join(base, "paper-peek-publish")
}

function parseArgs(argv: readonly string[]): Options | null {
  let push = false
  let help = false
  let repo = PUBLISH_REPO
  let dir = defaultWorkDir()
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--push") push = true
    else if (arg === "-h" || arg === "--help") help = true
    else if (arg === "--repo" || arg === "--dir") {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith("-")) return null
      if (arg === "--repo") repo = value
      else dir = resolve(value)
      index += 1
    } else return null
  }
  return { push, repo, dir, help }
}

interface Ran {
  readonly code: number
  readonly out: string
}

function run(command: string, args: readonly string[], cwd?: string): Ran {
  const result = spawnSync(command, args, cwd === undefined ? { encoding: "utf8" } : { cwd, encoding: "utf8" })
  if (result.error !== undefined) return { code: 127, out: String(result.error) }
  return { code: result.status ?? 2, out: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() }
}

function git(dir: string, args: readonly string[]): Ran {
  return run("git", ["-C", dir, ...args])
}

function note(message: string): void {
  process.stderr.write(`paper-peek: ${message}\n`)
}

function sameRepo(left: string, right: string): boolean {
  const bare = (url: string): string => url.replace(/\.git$/, "").replace(/\/$/, "")
  return bare(left) === bare(right)
}

function ensureCheckout(options: Options): string | null {
  const { dir, repo } = options
  if (!existsSync(join(dir, ".git"))) {
    if (existsSync(dir) && readdirSync(dir).length > 0) return `${dir} exists and is not a checkout of ${repo}`
    mkdirSync(dirname(dir), { recursive: true })
    const cloned = run("git", ["clone", "--", repo, dir])
    if (cloned.code !== 0) {
      return `could not clone ${repo}\n${cloned.out}\nCreate it first, for example: gh repo create binaryfever/paper-peek --public`
    }
    return null
  }
  const origin = git(dir, ["remote", "get-url", "origin"])
  if (origin.code !== 0) return `${dir} has no origin remote`
  if (!sameRepo(origin.out, repo)) return `${dir} tracks ${origin.out}, not ${repo}`
  git(dir, ["fetch", "origin"])
  if (git(dir, ["rev-parse", "--verify", "--quiet", "origin/main"]).code === 0) {
    if (git(dir, ["merge-base", "--is-ancestor", "HEAD", "origin/main"]).code === 0) {
      git(dir, ["merge", "--ff-only", "origin/main"])
    }
  }
  return null
}

function stage(root: string, dir: string): void {
  for (const entry of readdirSync(dir)) {
    if (entry === ".git") continue
    rmSync(join(dir, entry), { recursive: true, force: true })
  }
  for (const path of PUBLISHED_PATHS) {
    const source = join(root, path)
    const dest = join(dir, path)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(source, dest)
    chmodSync(dest, statSync(source).mode & 0o777)
  }
}

function stagedBytes(dir: string): number {
  let total = 0
  for (const path of PUBLISHED_PATHS) total += statSync(join(dir, path)).size
  return total
}

function main(argv: readonly string[]): 0 | 2 | 3 {
  const options = parseArgs(argv)
  if (options === null) {
    process.stderr.write(USAGE)
    return 3
  }
  if (options.help) {
    process.stdout.write(USAGE)
    return 0
  }

  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as Record<string, unknown>
  const version = manifest.version
  if (typeof version !== "string" || version === "") {
    note("manifest.json carries no version")
    return 2
  }
  const tag = `v${version}`

  for (const path of PUBLISHED_PATHS) {
    const full = join(root, path)
    if (!existsSync(full)) {
      note(`published file is missing from the checkout: ${path}`)
      return 2
    }
    // omarchy plugin validate rejects a symlink anywhere in a plugin folder.
    if (lstatSync(full).isSymbolicLink()) {
      note(`published file is a symlink: ${path}`)
      return 2
    }
  }

  const checkoutError = ensureCheckout(options)
  if (checkoutError !== null) {
    note(checkoutError)
    return 2
  }

  stage(root, options.dir)

  const carried = listFiles(options.dir)
  const expected = [...PUBLISHED_PATHS].sort()
  if (carried.join("\n") !== expected.join("\n")) {
    note(`the stage does not match the published list:\n  carried: ${carried.join(" ")}`)
    return 2
  }
  const missing = missingReferences(options.dir)
  if (missing.length > 0) {
    for (const reference of missing) note(`${reference.from} names ${reference.path}, which is not published`)
    return 2
  }

  const validated = run("omarchy", ["plugin", "validate", options.dir])
  if (validated.code !== 0) {
    note(`omarchy plugin validate refused the stage\n${validated.out}`)
    return 2
  }

  const added = git(options.dir, ["add", "-A"])
  if (added.code !== 0) {
    note(`git add failed\n${added.out}`)
    return 2
  }
  const changed = git(options.dir, ["diff", "--cached", "--quiet"]).code !== 0
  const tagged = git(options.dir, ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`]).code === 0

  if (changed) {
    if (tagged) {
      note(`${tag} is already published and the files have changed; bump the version in manifest.json`)
      return 2
    }
    const committed = git(options.dir, ["commit", "-m", `Paper Peek ${version}`])
    if (committed.code !== 0) {
      note(`git commit failed\n${committed.out}`)
      return 2
    }
    process.stdout.write(`committed Paper Peek ${version}\n`)
  } else {
    process.stdout.write(`no change to publish for ${version}\n`)
  }

  if (!tagged) {
    const newTag = git(options.dir, ["tag", tag])
    if (newTag.code !== 0) {
      note(`git tag ${tag} failed\n${newTag.out}`)
      return 2
    }
    process.stdout.write(`tagged ${tag}\n`)
  }

  const kilobytes = Math.round(stagedBytes(options.dir) / 1024)
  process.stdout.write(`${PUBLISHED_PATHS.length} files, ${kilobytes}K, in ${options.dir}\n`)

  if (!options.push) {
    process.stdout.write(`not pushed. Run again with --push to send it to ${options.repo}\n`)
    return 0
  }
  const pushed = git(options.dir, ["push", "origin", "HEAD:refs/heads/main"])
  if (pushed.code !== 0) {
    note(`git push failed\n${pushed.out}`)
    return 2
  }
  const pushedTag = git(options.dir, ["push", "origin", `refs/tags/${tag}`])
  if (pushedTag.code !== 0) {
    note(`git push ${tag} failed\n${pushedTag.out}`)
    return 2
  }
  process.stdout.write(`pushed main and ${tag} to ${options.repo}\n`)
  return 0
}

const entry = process.argv[1]
const entryUrl = entry === undefined ? "" : pathToFileURL(realpathSync(entry)).href
if (entry !== undefined && import.meta.url === entryUrl) process.exit(main(process.argv.slice(2)))
