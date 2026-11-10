import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import vm from "node:vm"

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`assert failed: ${message}`)
    process.exit(1)
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const sourcePath = join(here, "drawer-layout.js")
const raw = readFileSync(sourcePath, "utf8")
const body = raw.replace(/^\s*\.pragma library\s*\n?/, "")
const context: Record<string, unknown> = {}
vm.createContext(context)
vm.runInContext(body, context)

type LayoutApi = {
  chrome: (tokens: Record<string, number>) => Record<string, number>
  columns: (cardWidth: number, chromeRef: Record<string, number>, trailingWidth: number) => {
    textX: number
    textWidth: number
    titleWidth: number
    recentLeft: { x: number; width: number }
    recentRight: { x: number; width: number }
  }
  slotsFromBrowserJson: (rows: unknown) => Array<Record<string, string>>
  slotsFromBoards: (boards: unknown, fileId: string, pageId: string) => Array<Record<string, string>>
  sameSlots: (a: unknown, b: unknown) => boolean
  classify: (slot: Record<string, string>) => { presentation: string; selectable: boolean }
  slotHeight: (slot: Record<string, string>, chromeRef: Record<string, number>) => number
  placeCursor: (slots: unknown) => number
  moveCursor: (slots: unknown, cursor: number, delta: number) => number
  scrollBy: (
    contentY: number,
    delta: number,
    chromeRef: Record<string, number>,
    contentHeight: number,
    viewHeight: number,
  ) => number
  activation: (slot: Record<string, string>, browseProject: string) => Record<string, string>
  rowSurface: (
    view: string,
    slot: Record<string, string>,
    index: number,
    cursor: number,
    nodeId: string,
    shotHere: boolean,
  ) => { hasCursor: boolean; current: boolean }
  contentFrame: (
    view: string,
    contentWidth: number,
    contentHeight: number,
    imageWidth: number,
    imageHeight: number,
    chromeRef: Record<string, number>,
  ) => {
    shot: { scroll: string; height: number; image: { x: number; y: number; width: number; height: number } } | null
    rule: number
    list: { id: string; scroll: string; y: number; height: number }
  }
  drawerHeader: (input: Record<string, string | boolean>) => { title: string; trail: string }
  floatTitle: (catalogArtboard: string, memoryArtboard: string) => string
  artboardLabel: (slots: unknown, nodeId: string) => string
  headerActions: (view: string, holding: boolean) => Array<{ id: string }>
  statusDot: (status: string) => string
  statusWord: (status: string) => string
  showEmpty: (view: string, slots: unknown, pending: string, notice: string) => boolean
}

const Layout = context as unknown as LayoutApi

const defaultTokens = {
  rowPaddingX: 12,
  body: 12,
  lg: 8,
  sm: 4,
  controlHeight: 28,
  hairline: 1,
  captionHeight: 16,
  popupRowHeight: 28,
}

const defaultChrome = Layout.chrome(defaultTokens)
assert(defaultChrome.gutter === 12, "default gutter")
assert(defaultChrome.rowHeight === 28, "default row height from popupRowHeight")
assert(defaultChrome.footerHeight === 28, "default footer height matches row height")
assert(defaultChrome.columnGap === 8, "default column gap")
assert(defaultChrome.dot === 8, "default dot")
assert(defaultChrome.boardRows === 4, "default board rows")
assert(defaultChrome.floorRows === 1, "default floor rows")
assert(defaultChrome.secondaryDarken === 1.4, "default secondary darken")
assert(defaultChrome.emptyDarken === 1.5, "default empty darken")

const largeTokens = {
  rowPaddingX: 16,
  body: 16,
  lg: 11,
  sm: 5,
  controlHeight: 37,
  hairline: 1,
  captionHeight: 20,
  popupRowHeight: 38,
}
const largeChrome = Layout.chrome(largeTokens)
assert(largeChrome.gutter === 16, "large gutter")
assert(largeChrome.rowHeight === 38, "large row height from popupRowHeight")
assert(Layout.columns(480, largeChrome, 0).textX === 16, "large text origin")
assert(Layout.columns(480, largeChrome, 120).titleWidth > 220, "large title width fits long artboard name")

const tokenOverride = {
  rowPaddingX: 12,
  body: 12,
  lg: 8,
  sm: 4,
  controlHeight: 28,
  hairline: 1,
  captionHeight: 16,
  popupRowHeight: 31,
}
const overrideChrome = Layout.chrome(tokenOverride)
assert(overrideChrome.rowHeight === 31, "popupRowHeight is used even when it differs from body + lg * 2")
assert(overrideChrome.rowHeight !== tokenOverride.body + tokenOverride.lg * 2, "override differs from body formula")

