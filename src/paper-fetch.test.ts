import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  artboardChosen,
  fetchArtboard,
  listArtboards,
  listPages,
  listProjects,
  parseFileId,
  parseNodeId,
  parsePageId,
  peekStatus,
  readArtboard,
  readProjects,
  reportStatus,
  run,
  scriptedPaper,
  type ArtboardTarget,
} from "./paper-fetch.ts"
import { projectRows } from "./peek-memory.ts"

function pushSegment(out: number[], marker: number, payload: number[]): void {
  out.push(0xff, marker)
  const len = payload.length + 2
  out.push((len >> 8) & 0xff, len & 0xff)
  out.push(...payload)
}

function makeMinimalJpeg(width: number, height: number): Uint8Array {
  const bytes: number[] = [0xff, 0xd8]
  const app0 = [
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]
  pushSegment(bytes, 0xe0, app0)
  const sof = [
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01,
    0x11,
    0x00,
  ]
  pushSegment(bytes, 0xc0, sof)
  const sos = [0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]
  pushSegment(bytes, 0xda, sos)
  bytes.push(0xff, 0xd9)
  return Uint8Array.from(bytes)
}

const FILE = "01M3NSDXNCKM0QFAGTRH3BF0CC"
const NODE = "BN1-0"
const NOTE = "Note: Image was resized to 2000x1763px to fit size limits."

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`assert failed: ${message}`)
    process.exit(1)
  }
}

function ids(): ArtboardTarget {
  const fileId = parseFileId(FILE)
  const nodeId = parseNodeId(NODE)
  assert(fileId !== null && nodeId !== null, "fixture ids parse")
  return { fileId, nodeId }
}

function listPayload(open: boolean, parentId?: string, updatedAt?: number): unknown {
  const file: Record<string, unknown> = open
    ? { id: FILE, name: "Audiol", type: "file", open: true, active: false }
    : { id: FILE, name: "Audiol", type: "file" }
  if (parentId !== undefined) file.parentId = parentId
  if (updatedAt !== undefined) file.updatedAt = updatedAt
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          resources: [file],
        }),
      },
    ],
  }
}

function basicPayload(body: unknown): unknown {
  return {
    content: [
      { type: "text", text: JSON.stringify({ file: { id: FILE, name: "Audiol" } }) },
      { type: "text", text: JSON.stringify(body) },
    ],
  }
}

function shotPayload(jpeg: Uint8Array, note: string | null): unknown {
  const content: unknown[] = [
    { type: "image", mimeType: "image/jpeg", data: Buffer.from(jpeg).toString("base64") },
  ]
  if (note !== null) content.push({ type: "text", text: note })
  return { content }
}

