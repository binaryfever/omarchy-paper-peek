import {
  mkdir,
  rename,
  rm,
  writeFile,
  readFile,
  stat,
} from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { configuredPaperUrl } from "./settings.ts"

export type ExitCode = 0 | 1 | 2 | 3

export type SelectionCase = "nothing-selected" | "one-artboard" | "several-selected"

type SampleFiles = {
  readonly toolsList: Uint8Array
  readonly basicInfo: Uint8Array
  readonly selection: Uint8Array
  readonly screenshot: Uint8Array
  readonly jpeg: Uint8Array
  readonly quote: Uint8Array
}

export type SampleTree =
  | (SampleFiles & { readonly claimed: "nothing-selected"; readonly doc: Uint8Array })
  | (SampleFiles & {
      readonly claimed: "one-artboard" | "several-selected"
      readonly doc: null
    })

export type SampleSink = {
  repair(): Promise<void>
  replaceCase(tree: SampleTree): Promise<void>
}

export type ProbeIo = {
  listTools(): Promise<unknown>
  get_basic_info(): Promise<unknown>
  get_selection(): Promise<unknown>
  get_screenshot(target: { readonly fileId: string; readonly nodeId: string }): Promise<unknown>
}

type AllowedTool = "get_basic_info" | "get_selection" | "get_screenshot"

type IoToolName = Exclude<keyof ProbeIo, "listTools">

type _IoMatchesAllowed =
  [IoToolName] extends [AllowedTool]
    ? [AllowedTool] extends [IoToolName]
      ? true
      : never
    : never

true satisfies _IoMatchesAllowed

export async function main(
  argv: readonly string[],
  deps?: { readonly io: ProbeIo; readonly sink: SampleSink },
): Promise<ExitCode> {
  const parsed = parseArgs(argv)
  if (parsed.kind === "bad-args") {
    process.stderr.write(`${parsed.message}\n`)
    return 3
  }

  const io = deps?.io ?? liveIo()
  const sink = deps?.sink ?? diskSink()

  const result = await run(parsed.claimed, io, sink)
  process.stdout.write(`${renderStdout(result)}\n`)
  const stderrLine = failureStderr(result)
  if (stderrLine !== null) {
    process.stderr.write(`${stderrLine}\n`)
  }
  return exitCodeOf(result)
}

type FileId = string & { readonly __brand: "FileId" }
type NodeId = string & { readonly __brand: "NodeId" }
type DisplayName = string & { readonly __brand: "DisplayName" }
type CountAtLeastTwo = number & { readonly __brand: "CountAtLeastTwo" }

function isFileId(value: unknown): value is FileId {
  return typeof value === "string" && value.length > 0
}

function isNodeId(value: unknown): value is NodeId {
  return typeof value === "string" && value.length > 0
}

function isDisplayName(value: unknown): value is DisplayName {
  return typeof value === "string" && value.length > 0
}

function isCountAtLeastTwo(value: number): value is CountAtLeastTwo {
  return Number.isInteger(value) && value >= 2
}

type JsonObject = { readonly [key: string]: JsonValue }

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | JsonObject

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

type PayloadFailure = { readonly kind: "bad-payload"; readonly message: string }

type ToolErrorResult = { readonly kind: "tool-error"; readonly message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPayloadFailure(value: JsonValue | PayloadFailure): value is PayloadFailure {
  return isRecord(value) && value.kind === "bad-payload" && typeof value.message === "string"
}

function isToolErrorResult(value: unknown): value is ToolErrorResult {
  return isRecord(value) && value.kind === "tool-error" && typeof value.message === "string"
}

type SelectionKind = "empty" | "one" | "several"

type CaseForKind = {
  readonly empty: "nothing-selected"
  readonly one: "one-artboard"
  readonly several: "several-selected"
}

type SelectionSnapshot =
  | { readonly kind: "empty" }
  | { readonly kind: "one"; readonly nodeId: NodeId }
  | { readonly kind: "several"; readonly count: CountAtLeastTwo; readonly firstNodeId: NodeId }

type BasicInfo = {
  readonly fileId: FileId
  readonly artboardIds: readonly NodeId[]
}

type TargetReason =
  | { readonly kind: "first-artboard" }
  | { readonly kind: "first-selected-node" }

type ReasonFor<K extends SelectionKind> = K extends "empty"
  ? { readonly kind: "first-artboard" }
  : { readonly kind: "first-selected-node" }

type ScreenshotTarget = { readonly fileId: FileId; readonly nodeId: NodeId }

type ScreenshotShot<R extends TargetReason = TargetReason> = {
  readonly target: ScreenshotTarget
  readonly reason: R
  readonly mimeType: "image/jpeg"
  readonly width: number
  readonly height: number
  readonly byteLength: number
  readonly note: string
  readonly jpeg: Uint8Array
}

type ToolCatalog = {
  readonly names: readonly DisplayName[]
  readonly rawResult: JsonValue
}

type InfoRecord = {
  readonly body: BasicInfo
  readonly rawResult: JsonValue
}

type SelectionRecord<S extends SelectionSnapshot> = {
  readonly body: S
  readonly rawResult: JsonValue
  readonly payload: JsonValue
}

type ScreenshotRecord<R extends TargetReason = TargetReason> = {
  readonly body: ScreenshotShot<R>
  readonly rawResult: JsonValue
}

type CaptureFor<K extends SelectionKind> = {
  readonly claimed: CaseForKind[K]
  readonly catalog: ToolCatalog
  readonly calls: {
    readonly get_basic_info: InfoRecord
    readonly get_selection: SelectionRecord<Extract<SelectionSnapshot, { kind: K }>>
    readonly get_screenshot: ScreenshotRecord<ReasonFor<K>>
  }
}

type Capture = CaptureFor<"empty"> | CaptureFor<"one"> | CaptureFor<"several">

type _CallKeys = keyof CaptureFor<"empty">["calls"]

type _CallsMatch =
  [_CallKeys] extends [AllowedTool] ? ([AllowedTool] extends [_CallKeys] ? true : never) : never

true satisfies _CallsMatch

type ContentBlock =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "image"; readonly mimeType: string; readonly dataBase64: string }

