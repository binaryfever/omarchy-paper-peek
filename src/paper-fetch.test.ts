import { spawnSync } from "node:child_process"
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
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

function listPayload(open: boolean, parentId?: string): unknown {
  const file = open
    ? { id: FILE, name: "Audiol", type: "file", open: true, active: false }
    : { id: FILE, name: "Audiol", type: "file" }
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          resources: [parentId === undefined ? file : { ...file, parentId }],
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
  } finally {
    await rm(dir, { recursive: true, force: true })
  }

  console.log("paper-fetch.test.ts: ok")
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
