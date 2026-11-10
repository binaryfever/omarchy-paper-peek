import { existsSync } from "node:fs"
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { memoryText, type ArtboardPlace, type PeekMemory } from "./peek-memory.ts"
import { readShotStamp, shotJpegPath, sidecarNote, storeShot } from "./shot-cache.ts"

const JPEG = Uint8Array.of(0xff, 0xd8, 0xff, 0xd9)

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`assert failed: ${message}`)
    process.exit(1)
  }
}

function place(fileId: string, nodeId: string): ArtboardPlace {
  return {
    fileId,
    pageId: "page-1",
    nodeId,
    projectName: "Project",
    pageName: "Page",
    artboardName: nodeId,
  }
}

function memoryOf(
  current: ArtboardPlace,
  recent: readonly ArtboardPlace[],
  extra: readonly ArtboardPlace[],
): string {
  const byFile: Record<string, ArtboardPlace> = { [current.fileId]: current }
  for (const item of extra) byFile[item.fileId] = item
  const memory: PeekMemory = { current, byFile, recent }
  return memoryText(memory)
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch {
    return false
  }
}

async function plantPair(
  cacheDir: string,
  fileId: string,
  nodeId: string,
  byteLength: number,
  timestamp: string,
): Promise<void> {
  const jpeg = shotJpegPath(cacheDir, fileId, nodeId)
  await mkdir(dirname(jpeg), { recursive: true })
  await writeFile(jpeg, JPEG)
  await writeFile(
    `${jpeg.slice(0, -".jpg".length)}.json`,
    JSON.stringify({
      name: null,
      file: fileId,
      page: "page-1",
      timestamp,
      note: null,
      byteLength,
    }),
  )
}

async function putShot(cacheDir: string, fileId: string, nodeId: string): Promise<void> {
  await storeShot({
    cacheDir,
    fileId,
    nodeId,
    bytes: JPEG,
    note: null,
    name: null,
    page: "page-1",
    updatedAt: null,
  })
}

async function shotNames(cacheDir: string): Promise<string[]> {
  const root = join(cacheDir, "shots")
  const found: string[] = []
  let top
  try {
    top = await readdir(root, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of top) {
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      const kids = await readdir(join(root, entry.name))
      if (kids.length === 0) found.push(`${entry.name}/`)
      for (const kid of kids) found.push(`${entry.name}/${kid}`)
      continue
    }
    found.push(entry.name)
  }
  found.sort()
  return found
}

function deadPid(): number {
  for (let pid = 1_000_000; pid < 2_000_000; pid += 1) {
    if (!existsSync(`/proc/${pid}`)) return pid
  }
  throw new Error("no unused pid")
}