type Split =
  | { readonly kind: "ok"; readonly blocks: readonly ContentBlock[] }
  | { readonly kind: "tool-error"; readonly message: string }
  | PayloadFailure

type WithCatalog = { readonly catalog: ToolCatalog }

type ProbeFailure =
  | { readonly kind: "transport"; readonly message: string; readonly catalog: ToolCatalog | null }
  | {
      readonly kind: "tool-error"
      readonly tool: "tools/list"
      readonly message: string
      readonly catalog: null
    }
  | ({ readonly kind: "tool-error"; readonly tool: AllowedTool; readonly message: string } & WithCatalog)
  | { readonly kind: "bad-payload"; readonly tool: "tools/list"; readonly message: string; readonly catalog: null }
  | ({ readonly kind: "bad-payload"; readonly tool: AllowedTool; readonly message: string } & WithCatalog)
  | ({
      readonly kind: "case-mismatch"
      readonly claimed: SelectionCase
      readonly observed: SelectionKind
      readonly observedCount: number
      readonly selectionPayload: JsonValue
    } &
      WithCatalog)
  | ({ readonly kind: "no-screenshot-target" } & WithCatalog)
  | ({ readonly kind: "bad-image"; readonly message: string } & WithCatalog)
  | ({ readonly kind: "commit-failed"; readonly message: string } & WithCatalog)
  | ({
      readonly kind: "commit-incomplete"
      readonly message: string
      readonly claimed: SelectionCase
    } &
      WithCatalog)

type ProbeResult =
  | { readonly kind: "wrote"; readonly catalog: ToolCatalog; readonly capture: Capture }
  | { readonly kind: "rejected"; readonly failure: ProbeFailure }

type ArgParse =
  | { readonly kind: "ok"; readonly claimed: SelectionCase }
  | { readonly kind: "bad-args"; readonly message: string }

type Match =
  | {
      readonly ok: true
      readonly kind: "empty"
      readonly selection: SelectionRecord<Extract<SelectionSnapshot, { kind: "empty" }>>
    }
  | {
      readonly ok: true
      readonly kind: "one"
      readonly selection: SelectionRecord<Extract<SelectionSnapshot, { kind: "one" }>>
    }
  | {
      readonly ok: true
      readonly kind: "several"
      readonly selection: SelectionRecord<Extract<SelectionSnapshot, { kind: "several" }>>
    }
  | { readonly ok: false; readonly observed: SelectionKind; readonly observedCount: number }

type QuoteCard = {
  readonly imageMimeType: "image/jpeg"
  readonly width: number
  readonly height: number
  readonly byteLength: number
  readonly note: string
  readonly fileId: string
  readonly nodeId: string
  readonly targetReason: "first-artboard" | "first-selected-node"
  readonly selectionPayload: JsonValue
}

const ALL_CASES: readonly SelectionCase[] = [
  "nothing-selected",
  "one-artboard",
  "several-selected",
]

function parseArgs(argv: readonly string[]): ArgParse {
  if (argv.length !== 2 || argv[0] !== "--case") {
    return { kind: "bad-args", message: "usage: paper-probe --case <nothing-selected|one-artboard|several-selected>" }
  }
  const claimed = argv[1]
  if (
    claimed !== "nothing-selected" &&
    claimed !== "one-artboard" &&
    claimed !== "several-selected"
  ) {
    return { kind: "bad-args", message: `unknown case: ${claimed}` }
  }
  return { kind: "ok", claimed }
}

function reject(
  failure: ProbeFailure,
  catalog: ToolCatalog | null,
): ProbeResult {
  const withCatalog =
    catalog !== null && failure.catalog === null
      ? ({ ...failure, catalog } as ProbeFailure)
      : failure
  return { kind: "rejected", failure: withCatalog }
}