const cols = Layout.columns(480, defaultChrome, 0)
assert(cols.textX === defaultChrome.gutter, "text origin equals gutter")
assert(cols.recentLeft.x === cols.textX, "recent left aligns to text origin")
assert(
  cols.recentLeft.width + defaultChrome.columnGap + cols.recentRight.width === cols.textWidth,
  "recent columns span text width",
)
assert(
  cols.recentRight.x >= cols.recentLeft.x + cols.recentLeft.width,
  "recent columns do not overlap",
)

const wireSlots = Layout.slotsFromBrowserJson([
  { kind: "header", label: "Recent" },
  { kind: "recent", label: "01 Light · Home", detail: "Site", fileId: "f", pageId: "p", nodeId: "n" },
  { kind: "project", label: "Client", fileId: "c" },
  { kind: "nope" },
])
assert(wireSlots.length === 3, "unknown wire kind dropped")
assert(wireSlots[0]?.kind === "caption" && wireSlots[0]?.label === "Recent", "header becomes caption")
assert(wireSlots[1]?.kind === "recent" && wireSlots[1]?.label === "01 Light · Home", "recent label kept whole")
assert(wireSlots[1]?.detail === "Site", "recent detail kept separate")
assert(wireSlots[1]?.label !== "01 Light · Home · Site", "recent label is not label plus detail joined")

const fourBoards = Layout.slotsFromBoards(
  [
    { id: "a", name: "01 Light · Home" },
    { id: "b", name: "01 Light · Home" },
    { id: "c", name: "01 Light · Home" },
    { id: "d", name: "01 Light · Home" },
  ],
  "file",
  "page",
)
assert(fourBoards[0]?.kind === "caption" && fourBoards[0]?.label === "4 artboards", "four boards caption")
assert(fourBoards.length === 5, "four boards plus caption")
const changedId = Layout.slotsFromBoards([{ id: "a", name: "01 Light · Home" }], "file", "page")
assert(!Layout.sameSlots(fourBoards, changedId), "sameSlots false when id set changes")
assert(Layout.sameSlots(fourBoards, fourBoards.map((slot) => ({ ...slot }))), "sameSlots true for deep copy")

const zeroBoards = Layout.slotsFromBoards([], "f", "p")
assert(zeroBoards[0]?.label === "0 artboards", "zero boards caption")
const oneBoard = Layout.slotsFromBoards([{ id: "x", name: "Solo" }], "f", "p")
assert(oneBoard[0]?.label === "1 artboard", "one board caption")

const leadCaption = Layout.slotsFromBrowserJson([{ kind: "header", label: "Projects" }, { kind: "project", label: "A", fileId: "1" }])
assert(Layout.placeCursor(leadCaption) === 1, "placeCursor skips leading caption")
assert(Layout.placeCursor([]) === -1, "placeCursor of empty is -1")
assert(Layout.moveCursor(leadCaption, -1, 1) === 1, "moveCursor from -1 down lands on first selectable")

const mixedSlots = Layout.slotsFromBrowserJson([
  { kind: "header", label: "H" },
  { kind: "project", label: "P1", fileId: "1" },
  { kind: "project", label: "P2", fileId: "2" },
])
assert(Layout.moveCursor(mixedSlots, 1, -1) === 2, "moveCursor wraps forward among selectables")
assert(Layout.moveCursor(mixedSlots, 2, 1) === 1, "moveCursor wraps backward among selectables")

const captionSlot = { kind: "caption", label: "H", detail: "", fileId: "", pageId: "", nodeId: "" }
const artboardSlot = { kind: "artboard", label: "A", detail: "", fileId: "f", pageId: "p", nodeId: "n" }
const listHeightAtFour =
  Layout.slotHeight(captionSlot, defaultChrome) + 4 * Layout.slotHeight(artboardSlot, defaultChrome)

const tallFrame = Layout.contentFrame("shot", 480, 800, 393, 852, defaultChrome)
assert(tallFrame.shot !== null && tallFrame.shot.scroll === "none", "tall shot does not scroll")
assert(tallFrame.list.scroll === "self" && tallFrame.list.id === "boards", "tall list scrolls")
assert(tallFrame.list.height === listHeightAtFour, "tall list is caption plus four rows")
assert(tallFrame.shot !== null && tallFrame.shot.height === 800 - defaultChrome.rule - tallFrame.list.height, "tall shot takes remainder")