async function runTests(): Promise<void> {
  const root = fileURLToPath(new URL("..", import.meta.url))
  const dir = await mkdtemp(join(tmpdir(), "paper-fetch-"))
  const jpeg = makeMinimalJpeg(8, 6)
  const target = ids()
  const previousLog = process.env.PAPER_PEEK_LOG
  process.env.PAPER_PEEK_LOG = join(dir, "refresh.log")
  try {
    let shots = 0
    let seenFile = ""
    let seenNode = ""
    let open = true
    const source = scriptedPaper({
      cacheDir: dir,
      listResources: () => listPayload(open),
      screenshot: (asked) => {
        shots += 1
        seenFile = asked.fileId
        seenNode = asked.nodeId
        return shotPayload(jpeg, NOTE)
      },
    })
    const first = await fetchArtboard(source, target)
    assert(first.kind === "fresh", "open inactive file returns a fresh shot")
    assert(first.image.note === NOTE, "note is the text block after the image")
    assert(first.image.width === 8 && first.image.height === 6, "size comes from the JPEG frame")
    assert(first.image.byteLength === jpeg.byteLength, "byte length matches the JPEG")
    assert(
      first.image.imagePath.endsWith(`shots/${FILE}/${NODE}.jpg`),
      "path includes the file id and the node id",
    )
    assert(seenFile === FILE && seenNode === NODE, "screenshot request uses the file id and node id")
    const bytes = await readFile(first.image.imagePath)
    assert(bytes[0] === 0xff && bytes[1] === 0xd8, "stored file is a JPEG")
    assert(shots === 1, "one screenshot call for the open file")

    open = false
    const second = await fetchArtboard(source, target)
    assert(second.kind === "cached" && second.reason === "file-closed", "closed file does not refresh")
    assert(second.image.imagePath === first.image.imagePath, "closed file keeps the stored JPEG")
    assert(shots === 1, "closed file does not call get_screenshot")
    const stored = await readArtboard(source, target)
    assert(stored.kind === "cached" && stored.image.imagePath === first.image.imagePath, "readArtboard is the stored JPEG")
    const projects = await readProjects(source)
    assert(projects.kind === "cached", "the list was stored")
    assert(projects.index.resources[0]?.kind === "closed-file", "stored list shows the file closed")

    const textThenImage = scriptedPaper({
      cacheDir: await mkdtemp(join(tmpdir(), "paper-fetch-order-")),
      listResources: () => listPayload(true),
      screenshot: () => ({
        content: [
          { type: "text", text: "prelude" },
          { type: "image", mimeType: "image/jpeg", data: Buffer.from(jpeg).toString("base64") },
        ],
      }),
    })
    const ordered = await fetchArtboard(textThenImage, target)
    assert(ordered.kind === "fresh" && ordered.image.note === null, "text before the image is not the note")

    let folderShots = 0
    const folderId = parseFileId("01M3FSZV4GNV5WV4WPRBS76WRB")
    assert(folderId !== null, "folder id parses as a file id alphabet")
    const folderSource = scriptedPaper({
      cacheDir: await mkdtemp(join(tmpdir(), "paper-fetch-folder-")),
      listResources: () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              resources: [{ id: "01M3FSZV4GNV5WV4WPRBS76WRB", name: "Projects", type: "folder" }],
            }),
          },
        ],
      }),
      screenshot: () => {
        folderShots += 1
        return shotPayload(jpeg, null)
      },
    })
    const folderShot = await fetchArtboard(folderSource, { fileId: folderId, nodeId: target.nodeId })
    assert(folderShot.kind === "unavailable" && folderShot.reason === "not-a-file", "a folder is not a screenshot target")
    assert(folderShots === 0, "a folder does not call get_screenshot")

    const downDir = await mkdtemp(join(tmpdir(), "paper-fetch-down-"))
    const seeded = scriptedPaper({
      cacheDir: downDir,
      listResources: () => listPayload(true),
      screenshot: () => shotPayload(jpeg, null),
    })
    const seededShot = await fetchArtboard(seeded, target)
    assert(seededShot.kind === "fresh", "seed a JPEG before Paper goes down")
    const down = scriptedPaper({
      cacheDir: downDir,
      listResources: () => {
        throw new Error("connection refused")
      },
      screenshot: () => {
        throw new Error("should not run")
      },
    })
    const downShot = await fetchArtboard(down, target)
    assert(downShot.kind === "cached" && downShot.reason === "paper-down", "Paper down returns the stored JPEG")

    const empty = scriptedPaper({
      cacheDir: await mkdtemp(join(tmpdir(), "paper-fetch-empty-")),
      listResources: () => {
        throw new Error("connection refused")
      },
    })
    const missing = await fetchArtboard(empty, target)
    assert(missing.kind === "unavailable" && missing.reason === "paper-down", "Paper down with no JPEG is unavailable")
    const listed = await listProjects(empty)
    assert(listed.kind === "unavailable" && listed.reason === "paper-down", "projects reports Paper down")

    const script = fileURLToPath(new URL("../scripts/paper-fetch", import.meta.url))
    const badArgs = spawnSync(script, ["shot"], { encoding: "utf8" })
    assert(badArgs.status === 3 && badArgs.stderr === "bad-args\n", "bad argv exits 3")
    const badId = spawnSync(script, ["shot", "--file", "../x", "--node", NODE], { encoding: "utf8" })
    assert(badId.status === 3 && badId.stderr === "bad-id\n", "a path id exits 3")

    const qml = await qmlFiles(root)
    assert(qml.length > 0, "the plugin has a qml file")
    for (const path of qml) {
      const text = await readFile(path, "utf8")
      assert(!text.includes("29979"), `${path} does not name the Paper port`)
      assert(!text.includes("list_resources"), `${path} does not name list_resources`)
      assert(!text.includes("get_screenshot"), `${path} does not name get_screenshot`)
      assert(!text.includes("get_basic_info"), `${path} does not name get_basic_info`)
    }
    const drawer = await readFile(join(root, "Drawer.qml"), "utf8")
    assert(!drawer.includes("resolve-project"), "browsing a project does not ask Paper to resolve it")
    assert(
      drawer.includes('["browser", "pages", target.fileId]'),
      "picking a project lists that project's cached pages",
    )
    assert(drawer.includes("Qt.Key_Return"), "Enter on the shot opens the browser")

    const pageId = parsePageId("p-3-0")
    assert(pageId !== null, "page id parses")
    const catalogDir = await mkdtemp(join(tmpdir(), "paper-fetch-catalog-"))
    let infoCalls = 0
    let widthShots = 0
    const catalog = scriptedPaper({
      cacheDir: catalogDir,
      listResources: () => listPayload(true, "01M3FSZV4GNV5WV4WPRBS76WRB"),
      basicInfo: (asked) => {
        infoCalls += 1
        if (asked.pageId === undefined) {
          return basicPayload({
            pages: [
              { type: "divider", id: "d-1", name: "Group" },
              { type: "page", id: "p-3-0", name: "Screens" },
              { type: "page", id: "p-1-0", name: "Page 1" },
            ],
          })
        }
        return basicPayload({
          pageId: asked.pageId,
          artboards: [
            { id: NODE, name: "Tokens", width: null, height: null },
            { id: "QPO-0", name: "Library", width: 2160, height: 400 },
          ],
        })
      },
      screenshot: () => {
        widthShots += 1
        return shotPayload(jpeg, null)
      },
    })
    const pages = await listPages(catalog, target.fileId, false)
    assert(pages.kind === "fresh", "first pages read writes the catalog")
    if (pages.kind === "fresh") {
      assert(pages.catalog.pages.length === 2, "dividers are not pages")
      assert(pages.catalog.pages[0]?.order === 0 && pages.catalog.pages[0]?.name === "Screens", "order follows the page list")
      assert(pages.catalog.pages[1]?.id === "p-1-0" && pages.catalog.pages[1]?.order === 1, "second page keeps its place")
    }
    const pagesAgain = await listPages(catalog, target.fileId, false)
    assert(pagesAgain.kind === "cached", "a second pages read uses the file")
    assert(infoCalls === 1, "a second pages read does not call Paper")
    const pageBytes = await readFile(join(catalogDir, "pages", `${FILE}.json`))
    const refreshed = await listPages(catalog, target.fileId, true)
    assert(refreshed.kind === "fresh" && infoCalls === 2, "--refresh calls Paper again")
    const downPages = scriptedPaper({
      cacheDir: catalogDir,
      listResources: () => {
        throw new Error("connection refused")
      },
      basicInfo: () => {
        throw new Error("connection refused")
      },
    })
    const closedPages = await listPages(downPages, target.fileId, false)
    assert(closedPages.kind === "cached", "Paper closed still serves a page cache without a call")
    const sameBytes = await readFile(join(catalogDir, "pages", `${FILE}.json`))
    assert(Buffer.from(pageBytes).equals(Buffer.from(sameBytes)), "Paper closed leaves the page file in place")
    const beforeFailedRefresh = await readFile(join(catalogDir, "pages", `${FILE}.json`))
    const refreshDown = await listPages(downPages, target.fileId, true)
    assert(refreshDown.kind === "unavailable" && refreshDown.reason === "paper-down", "refresh reports Paper down")
    const afterFailedRefresh = await readFile(join(catalogDir, "pages", `${FILE}.json`))
    assert(
      Buffer.from(beforeFailedRefresh).equals(Buffer.from(afterFailedRefresh)),
      "a failed refresh leaves the page file",
    )
    const missingPages = await listPages(
      scriptedPaper({
        cacheDir: await mkdtemp(join(tmpdir(), "paper-fetch-pages-down-")),
        listResources: () => {
          throw new Error("connection refused")
        },
        basicInfo: () => {
          throw new Error("connection refused")
        },
      }),
      target.fileId,
      false,
    )
    assert(missingPages.kind === "unavailable" && missingPages.reason === "paper-down", "pages with no cache exits unavailable when Paper is closed")

    const boards = await listArtboards(catalog, target.fileId, pageId, false)
    assert(boards.kind === "fresh", "first artboard read writes the catalog")
    if (boards.kind === "fresh") {
      assert(boards.catalog.artboards[0]?.name === "Tokens" && boards.catalog.artboards[0]?.width === 8, "a missing width comes from the JPEG")
      assert(boards.catalog.artboards[1]?.width === 2160, "a measured width stays the Paper width")
    }
    assert(widthShots === 1, "only the unmeasured artboard is screenshotted")
    const boardsAgain = await listArtboards(catalog, target.fileId, pageId, false)
    assert(boardsAgain.kind === "cached" && widthShots === 1 && infoCalls === 3, "a second artboard read does not call Paper")

    const shot = await fetchArtboard(catalog, target)
    assert(shot.kind === "fresh", "an open file still screenshots")
    const sidecar = JSON.parse(
      await readFile(join(catalogDir, "shots", FILE, `${NODE}.json`), "utf8"),
    ) as { name: string; file: string; page: string; timestamp: string }
    assert(sidecar.name === "Tokens" && sidecar.file === FILE && sidecar.page === "p-3-0", "the shot record names the cached artboard")
    assert(Number.isFinite(Date.parse(sidecar.timestamp)), "the shot record has a timestamp")

    const withFolder = await listProjects(catalog)
    assert(withFolder.kind === "fresh", "projects lists the scripted file")
    if (withFolder.kind === "fresh") {
      const file = withFolder.index.resources.find((item) => item.kind !== "folder" && item.id === FILE)
      assert(file !== undefined && file.kind !== "folder" && file.folder === "01M3FSZV4GNV5WV4WPRBS76WRB", "a project records its folder")
    }

    const cli = scriptedPaper({
      cacheDir: await mkdtemp(join(tmpdir(), "paper-fetch-cli-")),
      listResources: () => listPayload(false),
      basicInfo: () => {
        throw new Error("pages must not call Paper when the cache is absent and we only check argv")
      },
    })
    const badPage = await run(["pages", "../x"], cli)
    assert(badPage === 3, "a path page id exits 3")
    const positional = await run(["shot", FILE, NODE], catalog)
    assert(positional === 0, "shot accepts a file id and a node id")

    assert(peekStatus(true, true) === "live", "Paper up with an artboard is live")
    assert(peekStatus(false, true) === "not-live", "Paper down with an artboard is not live")
    assert(peekStatus(true, false) === "off", "no artboard is off even when Paper is up")
    assert(peekStatus(false, false) === "off", "no artboard is off when Paper is down")
    const chosen = JSON.stringify({ fileId: FILE, pageId: "p-1-0", nodeId: NODE })
    assert(artboardChosen(chosen), "a current artboard counts as chosen")
    assert(!artboardChosen(""), "an empty current file is not an artboard")
    assert(!artboardChosen("{"), "broken current json is not an artboard")
    let statusCalls = 0
    const idle = scriptedPaper({
      cacheDir: await mkdtemp(join(tmpdir(), "paper-fetch-status-off-")),
      listResources: () => {
        statusCalls += 1
        return listPayload(true)
      },
    })
    assert((await reportStatus(idle, "")) === "off", "no artboard reports off")
    assert(statusCalls === 0, "off does not call Paper")
    const up = scriptedPaper({
      cacheDir: await mkdtemp(join(tmpdir(), "paper-fetch-status-live-")),
      listResources: () => listPayload(true),
    })
    assert((await reportStatus(up, chosen)) === "live", "a reachable Paper reports live")
    const closed = scriptedPaper({
      cacheDir: await mkdtemp(join(tmpdir(), "paper-fetch-status-down-")),
      listResources: () => {
        throw new Error("connection refused")
      },
    })
    assert((await reportStatus(closed, chosen)) === "not-live", "an unreachable Paper reports not-live")

    const statusRoot = await mkdtemp(join(tmpdir(), "paper-fetch-status-cli-"))
    const statusFile = join(statusRoot, "status")
    const currentFile = join(statusRoot, "current.json")
    const statusCache = await mkdtemp(join(tmpdir(), "paper-fetch-status-cache-"))
    const offCli = spawnSync(script, ["status"], {
      encoding: "utf8",
      env: {
        ...process.env,
        PAPER_PEEK_STATE: join(statusRoot, "missing.json"),
        PAPER_PEEK_STATUS: statusFile,
        PAPER_PEEK_CACHE: statusCache,
      },
    })
    assert(offCli.status === 0 && offCli.stdout === "off\n", "status with no artboard prints off")
    assert((await readFile(statusFile, "utf8")) === "off\n", "status writes the off word")
    await writeFile(currentFile, chosen)
    const downCli = spawnSync(script, ["status"], {
      encoding: "utf8",
      env: {
        ...process.env,
        PAPER_PEEK_STATE: currentFile,
        PAPER_PEEK_STATUS: statusFile,
        PAPER_PEEK_CACHE: statusCache,
        PAPER_MCP_URL: "http://127.0.0.1:9/mcp",
      },
    })
    assert(downCli.status === 0 && downCli.stdout === "not-live\n", "status with Paper closed prints not-live")
    assert((await readFile(statusFile, "utf8")) === "not-live\n", "status writes the not-live word")
    const cacheNames = await readdir(statusCache)
    assert(!cacheNames.includes("projects.json"), "status does not write the project cache")

    const watchDir = await mkdtemp(join(tmpdir(), "paper-fetch-watch-"))
    const watchLog = join(watchDir, "refresh.log")
    process.env.PAPER_PEEK_LOG = watchLog
    let watchShots = 0
    let stamp = 1790658894817
    const watched = scriptedPaper({
      cacheDir: watchDir,
      listResources: () => listPayload(true, undefined, stamp),
      screenshot: () => {
        watchShots += 1
        return shotPayload(jpeg, null)
      },
    })
    const changed = await run(["watch", FILE, NODE], watched)
    assert(changed === 0, "watch exits 0")
    assert(
      (await readFile(watchLog, "utf8")) === `check ${FILE} ${NODE} changed\n`,
      "a new file stamp is logged as changed",
    )
    assert(watchShots === 0, "a check does not call get_screenshot")
    assert(!(await readdir(watchDir)).includes("projects.json"), "a check does not write projects.json")
    const fetched = await run(["shot", FILE, NODE], watched)
    assert(fetched === 0 && watchShots === 1, "the shot after a change calls get_screenshot once")
    const watchSidecar = JSON.parse(
      await readFile(join(watchDir, "shots", FILE, `${NODE}.json`), "utf8"),
    ) as { updatedAt?: number }
    assert(watchSidecar.updatedAt === stamp, "the shot record stores the file stamp")
    const quiet = await run(["watch", FILE, NODE], watched)
    assert(quiet === 0 && watchShots === 1, "the same stamp does not fetch again")
    const quietLines = (await readFile(watchLog, "utf8")).trim().split("\n")
    assert(quietLines.filter((line) => line.startsWith("fetch ")).length === 1, "one fetch for one stamp change")
    assert(quietLines.at(-1) === `check ${FILE} ${NODE} unchanged`, "the same stamp is logged as unchanged")
    stamp += 1
    const moved = await run(["watch", FILE, NODE], watched)
    assert(moved === 0 && watchShots === 1, "a moved stamp is still only a check")
    assert(
      (await readFile(watchLog, "utf8")).trim().endsWith(`check ${FILE} ${NODE} changed`),
      "a moved stamp is logged as changed",
    )
    const closedWatch = scriptedPaper({
      cacheDir: watchDir,
      listResources: () => listPayload(false, undefined, stamp + 5),
      screenshot: () => {
        watchShots += 1
        return shotPayload(jpeg, null)
      },
    })
    const closedWord = await run(["watch", FILE, NODE], closedWatch)
    assert(closedWord === 0 && watchShots === 1, "a closed file does not fetch")
    assert(
      (await readFile(watchLog, "utf8")).trim().endsWith(`check ${FILE} ${NODE} unchanged`),
      "a closed file is an unchanged check",
    )
    const downWatch = scriptedPaper({
      cacheDir: watchDir,
      listResources: () => {
        throw new Error("connection refused")
      },
      screenshot: () => {
        watchShots += 1
        return shotPayload(jpeg, null)
      },
    })
    const downWord = await run(["watch", FILE, NODE], downWatch)
    assert(downWord === 0 && watchShots === 1, "Paper down does not fetch")
    assert(
      (await readFile(watchLog, "utf8")).trim().endsWith(`check ${FILE} ${NODE} down`),
      "Paper down is logged as down",
    )
    const blindDir = await mkdtemp(join(tmpdir(), "paper-fetch-watch-blind-"))
    process.env.PAPER_PEEK_LOG = join(blindDir, "refresh.log")
    const blind = scriptedPaper({
      cacheDir: blindDir,
      listResources: () => listPayload(true),
      screenshot: () => {
        watchShots += 1
        return shotPayload(jpeg, null)
      },
    })
    const blindWord = await run(["watch", FILE, NODE], blind)
    assert(blindWord === 0 && watchShots === 1, "a file with no stamp does not fetch")
    assert(
      (await readFile(join(blindDir, "refresh.log"), "utf8")) === `check ${FILE} ${NODE} unchanged\n`,
      "a missing stamp is an unchanged check",
    )
    await rm(watchDir, { recursive: true, force: true })
    await rm(blindDir, { recursive: true, force: true })
    await memoryTests()
  } finally {
    if (previousLog === undefined) delete process.env.PAPER_PEEK_LOG
    else process.env.PAPER_PEEK_LOG = previousLog
    await rm(dir, { recursive: true, force: true })
  }

  console.log("paper-fetch.test.ts: ok")
}

