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
  artboardLabel: (slots: unknown, nodeId: string) => string
  zoomFrame: (
    boxW: number,
    boxH: number,
    imageW: number,
    imageH: number,
    chromeRef: Record<string, number>,
  ) => { x: number; y: number; width: number; height: number }
  headerActions: (view: string, holding: boolean, canZoom: boolean) => Array<{ id: string }>
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
assert(fourBoards[0]?.kind === "caption" && fourBoards[0]?.label === "Artboards \u00B7 4", "four boards caption")
assert(fourBoards.length === 5, "four boards plus caption")
assert(fourBoards[1]?.detail === "1 of 4", "first duplicate name carries its ordinal")
assert(fourBoards[4]?.detail === "4 of 4", "last duplicate name carries its ordinal")

const mixedNames = Layout.slotsFromBoards(
  [
    { id: "a", name: "01 Light \u00B7 Home" },
    { id: "b", name: "Solo" },
    { id: "c", name: "01 Light \u00B7 Home" },
  ],
  "file",
  "page",
)
assert(mixedNames[1]?.detail === "1 of 2", "repeat counts only its own name")
assert(mixedNames[2]?.detail === "", "a name used once gets no ordinal")
assert(mixedNames[3]?.detail === "2 of 2", "the second of a repeated name counts in page order")
const changedId = Layout.slotsFromBoards([{ id: "a", name: "01 Light · Home" }], "file", "page")
assert(!Layout.sameSlots(fourBoards, changedId), "sameSlots false when id set changes")
assert(Layout.sameSlots(fourBoards, fourBoards.map((slot) => ({ ...slot }))), "sameSlots true for deep copy")

const zeroBoards = Layout.slotsFromBoards([], "f", "p")
assert(zeroBoards[0]?.label === "Artboards \u00B7 0", "zero boards caption")
const oneBoard = Layout.slotsFromBoards([{ id: "x", name: "Solo" }], "f", "p")
assert(oneBoard[0]?.label === "Artboards \u00B7 1", "one board caption")
assert(oneBoard[1]?.detail === "", "a lone artboard gets no ordinal")
assert(defaultChrome.titleGap > 0, "header title and trail are kept apart")
assert(
  defaultChrome.captionLead > defaultChrome.rowHeight / 2,
  "a section label takes real air above it, so it breaks from the rule over it",
)
assert(
  defaultChrome.captionHeight === defaultTokens.captionHeight + defaultChrome.captionLead,
  "the caption slot carries its lead and nothing under it",
)
assert(defaultChrome.framePadY === defaultChrome.gutter, "a box pads evenly on all four sides")

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
const shotCap = Math.round(480 * defaultChrome.shotAspect) + defaultChrome.gutter * 2
assert(tallFrame.shot !== null && tallFrame.shot.height === shotCap, "tall shot stops at its cap")
assert(tallFrame.list.height > listHeightAtFour, "the room past the cap goes to the rows")
assert(tallFrame.list.height === 800 - defaultChrome.rule - tallFrame.shot.height, "tall list takes the remainder")
assert(tallFrame.list.y === tallFrame.shot.height + defaultChrome.rule, "tall list sits under the rule")

const tallerFrame = Layout.contentFrame("shot", 480, 1268, 393, 852, defaultChrome)
assert(tallerFrame.shot !== null && tallerFrame.shot.height === shotCap, "a taller screen does not grow the shot")
assert(
  tallerFrame.shot !== null && tallerFrame.shot.image.width < 480,
  "a portrait artboard no longer fills the drawer width",
)
assert(tallerFrame.list.height > tallFrame.list.height, "a taller screen grows the rows instead")

const wideDrawer = Layout.contentFrame("shot", 960, 2000, 393, 852, defaultChrome)
assert(
  wideDrawer.shot !== null &&
    wideDrawer.shot.height ===
      Math.round(960 * defaultChrome.shotAspect) + defaultChrome.gutter * 2,
  "the cap follows the drawer width",
)