async function runTests(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "paper-peek-shots-"))
  const settingsPath = join(root, "settings.json")
  const statePath = join(root, "current.json")
  const previousSettings = process.env.PAPER_PEEK_SETTINGS
  const previousState = process.env.PAPER_PEEK_STATE
  process.env.PAPER_PEEK_SETTINGS = settingsPath
  process.env.PAPER_PEEK_STATE = statePath
  try {
    await writeFile(settingsPath, JSON.stringify({ cacheBudgetMb: 200 }))
    const readCache = join(root, "read")
    await storeShot({
      cacheDir: readCache,
      fileId: "file-read",
      nodeId: "node-read",
      bytes: JPEG,
      note: "hello",
      name: "Board",
      page: "page-1",
      updatedAt: 42,
    })
    assert((await readShotStamp(readCache, "file-read", "node-read")) === 42, "the sidecar keeps Paper's stamp")
    assert(
      (await sidecarNote(readCache, "file-read", "node-read", JPEG.byteLength)) === "hello",
      "the note matches the jpeg length",
    )
    assert(await exists(shotJpegPath(readCache, "file-read", "node-read")), "the default budget keeps one shot")

    const current = place("file-current", "node-current")
    const recent = [0, 1, 2, 3, 4].map((index) => place(`file-r${index}`, `node-r${index}`))
    const byFileOnly = place("file-byfile", "node-byfile")
    await writeFile(settingsPath, JSON.stringify({ cacheBudgetMb: 0 }))
    await writeFile(statePath, memoryOf(current, recent, [byFileOnly]))
    const budgetCache = join(root, "budget-zero")
    for (const item of [current, ...recent]) {
      await plantPair(budgetCache, item.fileId, item.nodeId, 100, "2024-01-01T00:00:00.000Z")
    }
    await plantPair(budgetCache, byFileOnly.fileId, byFileOnly.nodeId, 100, "2023-01-01T00:00:00.000Z")
    await plantPair(budgetCache, "file-open", "node-open", 100, "2022-01-01T00:00:00.000Z")
    await mkdir(join(budgetCache, "shots", "empty-id"), { recursive: true })
    const dead = deadPid()
    await writeFile(join(budgetCache, "shots", current.fileId, `stale.${dead}.tmp`), "stale")
    await writeFile(join(budgetCache, "shots", current.fileId, "bare.tmp"), "bare")
    await writeFile(join(budgetCache, "shots", current.fileId, `ours.${process.pid}.tmp`), "ours")
    await writeFile(join(budgetCache, "shots", `loose.${dead}.tmp`), "loose")
    await writeFile(join(budgetCache, "shots", "stray.txt"), "stay")
    await writeFile(join(budgetCache, "shots", "top.jpg"), "stay")
    await writeFile(join(budgetCache, "shots", "file-open", "notes.txt"), "stay")

    await putShot(budgetCache, current.fileId, current.nodeId)
    for (const item of [current, ...recent]) {
      assert(await exists(shotJpegPath(budgetCache, item.fileId, item.nodeId)), `${item.nodeId} jpeg stays`)
      assert(
        await exists(join(budgetCache, "shots", item.fileId, `${item.nodeId}.json`)),
        `${item.nodeId} sidecar stays`,
      )
    }
    assert(
      !(await exists(shotJpegPath(budgetCache, byFileOnly.fileId, byFileOnly.nodeId))),
      "a byFile-only pair is gone",
    )
    assert(
      !(await exists(join(budgetCache, "shots", byFileOnly.fileId, `${byFileOnly.nodeId}.json`))),
      "a byFile-only sidecar is gone",
    )
    assert(!(await exists(shotJpegPath(budgetCache, "file-open", "node-open"))), "an unprotected pair is gone")
    assert(
      !(await exists(join(budgetCache, "shots", "file-open", "node-open.json"))),
      "an unprotected sidecar is gone",
    )
    assert(!(await exists(join(budgetCache, "shots", "empty-id"))), "an empty file-id directory is gone")
    assert(await exists(join(budgetCache, "shots", "stray.txt")), "an unrecognized file stays")
    assert(await exists(join(budgetCache, "shots", "top.jpg")), "a jpeg directly under shots stays")
    assert(await exists(join(budgetCache, "shots", "file-open", "notes.txt")), "an unrecognized name stays in its directory")

    await putShot(budgetCache, "file-same", "node-same")
    assert(!(await exists(shotJpegPath(budgetCache, "file-same", "node-same"))), "an unprotected pair written in the same run is gone")
    assert(
      !(await exists(join(budgetCache, "shots", "file-same", "node-same.json"))),
      "an unprotected sidecar written in the same run is gone",
    )

    const keptNames = await shotNames(budgetCache)
    assert(keptNames.every((name) => !name.endsWith(".tmp")), `a temp name remained: ${keptNames.join(", ")}`)
    assert(keptNames.every((name) => !name.endsWith("/")), `an empty directory remained: ${keptNames.join(", ")}`)
    const recentBefore = await readFile(shotJpegPath(budgetCache, recent[0]!.fileId, recent[0]!.nodeId))
    await putShot(budgetCache, current.fileId, current.nodeId)
    const keptAfter = await shotNames(budgetCache)
    assert(keptNames.join("\n") === keptAfter.join("\n"), "a second store of a protected pair deletes nothing else")
    const recentAfter = await readFile(shotJpegPath(budgetCache, recent[0]!.fileId, recent[0]!.nodeId))
    assert(Buffer.compare(recentBefore, recentAfter) === 0, "other protected bytes stay")

    assert(existsSync("/proc/1"), "pid 1 is visible in /proc")
    const liveCache = join(root, "live-temp")
    await mkdir(join(liveCache, "shots", "file-live"), { recursive: true })
    await writeFile(join(liveCache, "shots", "file-live", "kept.1.tmp"), "live")
    await plantPair(liveCache, "file-gone", "node-gone", 10, "2020-01-01T00:00:00.000Z")
    await putShot(liveCache, "file-other", "node-other")
    assert(await exists(join(liveCache, "shots", "file-live", "kept.1.tmp")), "a temp whose pid is 1 stays")
    assert(!(await exists(shotJpegPath(liveCache, "file-gone", "node-gone"))), "an unprotected pair is removed beside a live temp")

    await rm(statePath, { recursive: true, force: true })
    await mkdir(statePath)
    const blockedCache = join(root, "unreadable")
    await plantPair(blockedCache, "file-a", "node-a", 9_000_000, "2020-01-01T00:00:00.000Z")
    await plantPair(blockedCache, "file-b", "node-b", 9_000_000, "2021-01-01T00:00:00.000Z")
    await writeFile(join(blockedCache, "shots", "file-a", `stale.${dead}.tmp`), "stale")
    await mkdir(join(blockedCache, "shots", "file-orphan"), { recursive: true })
    await writeFile(join(blockedCache, "shots", "file-orphan", "node-orphan.json"), "{")
    await mkdir(join(blockedCache, "shots", "empty-blocked"), { recursive: true })
    await putShot(blockedCache, "file-c", "node-c")
    assert(await exists(shotJpegPath(blockedCache, "file-a", "node-a")), "an unreadable current.json leaves the first jpeg")
    assert(await exists(shotJpegPath(blockedCache, "file-b", "node-b")), "an unreadable current.json leaves the second jpeg")
    assert(
      !(await exists(join(blockedCache, "shots", "file-a", `stale.${dead}.tmp`))),
      "an unreadable current.json still removes a dead temp",
    )
    assert(!(await exists(join(blockedCache, "shots", "empty-blocked"))), "an unreadable current.json still removes an empty directory")
    assert(
      await exists(join(blockedCache, "shots", "file-orphan", "node-orphan.json")),
      "an unreadable current.json leaves a sidecar that has no jpeg",
    )

    await rm(statePath, { recursive: true, force: true })
    await writeFile(statePath, "{")
    const corruptCache = join(root, "corrupt-json")
    await plantPair(corruptCache, "file-keep", "node-keep", 100, "2020-01-01T00:00:00.000Z")
    await putShot(corruptCache, "file-new", "node-new")
    assert(await exists(shotJpegPath(corruptCache, "file-keep", "node-keep")), "corrupt current.json leaves the jpeg")

    await rm(statePath, { recursive: true, force: true })
    const missingCache = join(root, "missing-state")
    await plantPair(missingCache, "file-old", "node-old", 10, "2020-01-01T00:00:00.000Z")
    await mkdir(join(missingCache, "shots", "file-orphan"), { recursive: true })
    await writeFile(
      join(missingCache, "shots", "file-orphan", "node-orphan.json"),
      JSON.stringify({ timestamp: "2020-01-01T00:00:00.000Z" }),
    )
    await putShot(missingCache, "file-new", "node-new")
    assert(!(await exists(shotJpegPath(missingCache, "file-old", "node-old"))), "a missing current.json removes an unprotected pair")
    assert(
      !(await exists(join(missingCache, "shots", "file-orphan", "node-orphan.json"))),
      "a missing current.json removes a sidecar that has no jpeg",
    )

    await writeFile(
      statePath,
      JSON.stringify({
        fileId: "file-loose",
        pageId: "",
        nodeId: "node-loose",
        projectName: "",
        pageName: "",
        artboardName: "",
        byFile: {},
        recent: [],
      }),
    )
    const looseCache = join(root, "blank-page")
    await plantPair(looseCache, "file-loose", "node-loose", 50, "2020-01-01T00:00:00.000Z")
    await plantPair(looseCache, "file-drop", "node-drop", 50, "2019-01-01T00:00:00.000Z")
    await putShot(looseCache, "file-trigger", "node-trigger")
    assert(await exists(shotJpegPath(looseCache, "file-loose", "node-loose")), "a blank pageId keeps the top-level artboard")
    assert(!(await exists(shotJpegPath(looseCache, "file-drop", "node-drop"))), "a blank pageId leaves an unprotected pair removable")

    await writeFile(settingsPath, JSON.stringify({ cacheBudgetMb: 1 }))
    await writeFile(statePath, memoryOf(place("file-huge", "node-huge"), [], []))
    const hugeCache = join(root, "huge")
    await plantPair(hugeCache, "file-huge", "node-huge", 2 * 1024 * 1024, "2024-06-01T00:00:00.000Z")
    await plantPair(hugeCache, "file-small", "node-small", 1000, "2020-01-01T00:00:00.000Z")
    await putShot(hugeCache, "file-trigger", "node-trigger")
    assert(await exists(shotJpegPath(hugeCache, "file-huge", "node-huge")), "a protected shot heavier than the budget stays")
    assert(!(await exists(shotJpegPath(hugeCache, "file-small", "node-small"))), "an unprotected shot is removed once protected weight exceeds the budget")

    await rm(statePath, { recursive: true, force: true })
    const ageCache = join(root, "age")
    await plantPair(ageCache, "file-old", "node-old", 600_000, "2020-01-01T00:00:00.000Z")
    await plantPair(ageCache, "file-new", "node-new", 600_000, "2024-01-01T00:00:00.000Z")
    await putShot(ageCache, "file-now", "node-now")
    assert(!(await exists(shotJpegPath(ageCache, "file-old", "node-old"))), "the older shot is removed first")
    assert(await exists(shotJpegPath(ageCache, "file-new", "node-new")), "a newer shot stays when it fits")

    let rejected = false
    try {
      await putShot(ageCache, "..", "node")
    } catch {
      rejected = true
    }
    assert(rejected, "a parent id is rejected")
    assert(!(await exists(join(ageCache, "node.jpg"))), "a rejected id writes nothing")

    const outside = join(root, "outside-target.jpg")
    await writeFile(outside, "outside-bytes")
    const linkCache = join(root, "link")
    const linkDir = join(linkCache, "shots", "file-link")
    await mkdir(linkDir, { recursive: true })
    await symlink(outside, join(linkDir, "node-link.jpg"))
    await writeFile(
      join(linkDir, "node-link.json"),
      JSON.stringify({
        name: null,
        file: "file-link",
        page: "page-1",
        timestamp: "2020-01-01T00:00:00.000Z",
        note: null,
        byteLength: 10,
      }),
    )
    await writeFile(settingsPath, JSON.stringify({ cacheBudgetMb: 0 }))
    await putShot(linkCache, "file-trigger", "node-trigger")
    assert((await readFile(outside, "utf8")) === "outside-bytes", "a sweep does not delete a symlink target")
  } finally {
    if (previousSettings === undefined) delete process.env.PAPER_PEEK_SETTINGS
    else process.env.PAPER_PEEK_SETTINGS = previousSettings
    if (previousState === undefined) delete process.env.PAPER_PEEK_STATE
    else process.env.PAPER_PEEK_STATE = previousState
    await rm(root, { recursive: true, force: true })
  }

  console.log("shot-cache.test.ts: ok")
}

runTests().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
