import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"

export const FLOAT_INSET = 16
export const FLOAT_SNAP = 64
export const FLOAT_MIN_W = 180
export const FLOAT_MIN_H = 140
export const FLOAT_DEFAULT_W = 420
export const FLOAT_DEFAULT_H = 320

export type FloatBox = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly clickThrough: boolean
}

type Screen = {
  readonly width: number
  readonly height: number
}

export function defaultFloat(screen: Screen): FloatBox {
  const width = Math.min(FLOAT_DEFAULT_W, Math.max(FLOAT_MIN_W, screen.width - FLOAT_INSET * 2))
  const height = Math.min(FLOAT_DEFAULT_H, Math.max(FLOAT_MIN_H, screen.height - FLOAT_INSET * 2))
  return clampFloat(
    {
      x: screen.width - width - FLOAT_INSET,
      y: screen.height - height - FLOAT_INSET,
      width,
      height,
      clickThrough: false,
    },
    screen,
  )
}

export function clampFloat(box: FloatBox, screen: Screen): FloatBox {
  let width = Math.round(box.width)
  let height = Math.round(box.height)
  width = Math.max(FLOAT_MIN_W, width)
  height = Math.max(FLOAT_MIN_H, height)
  width = Math.min(width, Math.max(1, Math.round(screen.width)))
  height = Math.min(height, Math.max(1, Math.round(screen.height)))
  let x = Math.round(box.x)
  let y = Math.round(box.y)
  x = Math.max(0, Math.min(x, Math.round(screen.width) - width))
  y = Math.max(0, Math.min(y, Math.round(screen.height) - height))
  return { x, y, width, height, clickThrough: box.clickThrough }
}

export function snapFloat(box: FloatBox, screen: Screen): FloatBox {
  const fitted = clampFloat(box, screen)
  const corners = cornerHomes(fitted.width, fitted.height, screen)
  let best = -1
  let bestDist = FLOAT_SNAP
  for (let i = 0; i < corners.length; i++) {
    const home = corners[i]
    if (home === undefined) continue
    const dist = Math.hypot(fitted.x - home.x, fitted.y - home.y)
    if (dist <= bestDist) {
      best = i
      bestDist = dist
    }
  }
  const home = best >= 0 ? corners[best] : undefined
  if (home === undefined) return fitted
  return clampFloat({ ...fitted, x: home.x, y: home.y }, screen)
}

export function parseFloatState(text: string): FloatBox | null {
  if (text.trim() === "") return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null
  const x = parsed.x
  const y = parsed.y
  const width = parsed.width
  const height = parsed.height
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) {
    return null
  }
  if (width <= 0 || height <= 0) return null
  if ("clickThrough" in parsed && typeof parsed.clickThrough !== "boolean") return null
  return {
    x,
    y,
    width,
    height,
    clickThrough: parsed.clickThrough === true,
  }
}

export function floatStateText(box: FloatBox): string {
  return `${JSON.stringify(
    {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      clickThrough: box.clickThrough,
    },
    null,
    2,
  )}\n`
}

function cornerHomes(width: number, height: number, screen: Screen): readonly { x: number; y: number }[] {
  const right = screen.width - width - FLOAT_INSET
  const bottom = screen.height - height - FLOAT_INSET
  return [
    { x: FLOAT_INSET, y: FLOAT_INSET },
    { x: right, y: FLOAT_INSET },
    { x: FLOAT_INSET, y: bottom },
    { x: right, y: bottom },
  ]
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function screenArg(value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    process.stderr.write("bad-screen\n")
    process.exit(3)
  }
  return parsed
}

function boxArg(value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    process.stderr.write("bad-box\n")
    process.exit(3)
  }
  return parsed
}

function runCli(argv: readonly string[]): void {
  const [command, ...args] = argv
  if (command === "default") {
    const screen = { width: screenArg(args[0] ?? ""), height: screenArg(args[1] ?? "") }
    process.stdout.write(floatStateText(defaultFloat(screen)))
    return
  }
  if (command === "snap" || command === "clamp") {
    const screen = { width: screenArg(args[4] ?? ""), height: screenArg(args[5] ?? "") }
    const box: FloatBox = {
      x: boxArg(args[0] ?? ""),
      y: boxArg(args[1] ?? ""),
      width: boxArg(args[2] ?? ""),
      height: boxArg(args[3] ?? ""),
      clickThrough: args[6] === "1",
    }
    const next = command === "snap" ? snapFloat(box, screen) : clampFloat(box, screen)
    process.stdout.write(floatStateText(next))
    return
  }
  process.stderr.write("bad-args\n")
  process.exit(3)
}

const entry = process.argv[1]
if (entry !== undefined && realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url))) {
  runCli(process.argv.slice(2))
}
