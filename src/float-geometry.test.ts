import { clampFloat, defaultFloat, floatStateText, parseFloatState, snapFloat } from "./float-geometry.ts"

const screen = { width: 2400, height: 1350 }

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`assert failed: ${message}`)
    process.exit(1)
  }
}

const parked = defaultFloat(screen)
assert(parked.width === 420 && parked.height === 320, "a wide screen gets the default float size")
assert(parked.x === 2400 - 420 - 16 && parked.y === 1350 - 320 - 16, "the default sits in the bottom-right corner")
assert(parked.clickThrough === false, "clicks hit the float until asked to pass through")

const nearTopLeft = snapFloat({ x: 56, y: 56, width: 420, height: 320, clickThrough: false }, screen)
assert(nearTopLeft.x === 16 && nearTopLeft.y === 16, "a release near the top-left corner snaps there")

const mid = snapFloat({ x: 800, y: 500, width: 420, height: 320, clickThrough: true }, screen)
assert(mid.x === 800 && mid.y === 500, "a release in the middle of the screen stays put")
assert(mid.clickThrough === true, "snapping keeps the click-through flag")

const shoved = clampFloat({ x: -40, y: 9000, width: 20, height: 9000, clickThrough: false }, screen)
assert(shoved.width === 180 && shoved.height === 1350, "the float stays at least the minimum size and on the screen")
assert(shoved.x === 0 && shoved.y === 0, "a float shoved off the screen comes back to the edge")

const raw = floatStateText({ x: 12, y: 24, width: 200, height: 160, clickThrough: true })
const read = parseFloatState(raw)
assert(read !== null && read.x === 12 && read.y === 24 && read.width === 200 && read.height === 160, "the state file round-trips position and size")
assert(read !== null && read.clickThrough === true, "the state file round-trips click-through")
assert(parseFloatState("") === null, "an empty state file is missing, not a float at the origin")
assert(parseFloatState("{") === null, "a broken state file is ignored")
assert(parseFloatState('{"x":1,"y":2,"width":200,"height":160,"clickThrough":"yes"}') === null, "a non-boolean click-through flag is ignored")
const withoutClicks = parseFloatState('{"x":3,"y":4,"width":220,"height":180}')
assert(withoutClicks !== null && withoutClicks.clickThrough === false, "a state file without click-through catches clicks")

console.log("float-geometry.test.ts: ok")