async function run(claimed: SelectionCase, io: ProbeIo, sink: SampleSink): Promise<ProbeResult> {
  await sink.repair()

  let catalog: ToolCatalog
  try {
    const listRaw = parseJsonValue(await io.listTools())
    if (isPayloadFailure(listRaw)) {
      return reject(
        { kind: "bad-payload", tool: "tools/list", message: listRaw.message, catalog: null },
        null,
      )
    }
    const parsed = parseCatalog(listRaw)
    if (isPayloadFailure(parsed)) {
      return reject(
        { kind: "bad-payload", tool: "tools/list", message: parsed.message, catalog: null },
        null,
      )
    }
    catalog = parsed
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return reject({ kind: "transport", message, catalog: null }, null)
  }

  let basic: InfoRecord
  try {
    const basicResponse = await io.get_basic_info()
    const basicRaw = parseJsonValue(basicResponse)
    if (isPayloadFailure(basicRaw)) {
      return reject(
        { kind: "bad-payload", tool: "get_basic_info", message: basicRaw.message, catalog },
        catalog,
      )
    }
    const parsed = parseBasicInfo(basicRaw)
    if (isPayloadFailure(parsed)) {
      return reject(
        { kind: "bad-payload", tool: "get_basic_info", message: parsed.message, catalog },
        catalog,
      )
    }
    if (isToolErrorResult(parsed)) {
      return reject(
        { kind: "tool-error", tool: "get_basic_info", message: parsed.message, catalog },
        catalog,
      )
    }
    basic = parsed
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return reject({ kind: "transport", message, catalog }, catalog)
  }

  let selection: SelectionRecord<SelectionSnapshot>
  try {
    const selRaw = parseJsonValue(await io.get_selection())
    if (isPayloadFailure(selRaw)) {
      return reject(
        { kind: "bad-payload", tool: "get_selection", message: selRaw.message, catalog },
        catalog,
      )
    }
    const parsed = parseSelection(selRaw)
    if (isPayloadFailure(parsed)) {
      return reject(
        { kind: "bad-payload", tool: "get_selection", message: parsed.message, catalog },
        catalog,
      )
    }
    if (isToolErrorResult(parsed)) {
      return reject(
        { kind: "tool-error", tool: "get_selection", message: parsed.message, catalog },
        catalog,
      )
    }
    selection = parsed
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return reject({ kind: "transport", message, catalog }, catalog)
  }

  const matched = matchCase(claimed, selection, basic.body.artboardIds)
  if (!matched.ok) {
    return reject(
      {
        kind: "case-mismatch",
        claimed,
        observed: matched.observed,
        observedCount: matched.observedCount,
        selectionPayload: selection.payload,
        catalog,
      },
      catalog,
    )
  }

  const chosen = chooseTarget(basic.body, matched.selection.body)
  if (!chosen.ok) {
    return reject({ kind: "no-screenshot-target", catalog }, catalog)
  }

  let screenshot: ScreenshotRecord
  try {
    const shotRaw = parseJsonValue(
      await io.get_screenshot({
        fileId: chosen.target.fileId,
        nodeId: chosen.target.nodeId,
      }),
    )
    if (isPayloadFailure(shotRaw)) {
      return reject(
        { kind: "bad-payload", tool: "get_screenshot", message: shotRaw.message, catalog },
        catalog,
      )
    }
    const parsed = parseScreenshot(shotRaw, chosen)
    if (isPayloadFailure(parsed)) {
      return reject(
        { kind: "bad-payload", tool: "get_screenshot", message: parsed.message, catalog },
        catalog,
      )
    }
    if (isToolErrorResult(parsed)) {
      return reject(
        { kind: "tool-error", tool: "get_screenshot", message: parsed.message, catalog },
        catalog,
      )
    }
    if (isRecord(parsed) && parsed.kind === "bad-image" && typeof parsed.message === "string") {
      return reject({ kind: "bad-image", message: parsed.message, catalog }, catalog)
    }
    screenshot = parsed
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return reject({ kind: "transport", message, catalog }, catalog)
  }

  const capture = assemble({
    kind: matched.kind,
    catalog,
    basicInfo: basic,
    selection: matched.selection,
    screenshot,
  })

  const tree = materialize(capture)
  try {
    await sink.replaceCase(tree)
  } catch (err) {
    if (err instanceof CommitIncomplete) {
      return reject(
        {
          kind: "commit-incomplete",
          message: err.message,
          claimed: err.claimed,
          catalog,
        },
        catalog,
      )
    }
    const message = err instanceof Error ? err.message : String(err)
    return reject({ kind: "commit-failed", message, catalog }, catalog)
  }

  return { kind: "wrote", catalog, capture }
}

function liveIo(): ProbeIo {
  const endpoint = configuredPaperUrl()

  let sessionId: string | null = null
  let nextId = 1

  async function post(method: string, params?: JsonObject): Promise<JsonValue> {
    let url: URL
    try {
      url = new URL(endpoint)
    } catch {
      throw new TransportError(`invalid endpoint: ${endpoint}`)
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    }
    if (sessionId !== null) {
      headers["Mcp-Session-Id"] = sessionId
    }

    const body: JsonObject = {
      jsonrpc: "2.0",
      id: nextId++,
      method,
    }
    if (params !== undefined) {
      body.params = params
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new TransportError(message)
    }

    if (response.status !== 200) {
      throw new TransportError(`HTTP ${response.status}`)
    }

    const newSession = response.headers.get("Mcp-Session-Id")
    if (newSession !== null && newSession.length > 0) {
      sessionId = newSession
    }

    const text = await response.text()
    const envelope = parseSseJsonRpc(text)
    if ("error" in envelope && envelope.error !== undefined && envelope.error !== null) {
      const errObj = envelope.error
      const msg =
        isJsonObject(errObj as JsonValue) && typeof (errObj as JsonObject).message === "string"
          ? String((errObj as JsonObject).message)
          : "JSON-RPC error"
      throw new TransportError(msg)
    }
    if (!("result" in envelope) || envelope.result === undefined) {
      throw new TransportError("missing result in JSON-RPC response")
    }
    const result = parseJsonValue(envelope.result)
    if (isPayloadFailure(result)) {
      throw new TransportError(result.message)
    }
    return result
  }

  async function ensureSession(): Promise<void> {
    if (sessionId !== null) {
      return
    }
    await post("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "paper-probe", version: "0.0.0" },
    })
  }

  return {
    async listTools() {
      await ensureSession()
      return post("tools/list", {})
    },
    async get_basic_info() {
      await ensureSession()
      return post("tools/call", { name: "get_basic_info", arguments: {} })
    },
    async get_selection() {
      await ensureSession()
      return post("tools/call", { name: "get_selection", arguments: {} })
    },
    async get_screenshot(target) {
      await ensureSession()
      return post("tools/call", {
        name: "get_screenshot",
        arguments: { nodeId: target.nodeId, fileId: target.fileId },
      })
    },
  }
}

