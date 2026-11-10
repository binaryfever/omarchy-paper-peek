.pragma library

var ACTION_ICON = {
  back: "\u{F0141}",
  browse: "\u{F14F7}",
  refresh: "\u{F0450}",
  zoom: "\u{F0293}",
}

function chrome(tokens) {
  var rowHeight = tokens.popupRowHeight
  var rule = tokens.hairline < 1 ? 1 : tokens.hairline
  return {
    gutter: tokens.rowPaddingX,
    rowHeight: rowHeight,
    captionHeight: tokens.captionHeight,
    controlHeight: tokens.controlHeight,
    rule: rule,
    footerHeight: rowHeight,
    columnGap: tokens.lg,
    titleGap: tokens.sm,
    dot: tokens.sm * 2,
    // The layout canvas draws the artboard 480 wide by 580 tall. Tying the cap
    // to the drawer's own width keeps a 393 by 852 artboard at the size it was
    // drawn at on any screen, instead of growing with the screen's height.
    // The cap measures the image's box. The pane adds a margin around it.
    shotAspect: 1.2,
    // The big view's margin off the screen's edges. Twice the row gutter, so a
    // theme that widens the gutter widens this too.
    zoomMargin: tokens.rowPaddingX * 2,
    boardRows: 4,
    floorRows: 1,
    secondaryDarken: 1.4,
    emptyDarken: 1.5,
  }
}

function columns(cardWidth, chromeRef, trailingWidth) {
  var textX = chromeRef.gutter
  var textWidth = Math.max(0, cardWidth - chromeRef.gutter * 2)
  var titleWidth = Math.max(
    0,
    textWidth - trailingWidth - (trailingWidth > 0 ? chromeRef.columnGap : 0),
  )
  var gap = chromeRef.columnGap
  var half = Math.floor((textWidth - gap) / 2)
  if (textWidth < gap) {
    half = 0
    gap = 0
  }
  return {
    textX: textX,
    textWidth: textWidth,
    titleWidth: titleWidth,
    recentLeft: { x: textX, width: half },
    recentRight: { x: textX + half + gap, width: Math.max(0, textWidth - half - gap) },
  }
}

function wireKind(row) {
  if (!row || typeof row !== "object") {
    return null
  }
  var kind = row.kind
  if (typeof kind !== "string") {
    return null
  }
  var label = typeof row.label === "string" ? row.label : ""
  if (kind === "header") {
    return {
      kind: "caption",
      label: label,
      detail: "",
      fileId: "",
      pageId: "",
      nodeId: "",
    }
  }
  if (kind === "recent") {
    return {
      kind: "recent",
      label: label,
      detail: typeof row.detail === "string" ? row.detail : "",
      fileId: typeof row.fileId === "string" ? row.fileId : "",
      pageId: typeof row.pageId === "string" ? row.pageId : "",
      nodeId: typeof row.nodeId === "string" ? row.nodeId : "",
    }
  }
  if (kind === "project") {
    return {
      kind: "project",
      label: label,
      detail: "",
      fileId: typeof row.fileId === "string" ? row.fileId : "",
      pageId: "",
      nodeId: "",
    }
  }
  if (kind === "page") {
    return {
      kind: "page",
      label: label,
      detail: "",
      fileId: typeof row.fileId === "string" ? row.fileId : "",
      pageId: typeof row.pageId === "string" ? row.pageId : "",
      nodeId: "",
    }
  }
  if (kind === "artboard") {
    return {
      kind: "artboard",
      label: label,
      detail: "",
      fileId: typeof row.fileId === "string" ? row.fileId : "",
      pageId: typeof row.pageId === "string" ? row.pageId : "",
      nodeId: typeof row.nodeId === "string" ? row.nodeId : "",
    }
  }
  return null
}

function slotsFromBrowserJson(rows) {
  if (!Array.isArray(rows)) {
    return []
  }
  var out = []
  var i
  for (i = 0; i < rows.length; i++) {
    var slot = wireKind(rows[i])
    if (slot !== null) {
      out.push(slot)
    }
  }
  return out
}