if (tallFrame.shot) {
  const img = tallFrame.shot.image
  assert(img.x >= 0 && img.y >= 0, "image inside shot box")
  assert(img.x + img.width <= 480 + 0.001, "image inside width")
  assert(img.y + img.height <= tallFrame.shot.height + 0.001, "image inside height")
  const touchesEdge =
    img.x <= 1 ||
    img.y <= 1 ||
    img.x + img.width >= 480 - 1 ||
    img.y + img.height >= tallFrame.shot.height - 1
  assert(touchesEdge, "image touches a shot box edge")
  const again = Layout.contentFrame("shot", 480, 800, img.width, img.height, defaultChrome)
  assert(
    again.shot !== null &&
      again.shot.image.x === img.x &&
      again.shot.image.y === img.y &&
      again.shot.image.width === img.width &&
      again.shot.image.height === img.height,
    "containFit is idempotent on fitted size",
  )
}

const shortFrame = Layout.contentFrame("shot", 480, 100, 393, 852, defaultChrome)
assert(shortFrame.list.height === 72, "short content uses two-row well")
assert(shortFrame.rule === 1, "short content keeps rule")
assert(shortFrame.shot !== null && shortFrame.shot.height === 27, "short shot height")

const tinyFrame = Layout.contentFrame("shot", 480, 40, 393, 852, defaultChrome)
assert(tinyFrame.shot === null && tinyFrame.rule === 0 && tinyFrame.list.height === 40, "tiny content drops shot")

const browserFrame = Layout.contentFrame("pages", 480, 600, 0, 0, defaultChrome)
assert(browserFrame.shot === null && browserFrame.list.id === "browser" && browserFrame.list.height === 600, "browser fills content")

const shotHeader = Layout.drawerHeader({
  view: "shot",
  shotHere: true,
  holding: false,
  projectName: "Site",
  projectId: "",
  pageName: "Home",
  pageId: "",
  browseProject: "",
  browseFileId: "",
  catalogArtboard: "01 Light · Home",
  memoryArtboard: "",
  holdProject: "",
  holdPage: "",
})
assert(shotHeader.title === "01 Light · Home" && shotHeader.trail === "Site › Home", "shot header title and trail")
assert(Layout.floatTitle("01 Light · Home", "") === "01 Light · Home", "float title is artboard alone")

const pageHold = Layout.drawerHeader({
  view: "shot",
  shotHere: false,
  holding: true,
  projectName: "",
  projectId: "",
  pageName: "",
  pageId: "",
  browseProject: "",
  browseFileId: "",
  catalogArtboard: "Old name",
  memoryArtboard: "Old name",
  holdProject: "Site",
  holdPage: "Home",
})
assert(pageHold.title === "Home" && pageHold.title !== "Old name", "page hold shows page name not prior artboard")

const shotActions = Layout.headerActions("shot", true)
assert(
  shotActions.map((a) => a.id).join(",") === "back,float,browse",
  "shot with hold gets back float browse",
)
assert(Layout.headerActions("projects", false).map((a) => a.id).join(",") === "float,refresh", "projects actions")

assert(Layout.statusDot("live") === "accent", "live dot")
assert(Layout.statusDot("not-live") === "urgent", "not-live dot")
assert(Layout.statusDot("off") === "muted", "off dot")
assert(Layout.statusWord("live") === "Live", "live word")
assert(Layout.statusWord("not-live") === "Not live", "not-live word")
assert(Layout.statusWord("off") === "Off", "off word")
assert(Layout.showEmpty("projects", [], "", "") === true, "empty projects")
assert(Layout.showEmpty("shot", [], "", "") === false, "shot never empty via slots")
assert(Layout.showEmpty("projects", [], "x", "") === false, "pending blocks empty")
assert(Layout.showEmpty("projects", [], "", "n") === false, "notice blocks empty")

const projectSlot = { kind: "project", label: "Site", detail: "", fileId: "f1", pageId: "", nodeId: "" }
const pageSlot = { kind: "page", label: "Home", detail: "", fileId: "f1", pageId: "p1", nodeId: "" }
const recentSlot = { kind: "recent", label: "R", detail: "D", fileId: "f1", pageId: "p1", nodeId: "n1" }

assert(Layout.activation(projectSlot, "Browse").type === "pages", "project activation")
assert(Layout.activation(pageSlot, "Site").type === "page", "page activation")
assert(Layout.activation(recentSlot, "").type === "remember", "recent activation")
assert(Layout.activation(artboardSlot, "").type === "remember", "artboard activation")
assert(Layout.activation(captionSlot, "").type === "none", "caption activation")