function parseSseJsonRpc(body: string): JsonObject {
  const lines = body.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line === "event: message" || line.startsWith("event: message")) {
      const dataLine = lines[i + 1]
      if (dataLine !== undefined && dataLine.startsWith("data: ")) {
        const parsed = JSON.parse(dataLine.slice(6)) as unknown
        const json = parseJsonValue(parsed)
        if (isPayloadFailure(json)) {
          throw new TransportError(json.message)
        }
        if (!isJsonObject(json)) {
          throw new TransportError("SSE data is not a JSON object")
        }
        return json
      }
    }
  }
  throw new TransportError("missing SSE message event")
}

class TransportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TransportError"
  }
}

class CommitIncomplete extends Error {
  readonly claimed: SelectionCase
  constructor(claimed: SelectionCase, message: string) {
    super(message)
    this.name = "CommitIncomplete"
    this.claimed = claimed
  }
}

function repoRoot(): URL {
  return new URL("..", import.meta.url)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function caseDir(root: URL, claimed: SelectionCase): string {
  return new URL(`docs/paper-mcp-samples/${claimed}/`, root).pathname
}

function incomingDir(root: URL, claimed: SelectionCase): string {
  return new URL(`.${claimed}.incoming`, root).pathname
}

function previousDir(root: URL, claimed: SelectionCase): string {
  return new URL(`.${claimed}.previous`, root).pathname
}

function diskSink(): SampleSink {
  const root = repoRoot()
  const docsDir = new URL("docs/", root).pathname
  const samplesDir = new URL("docs/paper-mcp-samples/", root).pathname
  const pendingDoc = new URL("docs/.paper-mcp.md.pending", root).pathname
  const publishedDoc = new URL("docs/paper-mcp.md", root).pathname

  async function ensureDocs(): Promise<void> {
    await mkdir(samplesDir, { recursive: true })
    await mkdir(docsDir, { recursive: true })
  }

  async function publishDocFromNothingSelected(): Promise<void> {
    await ensureDocs()
    const docSource = new URL(
      "docs/paper-mcp-samples/nothing-selected/doc.md",
      root,
    ).pathname
    if (!(await pathExists(docSource))) {
      return
    }
    const content = await readFile(docSource)
    const temp = `${publishedDoc}.tmp`
    await writeFile(temp, content)
    await rename(temp, publishedDoc)
  }

  return {
    async repair() {
      await ensureDocs()
      for (const claimed of ALL_CASES) {
        const incoming = incomingDir(root, claimed)
        if (await pathExists(incoming)) {
          await rm(incoming, { recursive: true, force: true })
        }
      }

      if (await pathExists(pendingDoc)) {
        await publishDocFromNothingSelected()
        await rm(pendingDoc, { force: true })
      }

      for (const claimed of ALL_CASES) {
        const live = caseDir(root, claimed)
        const previous = previousDir(root, claimed)
        const hasLive = await pathExists(live)
        const hasPrevious = await pathExists(previous)
        if (hasLive && hasPrevious) {
          await rm(previous, { recursive: true, force: true })
        } else if (!hasLive && hasPrevious) {
          await rename(previous, live)
        }
      }
    },

    async replaceCase(tree) {
      await ensureDocs()
      const claimed = tree.claimed
      const live = caseDir(root, claimed)
      const incoming = incomingDir(root, claimed)
      const previous = previousDir(root, claimed)

      if (await pathExists(incoming)) {
        await rm(incoming, { recursive: true, force: true })
      }
      await mkdir(incoming, { recursive: true })

      await writeFile(`${incoming}/tools-list.json`, tree.toolsList)
      await writeFile(`${incoming}/get_basic_info.json`, tree.basicInfo)
      await writeFile(`${incoming}/get_selection.json`, tree.selection)
      await writeFile(`${incoming}/get_screenshot.json`, tree.screenshot)
      await writeFile(`${incoming}/screenshot.jpg`, tree.jpeg)
      await writeFile(`${incoming}/quote.json`, tree.quote)
      if (tree.doc !== null) {
        await writeFile(`${incoming}/doc.md`, tree.doc)
      }

      const hadLive = await pathExists(live)
      if (hadLive) {
        if (await pathExists(previous)) {
          await rm(previous, { recursive: true, force: true })
        }
        await rename(live, previous)
      }

      await rename(incoming, live)

      if (tree.doc !== null) {
        try {
          await writeFile(pendingDoc, new Uint8Array(0))
          const docSource = `${live}/doc.md`
          const content = await readFile(docSource)
          const temp = `${publishedDoc}.tmp`
          await writeFile(temp, content)
          await rename(temp, publishedDoc)
          if (await pathExists(previous)) {
            await rm(previous, { recursive: true, force: true })
          }
          await rm(pendingDoc, { force: true })
        } catch (err) {
          const broken = `${live}.broken`
          try {
            if (await pathExists(broken)) {
              await rm(broken, { recursive: true, force: true })
            }
            await rename(live, broken)
            if (await pathExists(previous)) {
              await rename(previous, live)
            }
          } catch (rollbackErr) {
            const msg =
              rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)
            throw new CommitIncomplete(claimed, msg)
          }
          await rm(pendingDoc, { force: true })
          const message = err instanceof Error ? err.message : String(err)
          throw new Error(message)
        }
      } else {
        if (await pathExists(previous)) {
          await rm(previous, { recursive: true, force: true })
        }
      }
    },
  }
}