function slotsFromBoards(boards, fileId, pageId) {
  var kept = []
  var i
  if (Array.isArray(boards)) {
    for (i = 0; i < boards.length; i++) {
      var entry = boards[i]
      if (entry && typeof entry === "object" && typeof entry.id === "string" && typeof entry.name === "string") {
        kept.push(entry)
      }
    }
  }
  var out = [
    {
      kind: "caption",
      label: "Artboards \u00B7 " + kept.length,
      detail: "",
      fileId: "",
      pageId: "",
      nodeId: "",
    },
  ]
  // A page can hold several artboards under one name. Paper tells them apart
  // by node id, which never reaches the row, so the row carries its ordinal.
  var total = {}
  for (i = 0; i < kept.length; i++) {
    var countKey = "n:" + kept[i].name
    total[countKey] = (total[countKey] || 0) + 1
  }
  var seen = {}
  for (i = 0; i < kept.length; i++) {
    var key = "n:" + kept[i].name
    var detail = ""
    if (total[key] > 1) {
      seen[key] = (seen[key] || 0) + 1
      detail = seen[key] + " of " + total[key]
    }
    out.push({
      kind: "artboard",
      label: kept[i].name,
      detail: detail,
      fileId: fileId,
      pageId: pageId,
      nodeId: kept[i].id,
    })
  }
  return out
}

function slotSame(a, b) {
  return (
    a.kind === b.kind &&
    a.label === b.label &&
    a.detail === b.detail &&
    a.fileId === b.fileId &&
    a.pageId === b.pageId &&
    a.nodeId === b.nodeId
  )
}

function sameSlots(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return false
  }
  if (a.length !== b.length) {
    return false
  }
  var i
  for (i = 0; i < a.length; i++) {
    if (!slotSame(a[i], b[i])) {
      return false
    }
  }
  return true
}

function classify(slot) {
  if (!slot || typeof slot !== "object") {
    return { presentation: "caption", selectable: false }
  }
  var kind = slot.kind
  if (kind === "caption") {
    return { presentation: "caption", selectable: false }
  }
  if (kind === "recent") {
    return { presentation: "recent", selectable: true }
  }
  if (kind === "project" || kind === "page" || kind === "artboard") {
    return { presentation: "single", selectable: true }
  }
  return { presentation: "caption", selectable: false }
}

function slotHeight(slot, chromeRef) {
  return classify(slot).presentation === "caption" ? chromeRef.captionHeight : chromeRef.rowHeight
}

function placeCursor(slots) {
  if (!Array.isArray(slots)) {
    return -1
  }
  var i
  for (i = 0; i < slots.length; i++) {
    if (classify(slots[i]).selectable) {
      return i
    }
  }
  return -1
}

function lastSelectableIndex(slots) {
  var i
  var last = -1
  for (i = 0; i < slots.length; i++) {
    if (classify(slots[i]).selectable) {
      last = i
    }
  }
  return last
}

function moveCursor(slots, cursor, delta) {
  if (!Array.isArray(slots) || slots.length === 0) {
    return -1
  }
  var selectable = []
  var i
  for (i = 0; i < slots.length; i++) {
    if (classify(slots[i]).selectable) {
      selectable.push(i)
    }
  }
  if (selectable.length === 0) {
    return -1
  }
  if (delta === 0) {
    if (cursor >= 0 && cursor < slots.length && classify(slots[cursor]).selectable) {
      return cursor
    }
    return placeCursor(slots)
  }
  if (cursor === -1) {
    if (delta > 0) {
      return placeCursor(slots)
    }
    return lastSelectableIndex(slots)
  }
  var pos = -1
  for (i = 0; i < selectable.length; i++) {
    if (selectable[i] === cursor) {
      pos = i
      break
    }
  }
  if (pos < 0) {
    return placeCursor(slots)
  }
  var step = delta > 0 ? 1 : -1
  var count = selectable.length
  var moves = Math.abs(delta)
  var j
  for (j = 0; j < moves; j++) {
    pos = (pos + step + count) % count
  }
  return selectable[pos]
}

function scrollBy(contentY, delta, chromeRef, contentHeight, viewHeight) {
  var next = contentY + delta * chromeRef.rowHeight
  var limit = Math.max(0, contentHeight - viewHeight)
  if (next < 0) {
    next = 0
  }
  if (next > limit) {
    next = limit
  }
  return next
}