const FILE_B = "01M3FYEHC2WZ9YC2DC3AJMX995"
const NODE_B = "1-0"
const PAGE = "p-1-0"
const FOLDER_A = "01M3FSZV4GNV5WV4WPRBS76WRB"
const FOLDER_B = "01M3STUDIOFOLDER0000000001"

function storedProjects(): string {
  return JSON.stringify({
    truncated: false,
    resources: [
      { kind: "folder", id: FOLDER_A, name: "Client" },
      { kind: "folder", id: FOLDER_B, name: "Studio" },
      { kind: "open-file", id: FILE, name: "Audiol", folder: FOLDER_A, active: false },
      { kind: "closed-file", id: FILE_B, name: "Site", folder: FOLDER_B },
    ],
  })
}

function pageFile(fileId: string, pageName: string): string {
  return JSON.stringify({ fileId, pages: [{ id: PAGE, name: pageName, order: 0 }] })
}

function artboardFile(fileId: string, nodeId: string, name: string): string {
  return JSON.stringify({
    fileId,
    pageId: PAGE,
    artboards: [{ id: nodeId, name, width: 8 }],
  })
}

function wireFiles(openA: boolean, openB: boolean, includeB: boolean, truncated: boolean): unknown {
  const resources: Record<string, unknown>[] = [
    { id: FOLDER_A, name: "Client", type: "folder" },
    { id: FOLDER_B, name: "Studio", type: "folder" },
  ]
  const fileA: Record<string, unknown> = { id: FILE, name: "Audiol", type: "file", parentId: FOLDER_A }
  if (openA) {
    fileA.open = true
    fileA.active = false
  }
  resources.push(fileA)
  if (includeB) {
    const fileB: Record<string, unknown> = { id: FILE_B, name: "Site", type: "file", parentId: FOLDER_B }
    if (openB) {
      fileB.open = true
      fileB.active = false
    }
    resources.push(fileB)
  }
  return {
    content: [{ type: "text", text: JSON.stringify({ truncated, resources }) }],
  }
}