function parseJsonValue(value: unknown): JsonValue | PayloadFailure {
  if (
    value === undefined ||
    typeof value === "bigint" ||
    typeof value === "symbol" ||
    typeof value === "function"
  ) {
    return { kind: "bad-payload", message: "value is not JSON-serializable" }
  }
  if (typeof value === "number" && (Number.isNaN(value) || !Number.isFinite(value))) {
    return { kind: "bad-payload", message: "number is not finite" }
  }
  return walkJson(value)
}

function walkJson(value: unknown): JsonValue | PayloadFailure {
  if (value === null) {
    return null
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return value
  }
  if (typeof value === "number") {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return { kind: "bad-payload", message: "number is not finite" }
    }
    return value
  }
  if (Array.isArray(value)) {
    const out: JsonValue[] = []
    for (const item of value) {
      const walked = walkJson(item)
      if (isPayloadFailure(walked)) {
        return walked
      }
      out.push(walked)
    }
    return out
  }
  if (typeof value === "object") {
    const out: JsonObject = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const walked = walkJson(item)
      if (isPayloadFailure(walked)) {
        return walked
      }
      out[key] = walked
    }
    return out
  }
  return { kind: "bad-payload", message: "value is not JSON-serializable" }
}

function parseCatalog(raw: JsonValue): ToolCatalog | PayloadFailure {
  if (!isJsonObject(raw)) {
    return { kind: "bad-payload", message: "tools/list result is not an object" }
  }
  if ("nextCursor" in raw && raw.nextCursor !== undefined && raw.nextCursor !== null) {
    return { kind: "bad-payload", message: "tools/list returned nextCursor" }
  }
  const tools = raw.tools
  if (!Array.isArray(tools)) {
    return { kind: "bad-payload", message: "tools/list missing tools array" }
  }
  const names: DisplayName[] = []
  for (const element of tools) {
    if (!isJsonObject(element)) {
      return { kind: "bad-payload", message: "tool entry is not an object" }
    }
    const name = element.name
    if (!isDisplayName(name)) {
      return { kind: "bad-payload", message: "tool name is missing or empty" }
    }
    names.push(name)
  }
  return { names, rawResult: raw }
}

function splitToolResult(raw: JsonValue): Split {
  if (!isJsonObject(raw)) {
    return { kind: "bad-payload", message: "tool result is not an object" }
  }
  if ("isError" in raw) {
    if (raw.isError === true) {
      const message = toolErrorMessage(raw)
      return { kind: "tool-error", message }
    }
    if (raw.isError !== false && raw.isError !== undefined) {
      return { kind: "bad-payload", message: "isError is not boolean" }
    }
  }
  const content = raw.content
  if (!Array.isArray(content)) {
    return { kind: "bad-payload", message: "content is not an array" }
  }
  const blocks: ContentBlock[] = []
  for (const item of content) {
    if (!isJsonObject(item)) {
      return { kind: "bad-payload", message: "content block is not an object" }
    }
    const type = item.type
    if (type === "text") {
      if (typeof item.text !== "string") {
        return { kind: "bad-payload", message: "text block missing text" }
      }
      blocks.push({ kind: "text", text: item.text })
      continue
    }
    if (type === "image") {
      if (typeof item.mimeType !== "string" || typeof item.data !== "string") {
        return { kind: "bad-payload", message: "image block missing mimeType or data" }
      }
      blocks.push({
        kind: "image",
        mimeType: item.mimeType,
        dataBase64: item.data,
      })
      continue
    }
    return { kind: "bad-payload", message: "unknown content block type" }
  }
  return { kind: "ok", blocks }
}

function toolErrorMessage(raw: JsonObject): string {
  const content = raw.content
  if (!Array.isArray(content)) {
    return "tool error"
  }
  const parts: string[] = []
  for (const item of content) {
    if (isJsonObject(item as JsonValue) && item.type === "text" && typeof item.text === "string") {
      parts.push(item.text)
    }
  }
  return parts.length > 0 ? parts.join("\n") : "tool error"
}

function parsePrelude(text: string): { fileId: FileId } | PayloadFailure {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { kind: "bad-payload", message: "prelude is not JSON" }
  }
  const json = parseJsonValue(parsed)
  if (isPayloadFailure(json)) {
    return json
  }
  if (!isJsonObject(json)) {
    return { kind: "bad-payload", message: "prelude is not an object" }
  }
  const file = json.file
  if (!isJsonObject(file)) {
    return { kind: "bad-payload", message: "prelude missing file object" }
  }
  const id = file.id
  if (!isFileId(id)) {
    return { kind: "bad-payload", message: "prelude file.id is missing or empty" }
  }
  if (typeof file.name !== "string" || file.name.length === 0) {
    return { kind: "bad-payload", message: "prelude file.name is missing or empty" }
  }
  return { fileId: id }
}

