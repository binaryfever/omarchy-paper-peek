import { spawnSync } from "node:child_process"
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  fetchArtboard,
  listProjects,
  parseFileId,
  parseNodeId,
  readArtboard,
  readProjects,
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

function listPayload(open: boolean): unknown {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          resources: [
            open
              ? { id: FILE, name: "Audiol", type: "file", open: true, active: false }
              : { id: FILE, name: "Audiol", type: "file" },
          ],
        }),
      },
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

async function run(): Promise<void> {
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
    }
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

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