async function capture(
  argv: readonly string[],
  source: Parameters<typeof run>[1],
): Promise<{ readonly code: 0 | 2 | 3; readonly stdout: string }> {
  const chunks: string[] = []
  const write = process.stdout.write.bind(process.stdout)
  process.stdout.write = ((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"))
    return true
  }) as typeof process.stdout.write
  try {
    const code = await run(argv, source)
    return { code, stdout: chunks.join("") }
  } finally {
    process.stdout.write = write
  }
}

type SavedMemory = {
  fileId: string
  pageId: string
  nodeId: string
  projectName: string
  artboardName: string
  byFile: Record<string, { nodeId: string; artboardName: string }>
  recent: { fileId: string; nodeId: string; artboardName: string; projectName: string }[]
}

async function memoryTests(): Promise<void> {
  const stateDir = await mkdtemp(join(tmpdir(), "paper-peek-state-"))
  const cacheDir = await mkdtemp(join(tmpdir(), "paper-peek-cache-"))
  const statePath = join(stateDir, "current.json")
  const previousState = process.env.PAPER_PEEK_STATE
  const previousCache = process.env.PAPER_PEEK_CACHE
  process.env.PAPER_PEEK_STATE = statePath
  process.env.PAPER_PEEK_CACHE = cacheDir
  let listCalls = 0
  let infoCalls = 0
  let openA = true
  let openB = true
  let includeB = true
  let truncated = false
  let hideNode = ""
  const source = scriptedPaper({
    cacheDir,
    listResources: () => {
      listCalls += 1
      return wireFiles(openA, openB, includeB, truncated)
    },
    basicInfo: (asked) => {
      infoCalls += 1
      const nodeId = asked.fileId === FILE ? NODE : NODE_B
      const name = asked.fileId === FILE ? "Tokens" : "Home"
      const artboards = hideNode === nodeId ? [] : [{ id: nodeId, name, width: 8 }]
      return basicPayload({ pageId: asked.pageId, artboards })
    },
  })
  try {
    await mkdir(join(cacheDir, "pages"), { recursive: true })
    await mkdir(join(cacheDir, "artboards", FILE), { recursive: true })
    await mkdir(join(cacheDir, "artboards", FILE_B), { recursive: true })
    await writeFile(join(cacheDir, "projects.json"), storedProjects())
    await writeFile(join(cacheDir, "pages", `${FILE}.json`), pageFile(FILE, "Page 1"))
    await writeFile(join(cacheDir, "pages", `${FILE_B}.json`), pageFile(FILE_B, "Cover"))
    await writeFile(join(cacheDir, "artboards", FILE, `${PAGE}.json`), artboardFile(FILE, NODE, "Tokens"))
    await writeFile(
      join(cacheDir, "artboards", FILE_B, `${PAGE}.json`),
      artboardFile(FILE_B, NODE_B, "Home"),
    )

    assert((await run(["remember", FILE, PAGE, NODE], source)) === 0, "remember writes the first artboard")
    assert((await run(["remember", FILE_B, PAGE, NODE_B], source)) === 0, "remember writes the second project")
    const saved = JSON.parse(await readFile(statePath, "utf8")) as SavedMemory
    assert(saved.fileId === FILE_B && saved.artboardName === "Home", "the newest artboard is current")
    assert(saved.projectName === "Site", "the current project name comes from the cache")
    assert(saved.byFile[FILE]?.artboardName === "Tokens", "the first project keeps its artboard")
    assert(saved.byFile[FILE_B]?.nodeId === NODE_B, "the second project keeps its artboard")
    assert(
      saved.recent.map((item) => `${item.projectName}:${item.artboardName}`).join(",") === "Site:Home,Audiol:Tokens",
      "recent artboards are newest first",
    )

    assert((await run(["remember", FILE, PAGE, NODE], source)) === 0, "remembering the first artboard again is accepted")
    const returned = JSON.parse(await readFile(statePath, "utf8")) as SavedMemory
    assert(returned.fileId === FILE && returned.artboardName === "Tokens", "returning to the first project restores its artboard")
    assert(returned.recent.length === 2, "a repeated artboard does not grow the recent list")
    assert(
      returned.recent[0]?.fileId === FILE && returned.recent[1]?.fileId === FILE_B,
      "the repeated artboard moves to the front",
    )
    const stable = await readFile(statePath, "utf8")
    assert((await run(["remember", FILE, PAGE, NODE], source)) === 0, "remembering the current artboard again is accepted")
    assert((await readFile(statePath, "utf8")) === stable, "remembering the current artboard again writes the same file")

    listCalls = 0
    infoCalls = 0
    const listed = await capture(["browser", "projects"], source)
    assert(listed.code === 0 && listCalls === 0 && infoCalls === 0, "a cached project list does not call Paper")
    const rows = JSON.parse(listed.stdout) as { rows: { kind: string; label: string; fileId?: string }[] }
    assert(rows.rows[0]?.kind === "header" && rows.rows[0]?.label === "Recent", "recent artboards sit at the top")
    assert(rows.rows[1]?.kind === "recent" && rows.rows[1]?.label === "Tokens", "the newest recent row is the current artboard")
    assert(rows.rows.some((row) => row.kind === "header" && row.label === "Client"), "projects are grouped by folder")
    assert(rows.rows.some((row) => row.kind === "project" && row.label === "Audiol"), "a file is a project row")
    assert(!rows.rows.some((row) => row.label === "Client" && row.kind === "project"), "a folder is not a project")
    const projectLabels = rows.rows.filter((row) => row.kind === "header" && row.label !== "Recent" && row.label !== "Projects").map((row) => row.label)
    assert(projectLabels.join(",") === "Client,Studio", "folder groups are alphabetical")

    const resolved = await capture(["resolve"], source)
    assert(resolved.code === 0 && resolved.stdout === '{"kind":"shot"}\n', "an artboard that is still in Paper opens")
    assert(infoCalls === 1, "an open file is checked with the page catalog")
    const back = await capture(["resolve-project", FILE_B], source)
    assert(back.code === 0 && back.stdout === '{"kind":"shot"}\n', "switching back opens that project's artboard")
    const restored = JSON.parse(await readFile(statePath, "utf8")) as SavedMemory
    assert(restored.fileId === FILE_B && restored.artboardName === "Home", "switching back makes that artboard current")
    assert(restored.recent[0]?.fileId === FILE_B, "switching back moves that artboard to the front of recent")

    openA = false
    infoCalls = 0
    await writeFile(statePath, stable)
    const closed = await capture(["resolve"], source)
    assert(closed.code === 0 && closed.stdout === '{"kind":"shot"}\n', "a closed file keeps the cached artboard")
    assert(infoCalls === 0, "a closed file is not opened to check the artboard")
    openA = true

    hideNode = NODE
    const gone = await capture(["resolve"], source)
    assert(gone.code === 0, "a deleted artboard does not fail the command")
    assert(
      gone.stdout === '{"kind":"projects","notice":"That artboard is gone."}\n',
      "a deleted artboard opens the browser with a short message",
    )
    const forgotten = JSON.parse(await readFile(statePath, "utf8")) as SavedMemory
    assert(forgotten.fileId === "" && forgotten.byFile[FILE] === undefined, "a deleted artboard is dropped")
    assert(forgotten.byFile[FILE_B]?.artboardName === "Home", "another project's artboard stays")
    hideNode = ""

    await writeFile(statePath, stable)
    includeB = false
    truncated = false
    const missingFile = await capture(["resolve-project", FILE_B], source)
    assert(
      missingFile.stdout === '{"kind":"projects","notice":"That artboard is gone."}\n',
      "a deleted project opens the browser",
    )
    assert((await run(["remember", FILE_B, PAGE, NODE_B], source)) === 0, "remember the second artboard before the truncated list")
    includeB = false
    truncated = true
    const unsure = await capture(["resolve"], source)
    assert(unsure.stdout === '{"kind":"shot"}\n', "a truncated project list does not drop the artboard")
    truncated = false
    includeB = true

    listCalls = 0
    const down = scriptedPaper({
      cacheDir,
      listResources: () => {
        throw new Error("connection refused")
      },
      basicInfo: () => {
        throw new Error("connection refused")
      },
    })
    await writeFile(statePath, stable)
    const offline = await capture(["resolve"], down)
    assert(offline.stdout === '{"kind":"shot"}\n', "Paper down still opens the cached artboard")
    assert((await readFile(statePath, "utf8")) === stable, "Paper down leaves the remembered artboard in place")

    const fresh = await capture(["resolve-project", "01M3OTHERFILE00000000000001"], source)
    assert(
      fresh.stdout === '{"kind":"pages","fileId":"01M3OTHERFILE00000000000001","notice":""}\n',
      "a project with no memory opens its pages",
    )
    listCalls = 0
    infoCalls = 0
    const pages = await capture(["browser", "pages", FILE], source)
    assert(pages.code === 0 && listCalls === 0 && infoCalls === 0, "a remembered project's cached pages do not call Paper")
    const pageRows = JSON.parse(pages.stdout) as { rows: { kind: string; label: string }[] }
    assert(pageRows.rows[0]?.kind === "page" && pageRows.rows[0]?.label === "Page 1", "cached pages keep Paper's names")
    await writeFile(
      join(cacheDir, "artboards", FILE, `${PAGE}.json`),
      JSON.stringify({
        fileId: FILE,
        pageId: PAGE,
        artboards: [
          { id: NODE, name: "Tokens", width: 8 },
          { id: "QPO-0", name: "Library", width: 12 },
        ],
      }),
    )
    const boards = await capture(["browser", "artboards", FILE, PAGE], source)
    assert(boards.code === 0 && listCalls === 0 && infoCalls === 0, "cached artboards do not call Paper")
    const boardRows = JSON.parse(boards.stdout) as { rows: { kind: string; label: string }[] }
    assert(
      boardRows.rows.map((row) => row.label).join(",") === "Tokens,Library",
      "cached artboards keep Paper's order and names",
    )

    await rm(statePath, { force: true })
    const empty = await capture(["resolve"], down)
    assert(empty.stdout === '{"kind":"projects","notice":""}\n', "no remembered artboard opens the browser")

    const legacy = JSON.stringify({ fileId: FILE, pageId: PAGE, nodeId: NODE })
    await writeFile(statePath, legacy)
    openA = true
    hideNode = ""
    const migrated = await capture(["browser", "projects"], source)
    const legacyRows = JSON.parse(migrated.stdout) as { rows: { kind: string; label: string }[] }
    assert(
      legacyRows.rows.some((row) => row.kind === "recent" && row.label === NODE),
      "an older state file still contributes one recent artboard",
    )
    assert((await readFile(statePath, "utf8")) === legacy, "reading recent artboards does not rewrite the state file")

    await rm(statePath, { force: true })
    for (let i = 1; i <= 6; i++) {
      const nodeId = `n-${i}`
      assert((await run(["remember", FILE, PAGE, nodeId], source)) === 0, "remember accepts six artboards")
    }
    const capped = JSON.parse(await readFile(statePath, "utf8")) as SavedMemory
    assert(capped.recent.length === 5, "recent keeps five artboards")
    assert(capped.recent[0]?.nodeId === "n-6", "the newest of six stays first")
    assert(!capped.recent.some((item) => item.nodeId === "n-1"), "the oldest artboard drops off the recent list")
    assert((await run(["remember", "../x", PAGE, NODE], source)) === 3, "a path id is rejected")
    const folded = projectRows(
      [{ id: FILE, name: "Site", folderId: FOLDER_A, folderName: "Projects" }],
      { current: null, byFile: {}, recent: [] },
    )
    assert(
      folded.filter((row) => row.kind === "header").map((row) => row.label).join(",") === "Projects",
      "a folder named Projects is listed once",
    )
  } finally {
    if (previousState === undefined) delete process.env.PAPER_PEEK_STATE
    else process.env.PAPER_PEEK_STATE = previousState
    if (previousCache === undefined) delete process.env.PAPER_PEEK_CACHE
    else process.env.PAPER_PEEK_CACHE = previousCache
    await rm(stateDir, { recursive: true, force: true })
    await rm(cacheDir, { recursive: true, force: true })
  }
}

async function qmlFiles(root: string): Promise<string[]> {
  const found: string[] = []
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.endsWith(".qml")) found.push(full)
    }
  }
  await walk(root)
  return found
}

runTests().catch((err) => {
  console.error(err)
  process.exit(1)
})