function parseBasicInfo(
  raw: JsonValue,
):
  | InfoRecord
  | PayloadFailure
  | { readonly kind: "tool-error"; readonly message: string } {
  const split = splitToolResult(raw)
  if (split.kind === "tool-error") {
    return { kind: "tool-error", message: split.message }
  }
  if (split.kind === "bad-payload") {
    return split
  }
  if (split.blocks.length !== 2 || split.blocks[0]?.kind !== "text" || split.blocks[1]?.kind !== "text") {
    return { kind: "bad-payload", message: "get_basic_info expected two text blocks" }
  }
  const prelude = parsePrelude(split.blocks[0].text)
  if (isPayloadFailure(prelude)) {
    return prelude
  }
  let payload: unknown
  try {
    payload = JSON.parse(split.blocks[1].text)
  } catch {
    return { kind: "bad-payload", message: "get_basic_info payload is not JSON" }
  }
  const payloadJson = parseJsonValue(payload)
  if (isPayloadFailure(payloadJson)) {
    return payloadJson
  }
  if (!isJsonObject(payloadJson)) {
    return { kind: "bad-payload", message: "get_basic_info payload is not an object" }
  }
  const artboards = payloadJson.artboards
  if (!Array.isArray(artboards)) {
    return { kind: "bad-payload", message: "artboards is not an array" }
  }
  const artboardIds: NodeId[] = []
  for (const entry of artboards) {
    if (!isJsonObject(entry)) {
      return { kind: "bad-payload", message: "artboard entry is not an object" }
    }
    const id = entry.id
    if (!isNodeId(id)) {
      return { kind: "bad-payload", message: "artboard id is missing or empty" }
    }
    artboardIds.push(id)
  }
  return {
    body: { fileId: prelude.fileId, artboardIds },
    rawResult: raw,
  }
}

function parseSelection(
  raw: JsonValue,
):
  | SelectionRecord<SelectionSnapshot>
  | PayloadFailure
  | { readonly kind: "tool-error"; readonly message: string } {
  const split = splitToolResult(raw)
  if (split.kind === "tool-error") {
    return { kind: "tool-error", message: split.message }
  }
  if (split.kind === "bad-payload") {
    return split
  }
  if (split.blocks.length !== 2 || split.blocks[0]?.kind !== "text" || split.blocks[1]?.kind !== "text") {
    return { kind: "bad-payload", message: "get_selection expected two text blocks" }
  }
  const prelude = parsePrelude(split.blocks[0].text)
  if (isPayloadFailure(prelude)) {
    return prelude
  }
  let payload: unknown
  try {
    payload = JSON.parse(split.blocks[1].text)
  } catch {
    return { kind: "bad-payload", message: "get_selection payload is not JSON" }
  }
  const payloadJson = parseJsonValue(payload)
  if (isPayloadFailure(payloadJson)) {
    return payloadJson
  }
  if (!isJsonObject(payloadJson)) {
    return { kind: "bad-payload", message: "get_selection payload is not an object" }
  }
  const count = payloadJson.count
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
    return { kind: "bad-payload", message: "selection count is invalid" }
  }
  const selectedNodes = payloadJson.selectedNodes
  if (!Array.isArray(selectedNodes)) {
    return { kind: "bad-payload", message: "selectedNodes is not an array" }
  }
  if (selectedNodes.length !== count) {
    return { kind: "bad-payload", message: "selectedNodes length does not match count" }
  }
  if (count === 0) {
    return {
      body: { kind: "empty" },
      rawResult: raw,
      payload: payloadJson,
    }
  }
  const first = selectedNodes[0]
  if (!isJsonObject(first)) {
    return { kind: "bad-payload", message: "selected node is not an object" }
  }
  const nodeId = first.id
  if (!isNodeId(nodeId)) {
    return { kind: "bad-payload", message: "selected node id is missing or empty" }
  }
  if (count === 1) {
    return {
      body: { kind: "one", nodeId },
      rawResult: raw,
      payload: payloadJson,
    }
  }
  if (!isCountAtLeastTwo(count)) {
    return { kind: "bad-payload", message: "selection count is invalid" }
  }
  return {
    body: { kind: "several", count, firstNodeId: nodeId },
    rawResult: raw,
    payload: payloadJson,
  }
}

function parseScreenshot(
  raw: JsonValue,
  chosen: { readonly target: ScreenshotTarget; readonly reason: TargetReason },
):
  | ScreenshotRecord
  | PayloadFailure
  | { readonly kind: "tool-error"; readonly message: string }
  | { readonly kind: "bad-image"; readonly message: string } {
  const split = splitToolResult(raw)
  if (split.kind === "tool-error") {
    return { kind: "tool-error", message: split.message }
  }
  if (split.kind === "bad-payload") {
    return split
  }
  if (
    split.blocks.length !== 3 ||
    split.blocks[0]?.kind !== "text" ||
    split.blocks[1]?.kind !== "image" ||
    split.blocks[2]?.kind !== "text"
  ) {
    return { kind: "bad-payload", message: "get_screenshot expected text, image, text" }
  }
  const image = split.blocks[1]
  if (image.mimeType !== "image/jpeg") {
    return { kind: "bad-image", message: `unexpected mime type: ${image.mimeType}` }
  }
  let jpeg: Uint8Array
  try {
    jpeg = Uint8Array.from(Buffer.from(image.dataBase64, "base64"))
  } catch {
    return { kind: "bad-image", message: "image data is not valid base64" }
  }
  const size = jpegSize(jpeg)
  if (isRecord(size) && size.kind === "bad-image") {
    return size as { readonly kind: "bad-image"; readonly message: string }
  }
  const note = split.blocks[2].text
  return {
    body: {
      target: chosen.target,
      reason: chosen.reason,
      mimeType: "image/jpeg",
      width: size.width,
      height: size.height,
      byteLength: jpeg.byteLength,
      note,
      jpeg,
    },
    rawResult: raw,
  }
}

