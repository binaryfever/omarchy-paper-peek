import { main, type ProbeIo, type SampleSink, type SampleTree } from "./paper-probe.ts"

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

const FILE_ID = "01M3NSDXNCKM0QFAGTRH3BF0CC"
const ARTBOARD_A = "QPO-0"
const ARTBOARD_B = "K9N-1"
const LAYER_X = "layer-not-artboard"

function preludeText(): string {
  return JSON.stringify({
    file: { id: FILE_ID, name: "Audiol — iOS", contentHash: { tokens: 1 } },
  })
}

function toolResultTextPayload(payload: unknown): { content: unknown[] } {
  return {
    content: [
      { type: "text", text: preludeText() },
      { type: "text", text: JSON.stringify(payload) },
    ],
  }
}

function toolsListResult(): unknown {
  return {
    tools: [
      { name: "get_basic_info", description: "", inputSchema: { type: "object" } },
      { name: "get_selection", description: "", inputSchema: { type: "object" } },
      { name: "get_screenshot", description: "", inputSchema: { type: "object" } },
    ],
  }
}

function basicInfoPayload(artboardIds: string[]): unknown {
  return {
    fileName: "Audiol",
    artboards: artboardIds.map((id) => ({ id, name: id })),
    artboardCount: artboardIds.length,
  }
}

function selectionPayload(count: number, nodeIds: string[]): unknown {
  return {
    count,
    selectedNodes: nodeIds.map((id) => ({ id, name: id })),
  }
}

function screenshotResult(jpeg: Uint8Array, nodeId: string, note: string): unknown {
  return {
    content: [
      { type: "text", text: preludeText() },
      {
        type: "image",
        mimeType: "image/jpeg",
        data: Buffer.from(jpeg).toString("base64"),
      },
      { type: "text", text: note },
    ],
  }
}

function memorySink(): { sink: SampleSink; trees: SampleTree[] } {
  const trees: SampleTree[] = []
  return {
    trees,
    sink: {
      async repair() {},
      async replaceCase(tree) {
        trees.push(tree)
      },
    },
  }
}

function ioFrom(args: {
  selection: unknown
  artboardIds?: string[]
  screenshotNodeId?: string
  jpeg?: Uint8Array
}): ProbeIo {
  const artboards = args.artboardIds ?? [ARTBOARD_A, ARTBOARD_B]
  const jpeg = args.jpeg ?? makeMinimalJpeg(4, 2)
  let shotNode = args.screenshotNodeId ?? artboards[0]!
  return {
    async listTools() {
      return toolsListResult()
    },
    async get_basic_info() {
      return toolResultTextPayload(basicInfoPayload(artboards))
    },
    async get_selection() {
      return toolResultTextPayload(args.selection)
    },
    async get_screenshot(target) {
      shotNode = target.nodeId
      return screenshotResult(jpeg, shotNode, "test note")
    },
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`assert failed: ${message}`)
    process.exit(1)
  }
}

async function expectCode(
  argv: string[],
  io: ProbeIo,
  sink: SampleSink,
  expected: number,
): Promise<void> {
  const code = await main(argv, { io, sink })
  assert(code === expected, `expected exit ${expected}, got ${code}`)
}

async function run(): Promise<void> {
  {
    const { sink, trees } = memorySink()
    const io = ioFrom({
      selection: selectionPayload(0, []),
      jpeg: makeMinimalJpeg(8, 6),
    })
    await expectCode(["--case", "nothing-selected"], io, sink, 0)
    assert(trees.length === 1, "nothing-selected should write one tree")
    const tree = trees[0]!
    assert(tree.claimed === "nothing-selected", "claimed case")
    assert(tree.doc !== null, "doc.md bytes for empty capture")
    const quote = JSON.parse(new TextDecoder().decode(tree.quote))
    assert(quote.width === 8 && quote.height === 6, "jpeg SOF size in quote")
    assert(quote.targetReason === "first-artboard", "empty uses first artboard")
    assert(quote.nodeId === ARTBOARD_A, "first artboard id")
  }

  {
    const { sink, trees } = memorySink()
    const io = ioFrom({
      selection: selectionPayload(1, [ARTBOARD_B]),
      jpeg: makeMinimalJpeg(10, 3),
    })
    await expectCode(["--case", "one-artboard"], io, sink, 0)
    assert(trees.length === 1, "one-artboard match")
    const quote = JSON.parse(new TextDecoder().decode(trees[0]!.quote))
    assert(quote.nodeId === ARTBOARD_B, "screenshot selected artboard")
    assert(quote.targetReason === "first-selected-node", "one uses selected node")
  }

  {
    const { sink, trees } = memorySink()
    const io = ioFrom({
      selection: selectionPayload(1, [LAYER_X]),
    })
    await expectCode(["--case", "one-artboard"], io, sink, 1)
    assert(trees.length === 0, "non-artboard single selection must not write")
  }

  {
    const { sink, trees } = memorySink()
    const io = ioFrom({
      selection: selectionPayload(2, [ARTBOARD_A, LAYER_X]),
      jpeg: makeMinimalJpeg(5, 5),
    })
    await expectCode(["--case", "several-selected"], io, sink, 0)
    assert(trees.length === 1, "several-selected match")
    const quote = JSON.parse(new TextDecoder().decode(trees[0]!.quote))
    assert(quote.nodeId === ARTBOARD_A, "several uses first selected node")
  }

  {
    const { sink, trees } = memorySink()
    const io = ioFrom({ selection: selectionPayload(0, []) })
    await expectCode(["--case", "one-artboard"], io, sink, 1)
    assert(trees.length === 0, "empty vs one-artboard mismatch writes nothing")
  }

  {
    const code = await main(["--case", "not-a-case"])
    assert(code === 3, "bad args exit 3")
  }

  {
    const { sink } = memorySink()
    const io: ProbeIo = {
      async listTools() {
        return { tools: [], nextCursor: "more" }
      },
      async get_basic_info() {
        throw new Error("should not run")
      },
      async get_selection() {
        throw new Error("should not run")
      },
      async get_screenshot() {
        throw new Error("should not run")
      },
    }
    await expectCode(["--case", "nothing-selected"], io, sink, 2)
  }

  console.log("paper-probe.test.ts: ok")
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
