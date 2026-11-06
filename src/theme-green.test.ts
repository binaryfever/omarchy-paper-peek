import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, "../theme-green.js"), "utf8").replace(/^\.pragma library\s*/, "")
const sandbox: { greenIn?: (raw: string) => string } = {}
runInNewContext(source, sandbox)
const greenIn = sandbox.greenIn
if (!greenIn) {
  console.error("theme-green.js did not define greenIn")
  process.exit(1)
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`assert failed: ${message}`)
    process.exit(1)
  }
}

assert(greenIn('green = "#a3be8c"\n') === "#a3be8c", "a quoted theme green is kept")
assert(greenIn("green = '#40a02b'\n") === "#40a02b", "a single-quoted green is kept")
assert(greenIn("green = #a9b665\n") === "#a9b665", "a bare green is kept")
assert(greenIn('green = "#a3be8c" # nord\n') === "#a3be8c", "a trailing comment stays outside the color")
assert(greenIn('accent = "#81a1c1"\n') === "", "a file with no green line falls back")
assert(greenIn('green = "#abc"\n') === "", "a short green falls back")
assert(greenIn('green = "not-a-color"\n') === "", "a green that is not hex falls back")
assert(greenIn('greenish = "#a3be8c"\n') === "", "a different key is not the green role")
assert(greenIn("") === "", "an empty theme file falls back")

console.log("theme-green.test.ts: ok")