function artboardSet(ids: readonly NodeId[]): Set<string> {
  return new Set(ids as readonly string[])
}

function matchCase(
  claimed: SelectionCase,
  selection: SelectionRecord<SelectionSnapshot>,
  artboardIds: readonly NodeId[],
): Match {
  const body = selection.body
  const boards = artboardSet(artboardIds)

  if (body.kind === "empty") {
    if (claimed === "nothing-selected") {
      return { ok: true, kind: "empty", selection: selection as SelectionRecord<Extract<SelectionSnapshot, { kind: "empty" }>> }
    }
    return { ok: false, observed: "empty", observedCount: 0 }
  }

  if (body.kind === "one") {
    const inBoard = boards.has(body.nodeId as string)
    if (claimed === "one-artboard" && inBoard) {
      return { ok: true, kind: "one", selection: selection as SelectionRecord<Extract<SelectionSnapshot, { kind: "one" }>> }
    }
    if (claimed === "one-artboard" && !inBoard) {
      return { ok: false, observed: "one", observedCount: 1 }
    }
    return { ok: false, observed: "one", observedCount: 1 }
  }

  if (claimed === "several-selected") {
    return {
      ok: true,
      kind: "several",
      selection: selection as SelectionRecord<Extract<SelectionSnapshot, { kind: "several" }>>,
    }
  }
  return { ok: false, observed: "several", observedCount: body.count as number }
}

function chooseTarget(
  info: BasicInfo,
  selection: Extract<SelectionSnapshot, { kind: "empty" }>,
):
  | { readonly ok: true; readonly target: ScreenshotTarget; readonly reason: { readonly kind: "first-artboard" } }
  | { readonly ok: false }
function chooseTarget(
  info: BasicInfo,
  selection: Extract<SelectionSnapshot, { kind: "one" | "several" }>,
): { readonly ok: true; readonly target: ScreenshotTarget; readonly reason: { readonly kind: "first-selected-node" } }
function chooseTarget(
  info: BasicInfo,
  selection: SelectionSnapshot,
):
  | { readonly ok: true; readonly target: ScreenshotTarget; readonly reason: TargetReason }
  | { readonly ok: false } {
  if (selection.kind === "empty") {
    const first = info.artboardIds[0]
    if (first === undefined) {
      return { ok: false }
    }
    return {
      ok: true,
      target: { fileId: info.fileId, nodeId: first },
      reason: { kind: "first-artboard" },
    }
  }
  if (selection.kind === "one") {
    return {
      ok: true,
      target: { fileId: info.fileId, nodeId: selection.nodeId },
      reason: { kind: "first-selected-node" },
    }
  }
  return {
    ok: true,
    target: { fileId: info.fileId, nodeId: selection.firstNodeId },
    reason: { kind: "first-selected-node" },
  }
}

function assemble<K extends SelectionKind>(args: {
  readonly kind: K
  readonly catalog: ToolCatalog
  readonly basicInfo: InfoRecord
  readonly selection: SelectionRecord<Extract<SelectionSnapshot, { kind: K }>>
  readonly screenshot: ScreenshotRecord<ReasonFor<K>>
}): CaptureFor<K> {
  return {
    claimed: caseFor(args.kind),
    catalog: args.catalog,
    calls: {
      get_basic_info: args.basicInfo,
      get_selection: args.selection,
      get_screenshot: args.screenshot,
    },
  }
}

function jpegSize(bytes: Uint8Array): { readonly width: number; readonly height: number } | { readonly kind: "bad-image"; readonly message: string } {
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return { kind: "bad-image", message: "missing JPEG SOI" }
  }
  let offset = 2
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return { kind: "bad-image", message: "invalid JPEG marker" }
    }
    const marker = bytes[offset + 1]!
    offset += 2
    if (marker === 0xd9) {
      break
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      continue
    }
    if (offset + 1 >= bytes.length) {
      return { kind: "bad-image", message: "truncated JPEG segment" }
    }
    const segmentLength = (bytes[offset]! << 8) | bytes[offset + 1]!
    if (segmentLength < 2) {
      return { kind: "bad-image", message: "invalid JPEG segment length" }
    }
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (offset + 7 >= bytes.length) {
        return { kind: "bad-image", message: "truncated SOF segment" }
      }
      const height = (bytes[offset + 3]! << 8) | bytes[offset + 4]!
      const width = (bytes[offset + 5]! << 8) | bytes[offset + 6]!
      if (width <= 0 || height <= 0) {
        return { kind: "bad-image", message: "non-positive JPEG dimensions" }
      }
      return { width, height }
    }
    if (marker === 0xda) {
      return { kind: "bad-image", message: "JPEG missing SOF before scan" }
    }
    offset += segmentLength
  }
  return { kind: "bad-image", message: "JPEG missing SOF marker" }
}