if (tallFrame.shot) {
  const img = tallFrame.shot.image
  assert(img.x >= 0 && img.y >= 0, "image inside shot box")
  assert(img.x + img.width <= 480 + 0.001, "image inside width")
  assert(img.y + img.height <= tallFrame.shot.height + 0.001, "image inside height")
  const pad = defaultChrome.gutter
  assert(img.x >= pad && img.y >= pad, "image keeps its margin at the near edges")
  assert(
    img.x + img.width <= 480 - pad && img.y + img.height <= tallFrame.shot.height - pad,
    "image keeps its margin at the far edges",
  )
  const fillsAnAxis =
    img.width >= 480 - pad * 2 - 1 || img.height >= tallFrame.shot.height - pad * 2 - 1
  assert(fillsAnAxis, "image fills one axis of the box inside those margins")
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

const wideShot = Layout.contentFrame("shot", 480, 1268, 1920, 1080, defaultChrome)
assert(
  wideShot.shot !== null && wideShot.shot.image.x >= defaultChrome.gutter,
  "a landscape artboard keeps a margin at the near edge",
)
assert(
  wideShot.shot !== null &&
    wideShot.shot.image.x + wideShot.shot.image.width <= 480 - defaultChrome.gutter,
  "a landscape artboard keeps a margin at the far edge",
)
// The cap is a ceiling. A landscape artboard is shorter than a portrait one,
// so its pane stops at the artboard instead of holding it in a void.
assert(
  wideShot.shot !== null &&
    wideShot.shot.height === wideShot.shot.image.height + defaultChrome.gutter * 2,
  "a landscape pane stops at its artboard",
)
assert(
  wideShot.shot !== null && wideShot.shot.height < Math.round(480 * defaultChrome.shotAspect),
  "a landscape pane comes in under the cap",
)
assert(
  wideShot.shot !== null && wideShot.shot.image.y === defaultChrome.gutter,
  "a fitted pane keeps its top margin and no more",
)
assert(
  wideShot.list.height === 1268 - defaultChrome.rule - wideShot.shot.height,
  "the room the pane gives up goes to the rows",
)

// A very wide artboard is the case that showed the problem: 1440 by 250 drew
// 73 pixels of artboard inside a 600 pixel pane.
const squatShot = Layout.contentFrame("shot", 480, 1350, 1440, 250, defaultChrome)
assert(squatShot.shot !== null && squatShot.shot.height < 120, "a squat artboard gets a squat pane")
assert(
  squatShot.list.height > 1100,
  "a squat artboard hands more than 1100 pixels to the rows",
)

// An unmeasured artboard has no shape to fit, so the pane stays at its cap
// until the image reports one.
const unknownShot = Layout.contentFrame("shot", 480, 1350, 0, 0, defaultChrome)
assert(
  unknownShot.shot !== null &&
    unknownShot.shot.height === Math.round(480 * defaultChrome.shotAspect) + defaultChrome.gutter * 2,
  "an unmeasured artboard holds the cap",
)
assert(
  tallerFrame.shot !== null &&
    tallerFrame.shot.image.height === tallerFrame.shot.height - defaultChrome.gutter * 2,
  "a portrait artboard fills the box inside the margins, not the pane",
)
assert(
  tallerFrame.shot !== null &&
    tallerFrame.shot.image.height === Math.round(480 * defaultChrome.shotAspect),
  "a portrait artboard keeps the size the canvas drew, margins on top of it",
)

const shortFrame = Layout.contentFrame("shot", 480, 100, 393, 852, defaultChrome)
assert(
  shortFrame.list.height === defaultChrome.captionHeight + defaultChrome.rowHeight * 2,
  "short content uses two-row well",
)
assert(shortFrame.rule === 1, "short content keeps rule")
assert(
  shortFrame.shot !== null && shortFrame.shot.height > 0,
  "short content still shows some artboard",
)
assert(
  shortFrame.shot !== null &&
    shortFrame.shot.height === 100 - defaultChrome.rule - shortFrame.list.height,
  "short content spends every pixel it has",
)

const tinyFrame = Layout.contentFrame("shot", 480, 40, 393, 852, defaultChrome)
assert(tinyFrame.shot === null && tinyFrame.rule === 0 && tinyFrame.list.height === 40, "tiny content drops shot")

const browserFrame = Layout.contentFrame("pages", 480, 600, 0, 0, defaultChrome)
assert(browserFrame.shot === null && browserFrame.list.id === "browser" && browserFrame.list.height === 600, "browser fills content")

// This monitor is 3840 by 2160 at scale 1.6, so the big view's box is 2400 by
// 1350 logical pixels.
const screenW = 2400
const screenH = 1350
const zoomMargin = defaultChrome.zoomMargin
const paneW = screenW - zoomMargin * 2
const paneH = screenH - zoomMargin * 2

const tallZoom = Layout.zoomFrame(screenW, screenH, 393, 852, defaultChrome)
assert(tallZoom.height === paneH, "a portrait artboard fits the big view by its height")
assert(tallZoom.width === Math.round(393 * (paneH / 852)), "portrait zoom keeps its aspect")
assert(tallZoom.y === zoomMargin, "portrait zoom keeps its top margin")
assert(
  tallZoom.x === zoomMargin + Math.round((paneW - tallZoom.width) / 2),
  "portrait zoom centers across the screen",
)
assert(
  tallZoom.x >= zoomMargin && tallZoom.x + tallZoom.width <= screenW - zoomMargin,
  "portrait zoom stays inside its margin",
)
assert(
  tallZoom.y >= zoomMargin && tallZoom.y + tallZoom.height <= screenH - zoomMargin,
  "portrait zoom stays under its margin",
)

const drawerShot = Layout.contentFrame("shot", 480, screenH, 393, 852, defaultChrome)
assert(drawerShot.shot !== null, "the drawer still draws a shot on this screen")
assert(
  drawerShot.shot !== null && tallZoom.height >= drawerShot.shot.image.height * 2,
  "the big view doubles the drawer's artboard",
)

// 1440 by 600 is wider than the pane, so it fits by its width.
const wideZoom = Layout.zoomFrame(screenW, screenH, 1440, 600, defaultChrome)
assert(wideZoom.width === paneW, "a wide artboard fits the big view by its width")
assert(wideZoom.height === Math.round(600 * (paneW / 1440)), "wide zoom keeps its aspect")
assert(wideZoom.x === zoomMargin, "wide zoom keeps its side margin")
assert(
  wideZoom.y === zoomMargin + Math.round((paneH - wideZoom.height) / 2),
  "wide zoom centers down the screen",
)

// 16 by 9 is narrower than this pane, so it fits by its height instead, and
// still keeps a margin either side.
const sixteenNine = Layout.zoomFrame(screenW, screenH, 1920, 1080, defaultChrome)
assert(sixteenNine.height === paneH, "a 16 by 9 artboard fits this pane by its height")
assert(
  sixteenNine.x >= zoomMargin && sixteenNine.x + sixteenNine.width <= screenW - zoomMargin,
  "a 16 by 9 artboard keeps its side margin",
)

const unmeasuredZoom = Layout.zoomFrame(screenW, screenH, 0, 0, defaultChrome)
assert(
  unmeasuredZoom.x === zoomMargin &&
    unmeasuredZoom.y === zoomMargin &&
    unmeasuredZoom.width === paneW &&
    unmeasuredZoom.height === paneH,
  "an unmeasured artboard takes the whole pane",
)

const tinyZoom = Layout.zoomFrame(40, 30, 393, 852, defaultChrome)
assert(tinyZoom.y === 0 && tinyZoom.height === 30, "a box too small for the margin drops it")
assert(
  tinyZoom.x >= 0 && tinyZoom.x + tinyZoom.width <= 40,
  "a dropped margin still keeps the artboard inside the box",
)

const emptyZoom = Layout.zoomFrame(0, 0, 393, 852, defaultChrome)
assert(emptyZoom.width === 0 && emptyZoom.height === 0, "an empty box draws nothing")

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

const shotActions = Layout.headerActions("shot", true, false)
assert(
  shotActions.map((a) => a.id).join(",") === "back,browse",
  "shot with hold and no cached artboard gets back and browse",
)
assert(
  Layout.headerActions("shot", true, true).map((a) => a.id).join(",") === "back,zoom,browse",
  "a cached shot gets a zoom action",
)
assert(
  Layout.headerActions("shot", false, true).map((a) => a.id).join(",") === "zoom,browse",
  "zoom needs no hold",
)
assert(
  Layout.headerActions("projects", false, true).map((a) => a.id).join(",") === "refresh",
  "projects actions take no zoom",
)
assert(Layout.headerActions("pages", false, true).map((a) => a.id).join(",") === "back,refresh", "pages actions")
const everyAction = ["shot", "pages", "projects"].flatMap((view) =>
  [true, false].flatMap((hold) =>
    [true, false].flatMap((zoom) => Layout.headerActions(view, hold, zoom).map((a) => a.id)),
  ),
)
assert(!everyAction.includes("float"), "no view offers a float action")

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