function activation(slot, browseProject) {
  var face = classify(slot)
  if (!face.selectable) {
    return { type: "none" }
  }
  if (face.presentation === "recent" || slot.nodeId !== "") {
    return {
      type: "remember",
      fileId: slot.fileId,
      pageId: slot.pageId,
      nodeId: slot.nodeId,
    }
  }
  if (slot.pageId !== "") {
    return {
      type: "page",
      fileId: slot.fileId,
      pageId: slot.pageId,
      projectName: browseProject,
      pageName: slot.label,
    }
  }
  if (slot.fileId !== "") {
    return {
      type: "pages",
      fileId: slot.fileId,
      projectName: slot.label,
    }
  }
  return { type: "none" }
}

function rowSurface(view, slot, index, cursor, nodeId, shotHere) {
  var face = classify(slot)
  if (!face.selectable) {
    return { hasCursor: false, current: false }
  }
  if (view === "shot") {
    return {
      hasCursor: false,
      current: shotHere && slot.nodeId !== "" && slot.nodeId === nodeId,
    }
  }
  return {
    hasCursor: index === cursor,
    current: false,
  }
}

function containFit(boxW, boxH, imageW, imageH) {
  if (boxW <= 0 || boxH <= 0 || imageW <= 0 || imageH <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  var scale = Math.min(boxW / imageW, boxH / imageH)
  var width = Math.min(boxW, Math.round(imageW * scale))
  var height = Math.min(boxH, Math.round(imageH * scale))
  var x = Math.round((boxW - width) / 2)
  var y = Math.round((boxH - height) / 2)
  if (x < 0) {
    x = 0
  }
  if (y < 0) {
    y = 0
  }
  if (x + width > boxW) {
    x = boxW - width
  }
  if (y + height > boxH) {
    y = boxH - height
  }
  return { x: x, y: y, width: width, height: height }
}

function contentFrame(view, contentWidth, contentHeight, imageWidth, imageHeight, chromeRef) {
  if (view !== "shot") {
    return {
      shot: null,
      rule: 0,
      list: {
        id: "browser",
        scroll: "self",
        y: 0,
        height: Math.max(0, contentHeight),
      },
    }
  }
  var n
  var picked = -1
  var pickedShotHeight = 0
  var pickedWell = 0
  for (n = chromeRef.boardRows; n >= chromeRef.floorRows; n--) {
    var well = chromeRef.captionHeight + n * chromeRef.rowHeight
    var shotHeight = contentHeight - chromeRef.rule - well
    if (shotHeight > 0) {
      picked = n
      pickedShotHeight = shotHeight
      pickedWell = well
      break
    }
  }
  if (picked < 0) {
    return {
      shot: null,
      rule: 0,
      list: {
        id: "boards",
        scroll: "self",
        y: 0,
        height: Math.max(0, contentHeight),
      },
    }
  }
  // The shot stops at its cap. A taller screen spends the rest on rows, so the
  // artboard stays the size the canvas drew it at instead of filling the drawer.
  var cap = Math.round(contentWidth * chromeRef.shotAspect) + chromeRef.gutter * 2
  var shotHeight = pickedShotHeight
  if (cap > 0 && shotHeight > cap) {
    shotHeight = cap
    pickedWell = contentHeight - chromeRef.rule - shotHeight
  }
  // Contain-fit lands one of the image's axes on the pane's edge: the width
  // for a landscape artboard, the height for a portrait one. The image keeps a
  // margin on all four sides so no edge sits on the border or on a rule. Rows
  // still bleed to the drawer's edge.
  var insetX = contentWidth > chromeRef.gutter * 4 ? chromeRef.gutter : 0
  var insetY = shotHeight > chromeRef.gutter * 4 ? chromeRef.gutter : 0
  var image = containFit(
    contentWidth - insetX * 2,
    shotHeight - insetY * 2,
    imageWidth,
    imageHeight,
  )
  image.x = image.x + insetX
  image.y = image.y + insetY
  return {
    shot: {
      scroll: "none",
      fit: "contain",
      height: shotHeight,
      image: image,
    },
    rule: chromeRef.rule,
    list: {
      id: "boards",
      scroll: "self",
      y: shotHeight + chromeRef.rule,
      height: pickedWell,
    },
  }
}

// The big view. The drawer's artboard is capped at the size the layout canvas
// drew it at, which is too small to read the artboard itself. This fits the
// same cached JPEG into the whole screen, less a margin on all four sides.
// An unmeasured image takes the whole pane, because PreserveAspectFit
// letterboxes it correctly until its natural size arrives.
function zoomFrame(boxW, boxH, imageW, imageH, chromeRef) {
  var margin = chromeRef.zoomMargin
  var insetX = boxW > margin * 4 ? margin : 0
  var insetY = boxH > margin * 4 ? margin : 0
  var paneW = Math.max(0, boxW - insetX * 2)
  var paneH = Math.max(0, boxH - insetY * 2)
  if (imageW <= 0 || imageH <= 0) {
    return { x: insetX, y: insetY, width: paneW, height: paneH }
  }
  var image = containFit(paneW, paneH, imageW, imageH)
  image.x = image.x + insetX
  image.y = image.y + insetY
  return image
}

function nameOrId(name, id) {
  return name !== "" ? name : id
}

function trailOf(project, page) {
  if (project === "" && page === "") {
    return ""
  }
  if (page === "") {
    return project
  }
  if (project === "") {
    return page
  }
  return project + " \u203A " + page
}

function drawerHeader(input) {
  var view = input && input.view ? input.view : "projects"
  if (view === "projects") {
    return { title: "Projects", trail: "" }
  }
  if (view === "pages") {
    var pagesTitle = input.browseProject !== "" ? input.browseProject : (input.browseFileId !== "" ? input.browseFileId : "Pages")
    return { title: pagesTitle, trail: "" }
  }
  if (view === "shot") {
    if (input.holding && !input.shotHere) {
      var holdTitle =
        input.holdPage !== ""
          ? input.holdPage
          : input.holdProject !== ""
            ? input.holdProject
            : "Paper Peek"
      var holdTrail = input.holdPage !== "" ? input.holdProject : ""
      return { title: holdTitle, trail: holdTrail }
    }
    if (input.shotHere) {
      var shotTitle =
        input.catalogArtboard !== ""
          ? input.catalogArtboard
          : input.memoryArtboard !== ""
            ? input.memoryArtboard
            : "Paper Peek"
      var trail = trailOf(
        nameOrId(input.projectName, input.projectId),
        nameOrId(input.pageName, input.pageId),
      )
      return { title: shotTitle, trail: trail }
    }
    return { title: "Paper Peek", trail: "" }
  }
  return { title: "Projects", trail: "" }
}

function artboardLabel(slots, nodeId) {
  if (nodeId === "" || !Array.isArray(slots)) {
    return ""
  }
  var i
  for (i = 0; i < slots.length; i++) {
    var slot = slots[i]
    if (classify(slot).selectable && slot.nodeId === nodeId && slot.label !== "") {
      return slot.label
    }
  }
  return ""
}

function headerActions(view, holding, canZoom) {
  var canBack = view === "pages" || (view === "shot" && holding)
  var actions = []
  if (canBack) {
    actions.push({ id: "back", icon: ACTION_ICON.back, tooltip: "Back" })
  }
  if (view === "shot" && canZoom) {
    actions.push({ id: "zoom", icon: ACTION_ICON.zoom, tooltip: "Zoom" })
  }
  if (view === "shot") {
    actions.push({ id: "browse", icon: ACTION_ICON.browse, tooltip: "Browse" })
  } else {
    actions.push({ id: "refresh", icon: ACTION_ICON.refresh, tooltip: "Refresh" })
  }
  return actions
}

function statusDot(status) {
  if (status === "live") {
    return "accent"
  }
  if (status === "not-live") {
    return "urgent"
  }
  return "muted"
}

function statusWord(status) {
  if (status === "live") {
    return "Live"
  }
  if (status === "not-live") {
    return "Not live"
  }
  return "Off"
}

function showEmpty(view, slots, pending, notice) {
  if (view === "shot" || pending !== "" || notice !== "") {
    return false
  }
  return placeCursor(slots) < 0
}