function quoteCard(capture: Capture): QuoteCard {
  const shot = capture.calls.get_screenshot.body
  return {
    imageMimeType: "image/jpeg",
    width: shot.width,
    height: shot.height,
    byteLength: shot.byteLength,
    note: shot.note,
    fileId: shot.target.fileId as string,
    nodeId: shot.target.nodeId as string,
    targetReason: shot.reason.kind,
    selectionPayload: capture.calls.get_selection.payload,
  }
}

function quoteCardJson(capture: Capture): JsonObject {
  const card = quoteCard(capture)
  return {
    imageMimeType: card.imageMimeType,
    width: card.width,
    height: card.height,
    byteLength: card.byteLength,
    note: card.note,
    fileId: card.fileId,
    nodeId: card.nodeId,
    targetReason: card.targetReason,
    selectionPayload: card.selectionPayload,
  }
}

function renderDoc(capture: CaptureFor<"empty">): string {
  const card = quoteCard(capture)
  return `# Paper MCP

## Screenshot

Format is image/jpeg. Width is ${card.width} pixels. Height is ${card.height} pixels.
Decoded size is ${card.byteLength} bytes. The server note was "${card.note}".

Width and height are the JPEG frame header in
docs/paper-mcp-samples/nothing-selected/screenshot.jpg.
The tool JSON has neither field.

## Nothing selected

get_selection payload:

\`\`\`json
${stableJson(card.selectionPayload).trimEnd()}
\`\`\`

get_screenshot used file ${card.fileId} and node ${card.nodeId}. The node is the
first artboard returned by get_basic_info. The selection count was 0.

The full tool result, including the file prelude, is
docs/paper-mcp-samples/nothing-selected/get_selection.json.
`
}

function materialize(capture: CaptureFor<"empty">): SampleTree & { readonly claimed: "nothing-selected"; readonly doc: Uint8Array }
function materialize(
  capture: CaptureFor<"one"> | CaptureFor<"several">,
): SampleTree & { readonly doc: null }
function materialize(capture: Capture): SampleTree {
  const enc = new TextEncoder()
  const base: SampleFiles = {
    toolsList: enc.encode(stableJson(capture.catalog.rawResult)),
    basicInfo: enc.encode(stableJson(capture.calls.get_basic_info.rawResult)),
    selection: enc.encode(stableJson(capture.calls.get_selection.rawResult)),
    screenshot: enc.encode(stableJson(capture.calls.get_screenshot.rawResult)),
    jpeg: capture.calls.get_screenshot.body.jpeg,
    quote: enc.encode(stableJson(quoteCardJson(capture))),
  }
  if (capture.claimed === "nothing-selected") {
    const emptyCapture = capture as CaptureFor<"empty">
    return {
      ...base,
      claimed: "nothing-selected",
      doc: enc.encode(renderDoc(emptyCapture)),
    }
  }
  return { ...base, claimed: capture.claimed, doc: null }
}

function stableJson(value: JsonValue): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function renderStdout(result: ProbeResult): string {
  const lines: string[] = []
  const catalog = result.kind === "wrote" ? result.catalog : result.failure.catalog
  if (catalog !== null) {
    lines.push(...catalog.names)
    lines.push("")
  }

  if (result.kind === "wrote") {
    const shot = result.capture.calls.get_screenshot.body
    const sel = result.capture.calls.get_selection.body
    const selCount =
      sel.kind === "several" ? sel.count : sel.kind === "one" ? 1 : 0
    lines.push(`image/jpeg ${shot.width} ${shot.height} ${shot.byteLength}`)
    lines.push(`selection ${sel.kind} ${selCount}`)
    lines.push(`wrote docs/paper-mcp-samples/${result.capture.claimed}`)
    if (result.capture.claimed === "nothing-selected") {
      lines.push("wrote docs/paper-mcp.md")
    }
    return lines.join("\n")
  }

  const failure = result.failure
  if (failure.kind === "case-mismatch") {
    lines.push("rejected case-mismatch")
    lines.push(`claimed ${failure.claimed}`)
    lines.push(`observed ${failure.observed} ${failure.observedCount}`)
    lines.push("wrote nothing")
    return lines.join("\n")
  }
  if (failure.kind === "commit-incomplete") {
    lines.push("commit-incomplete")
    lines.push(`claimed ${failure.claimed}`)
    lines.push(`docs/paper-mcp-samples/${failure.claimed}`)
    lines.push(`docs/paper-mcp-samples/${failure.claimed}.previous`)
    return lines.join("\n")
  }
  lines.push(`rejected ${failure.kind}`)
  lines.push("wrote nothing")
  return lines.join("\n")
}

function failureStderr(result: ProbeResult): string | null {
  if (result.kind === "wrote") {
    return null
  }
  const failure = result.failure
  if (failure.kind === "case-mismatch") {
    return stableJson(failure.selectionPayload).trimEnd()
  }
  if (failure.kind === "commit-incomplete") {
    return failure.message
  }
  if ("message" in failure && typeof failure.message === "string") {
    return failure.message
  }
  return null
}

function exitCodeOf(result: ProbeResult): Exclude<ExitCode, 3> {
  if (result.kind === "wrote") {
    return 0
  }
  if (result.failure.kind === "case-mismatch") {
    return 1
  }
  return 2
}

function caseFor<K extends SelectionKind>(kind: K): CaseForKind[K] {
  if (kind === "empty") {
    return "nothing-selected"
  }
  if (kind === "one") {
    return "one-artboard"
  }
  return "several-selected"
}

const entry = process.argv[1]
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exit(code)
    },
    () => {
      process.exit(2)
    },
  )
}