assert(
  Layout.rowSurface("shot", artboardSlot, 2, -1, "n", true).current === true,
  "shot marks current artboard by node id",
)
assert(Layout.rowSurface("shot", artboardSlot, 2, -1, "other", true).current === false, "shot current needs match")
assert(
  Layout.rowSurface("pages", projectSlot, 1, 1, "", false).hasCursor === true,
  "browser marks cursor index",
)
assert(Layout.rowSurface("pages", captionSlot, 0, 0, "", false).hasCursor === false, "caption has no cursor")

let scrollY = 0
scrollY = Layout.scrollBy(scrollY, 1, defaultChrome, 400, 100)
scrollY = Layout.scrollBy(scrollY, 100, defaultChrome, 400, 100)
const limit = 400 - 100
assert(scrollY === limit, "scrollBy clamps at bottom")
assert(Layout.scrollBy(scrollY, 1, defaultChrome, 400, 100) === limit, "scrollBy stays at bottom")

const kinds = ["caption", "recent", "project", "page", "artboard"] as const
for (const kind of kinds) {
  const slot = { kind, label: "x", detail: "", fileId: "", pageId: "", nodeId: kind === "artboard" ? "n" : "" }
  const face = Layout.classify(slot)
  assert(face.selectable === (face.presentation !== "caption"), "selectable matches presentation for " + kind)
}

const anyShot = Layout.contentFrame("shot", 480, 800, 393, 852, defaultChrome)
if (anyShot.shot !== null) {
  assert(anyShot.shot.height > 0, "non-null shot has positive height")
  assert(anyShot.list.height >= defaultChrome.captionHeight + defaultChrome.rowHeight, "list fits caption plus one row")
}

function functionBody(source: string, name: string): string {
  const marker = `function ${name}(`
  const start = source.indexOf(marker)
  assert(start >= 0, name + " exists")
  const open = source.indexOf("{", start)
  assert(open >= 0, name + " opens")
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth += 1
    else if (source[i] === "}") {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  assert(false, name + " closes")
  return ""
}

function countNeedle(source: string, needle: string): number {
  let count = 0
  let from = 0
  while (from < source.length) {
    const at = source.indexOf(needle, from)
    if (at < 0) return count
    count += 1
    from = at + needle.length
  }
  return count
}

const repoRoot = join(here, "..")
const drawerSource = readFileSync(join(repoRoot, "Drawer.qml"), "utf8")
const barSource = readFileSync(join(repoRoot, "BarWidget.qml"), "utf8")

assert(!barSource.includes("drawer-layout"), "BarWidget does not contain drawer-layout")
assert(countNeedle(drawerSource, "ListView {") === 1, "Drawer contains one ListView")
assert(!drawerSource.includes("Flickable {"), "Drawer contains no Flickable")

const banned = [
  "popupPadding",
  "rowLabel",
  "pairY",
  "stageHeight",
  "headerText",
  "contextLine",
  "subjectLine",
  "property var rows",
  "property var boards",
  "leftMargin",
  "slot.kind",
]
for (const word of banned) {
  assert(!drawerSource.includes(word), "Drawer does not contain " + word)
}

const tokensBody = functionBody(drawerSource, "styleTokens")
assert(
  tokensBody.includes("popupRowHeight: Style.spacing.popupRowHeight"),
  "styleTokens passes popupRowHeight",
)
assert(countNeedle(tokensBody, "Style.spacing") > 0, "styleTokens reads Style.spacing")
assert(
  !drawerSource.replace(tokensBody, "").includes("Style.spacing"),
  "Style.spacing appears only inside styleTokens",
)

const dotBody = functionBody(drawerSource, "dotColor")
assert(dotBody.includes("Commons.Color.muted"), "dotColor reads muted")
assert(
  !drawerSource.replace(dotBody, "").includes("Commons.Color.muted"),
  "Commons.Color.muted appears only inside dotColor",
)

const darkerLines = drawerSource.split("\n").filter((line) => line.includes("Qt.darker"))
assert(darkerLines.length === 2, "Qt.darker appears twice")
assert(
  darkerLines.some((line) => line.includes("inkSecondary")),
  "Qt.darker on inkSecondary",
)
assert(darkerLines.some((line) => line.includes("inkEmpty")), "Qt.darker on inkEmpty")
assert(
  darkerLines.every((line) => line.includes("inkSecondary") || line.includes("inkEmpty")),
  "Qt.darker only on inkSecondary and inkEmpty",
)

console.log("drawer-layout.test.ts: ok")
