import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "src/drawer-layout.js" as Layout

Item {
  id: root

  property bool opened: false

  readonly property string home: Quickshell.env("HOME") || ""
  readonly property string statePath: (Quickshell.env("XDG_STATE_HOME") || (home + "/.local/state")) + "/paper-peek/current.json"
  readonly property string statusPath: (Quickshell.env("XDG_STATE_HOME") || (home + "/.local/state")) + "/paper-peek/status"
  readonly property string cacheDir: Quickshell.env("PAPER_PEEK_CACHE") || (home + "/.cache/paper-peek")
  readonly property string fetchScript: (Quickshell.env("XDG_CONFIG_HOME") || (home + "/.config")) + "/omarchy/plugins/fmchale.paper-peek/scripts/paper-fetch"
  readonly property string absentCatalog: cacheDir + "/absent"
  readonly property string settingsDir: (Quickshell.env("XDG_CONFIG_HOME") || (home + "/.config")) + "/paper-peek"
  readonly property string settingsPath: settingsDir + "/settings.json"
  property string drawerSide: "right"
  property int drawerWidth: 480
  property int refreshIntervalMs: 2000
  property string defaultMode: "drawer"
  property string paperUrl: ""
  property bool openIntoBrowser: false
  property bool settingsQueued: false
  property bool hotkeysQueued: false

  property string fileId: ""
  property string pageId: ""
  property string nodeId: ""
  property string projectName: ""
  property string pageName: ""
  property string artboardName: ""
  property var pageHold: null
  property var browserSlots: []
  property var boardSlots: []
  property int cursor: -1
  property real shotNaturalW: 0
  property real shotNaturalH: 0
  property bool zoomed: false
  property real zoomNaturalW: 0
  property real zoomNaturalH: 0
  property string imagePath: ""
  property int shotRevision: 0
  property string peekStatus: "off"
  property string view: "shot"
  property string notice: ""
  property string pending: ""
  property var queued: null
  property string browseFileId: ""
  property string browseProjectName: ""

  readonly property string listedFileId: root.pageHold ? root.pageHold.fileId : root.fileId
  readonly property string listedPageId: root.pageHold ? root.pageHold.pageId : root.pageId
  readonly property bool shotHere:
    root.fileId !== "" && root.pageId !== "" && root.nodeId !== ""
    && root.fileId === root.listedFileId && root.pageId === root.listedPageId

  readonly property string floatPath: (Quickshell.env("XDG_STATE_HOME") || (home + "/.local/state")) + "/paper-peek/float.json"
  readonly property string geomScript: (Quickshell.env("XDG_CONFIG_HOME") || (home + "/.config")) + "/omarchy/plugins/fmchale.paper-peek/scripts/float-geometry"
  readonly property int floatInset: 16
  readonly property int floatMinW: 180
  readonly property int floatMinH: 140
  property bool floated: false
  property bool docked: false
  property bool passClicks: false
  property bool floatKnown: false
  property bool floatDragging: false
  property int floatX: 16
  property int floatY: 16
  property int floatW: 420
  property int floatH: 320

  readonly property string shotSource: imagePath === "" ? "" : (Util.fileUrl(imagePath) + (shotRevision > 0 ? ("?v=" + shotRevision) : ""))

  readonly property color ink: Commons.Color.popups.text
  readonly property var chrome: Layout.chrome(styleTokens())
  readonly property color inkSecondary: Qt.darker(ink, chrome.secondaryDarken)
  readonly property color inkEmpty: Qt.darker(ink, chrome.emptyDarken)
  readonly property var activeSlots: view === "shot" ? boardSlots : browserSlots
  readonly property bool canZoom: view === "shot" && imagePath !== ""
  readonly property var zoomRect: Layout.zoomFrame(
    zoomWindow.width,
    zoomWindow.height,
    zoomNaturalW,
    zoomNaturalH,
    chrome)
  readonly property var frame: Layout.contentFrame(
    view,
    content.width,
    content.height,
    shotHere ? shotNaturalW : 0,
    shotHere ? shotNaturalH : 0,
    chrome)
  readonly property var headerCopy: Layout.drawerHeader(headerInput())
  readonly property string floatName: Layout.floatTitle(Layout.artboardLabel(boardSlots, nodeId), artboardName)

  onListedFileIdChanged: boardSlots = []
  onListedPageIdChanged: boardSlots = []
  onActiveSlotsChanged: {
    if (regionList) regionList.contentY = 0
  }

  function styleTokens() {
    return {
      rowPaddingX: Style.spacing.rowPaddingX,
      body: Style.font.body,
      lg: Style.spacing.lg,
      sm: Style.spacing.sm,
      controlHeight: Style.spacing.controlHeight,
      hairline: Style.spacing.hairline,
      captionHeight: captionProbe.implicitHeight,
      popupRowHeight: Style.spacing.popupRowHeight
    }
  }

  function headerInput() {
    var hold = root.pageHold
    return {
      view: root.view,
      shotHere: root.shotHere,
      holding: hold !== null,
      projectName: root.projectName,
      projectId: root.fileId,
      pageName: root.pageName,
      pageId: root.pageId,
      browseProject: root.browseProjectName,
      browseFileId: root.browseFileId,
      catalogArtboard: Layout.artboardLabel(root.boardSlots, root.nodeId),
      memoryArtboard: root.artboardName,
      holdProject: hold && hold.projectName ? hold.projectName : "",
      holdPage: hold && hold.pageName ? hold.pageName : ""
    }
  }

  function dotColor(status) {
    var role = Layout.statusDot(status)
    if (role === "accent") return Commons.Color.accent
    if (role === "urgent") return Commons.Color.urgent
    return Commons.Color.muted
  }

  function runAction(id) {
    if (id === "back") root.back()
    else if (id === "zoom") root.enterZoom()
    else if (id === "float") root.enterFloat()
    else if (id === "browse") root.showBrowser()
    else if (id === "refresh") root.refreshBrowse()
  }

  function activateSlot(index) {
    var slot = root.activeSlots[index]
    if (!slot) return
    if (root.view !== "shot" && Layout.classify(slot).selectable) root.cursor = index
    var act = Layout.activation(slot, root.browseProjectName)
    if (act.type === "pages") {
      root.notice = ""
      root.show({ kind: "pages", fileId: act.fileId, projectName: act.projectName })
      return
    }
    if (act.type === "page") {
      root.show({
        kind: "page",
        fileId: act.fileId,
        pageId: act.pageId,
        projectName: act.projectName,
        pageName: act.pageName
      })
      return
    }
    if (act.type === "remember") root.rememberPlace(act.fileId, act.pageId, act.nodeId)
  }

  // The big view reads the JPEG already on disk, so there is no Paper call
  // here and no state to save. Leaving it puts the drawer back as it was.
  function enterZoom() {
    if (!root.canZoom) return
    if (root.floated && root.passClicks) return
    if (!root.shown()) return
    root.zoomed = true
    Qt.callLater(function() {
      if (!root.zoomed) return
      zoomKeys.forceActiveFocus()
    })
  }

  function leaveZoom() {
    if (!root.zoomed) return
    root.zoomed = false
    root.zoomNaturalW = 0
    root.zoomNaturalH = 0
  }

  function toggleZoom() {
    if (root.zoomed) root.leaveZoom()
    else root.enterZoom()
  }

  function paneKey(event) {
    if (event.key === Qt.Key_Escape) {
      if (root.view === "shot") {
        if (root.docked) root.undock()
        else root.close("")
      } else {
        root.closeBrowser()
      }
      event.accepted = true
      return
    }
    if (event.key === Qt.Key_Space) {
      root.toggleZoom()
      event.accepted = true
      return
    }
    if (event.key === Qt.Key_F) {
      root.runAction("float")
      event.accepted = true
      return
    }
    if (event.key === Qt.Key_Backspace) {
      root.runAction("back")
      event.accepted = true
      return
    }
    if (event.key === Qt.Key_Up || event.key === Qt.Key_Down) {
      var delta = event.key === Qt.Key_Up ? -1 : 1
      if (root.view === "shot") {
        regionList.contentY = Layout.scrollBy(
          regionList.contentY,
          delta,
          root.chrome,
          regionList.contentHeight,
          regionList.height)
      } else {
        root.cursor = Layout.moveCursor(root.activeSlots, root.cursor, delta)
        if (root.cursor >= 0) regionList.positionViewAtIndex(root.cursor, ListView.Contain)
      }
      event.accepted = true
      return
    }
    if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
      if (root.view === "shot") root.runAction("browse")
      else root.activateSlot(root.cursor)
      event.accepted = true
    }
  }

  function applyStatus(text) {
    var word = String(text || "").trim()
    if (word === "live" || word === "not-live" || word === "off") root.peekStatus = word
  }

  function probeStatus() {
    if (statusProbe.running) return
    statusProbe.running = true
  }

  function open(payloadJson) {
    if (docked) undock()
    floated = false
    stateFile.reload()
    readCurrent()
    opened = true
    notice = ""
    show({ kind: "current" })
    startCommand(["resolve"], "resolve")
  }

  function present() {
    if (root.defaultMode === "float") {
      root.enterFloat()
      return
    }
    if (root.defaultMode === "dock") {
      root.dock("")
      return
    }
    root.open("")
  }

  function shown() {
    return root.opened || root.floated || root.docked
  }

  function openBrowser() {
    if (root.opened || root.docked) {
      root.showBrowser()
      return
    }
    root.openIntoBrowser = true
    if (root.floated) root.floated = false
    if (root.defaultMode === "dock") root.dock("")
    else root.open("")
  }

  function refreshShot() {
    if (fileId === "" || nodeId === "") return
    if (shotFetch.running) return
    shotFetch.command = [fetchScript, "shot", fileId, nodeId]
    shotFetch.running = true
  }

  function watchArtboard() {
    if ((!opened && !docked) || peekStatus !== "live") return
    if (fileId === "" || nodeId === "") return
    if (watchFetch.running || shotFetch.running) return
    watchFetch.command = [fetchScript, "watch", fileId, nodeId]
    watchFetch.running = true
  }

  function close(payloadJson) {
    leaveZoom()
    floated = false
    opened = false
  }

  function toggle() {
    if (floated) {
      floated = false
      return
    }
    if (docked) {
      undock()
      return
    }
    if (opened) close("")
    else present()
  }

  function attachBody(toDock) {
    var next = toDock ? dockPad : surface
    if (!next) return
    if (body.parent !== next) body.parent = next
    body.anchors.fill = next
    body.anchors.margins = 0
  }

  function dock(payloadJson) {
    if (docked && dockWindow.visible) return
    floated = false
    opened = false
    attachBody(true)
    docked = true
    dockWindow.visible = true
    stateFile.reload()
    readCurrent()
    notice = ""
    show({ kind: "current" })
    startCommand(["resolve"], "resolve")
    Qt.callLater(function() {
      if (!docked) return
      content.forceActiveFocus()
    })
  }

  function undock() {
    if (!docked && !dockWindow.visible) return
    leaveZoom()
    attachBody(false)
    docked = false
    dockWindow.visible = false
  }

  function screenSize() {
    var target = floatWindow.screen
    if (!target && Quickshell.screens.length > 0) target = Quickshell.screens[0]
    return {
      width: target ? target.width : 1,
      height: target ? target.height : 1
    }
  }

  function parseFloatText(text) {
    if (!text || String(text).trim() === "") return null
    var parsed
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      return null
    }
    if (!parsed || typeof parsed.x !== "number" || typeof parsed.y !== "number") return null
    if (typeof parsed.width !== "number" || typeof parsed.height !== "number") return null
    if (!isFinite(parsed.x) || !isFinite(parsed.y) || !isFinite(parsed.width) || !isFinite(parsed.height)) return null
    if (parsed.width <= 0 || parsed.height <= 0) return null
    if (parsed.clickThrough !== undefined && typeof parsed.clickThrough !== "boolean") return null
    return {
      x: parsed.x,
      y: parsed.y,
      width: parsed.width,
      height: parsed.height,
      clickThrough: parsed.clickThrough === true
    }
  }

  function clampFloat() {
    var box = screenSize()
    var w = Math.round(floatW)
    var h = Math.round(floatH)
    if (w < floatMinW) w = floatMinW
    if (h < floatMinH) h = floatMinH
    if (w > box.width) w = Math.max(1, Math.round(box.width))
    if (h > box.height) h = Math.max(1, Math.round(box.height))
    var x = Math.round(floatX)
    var y = Math.round(floatY)
    if (x < 0) x = 0
    if (y < 0) y = 0
    if (x > box.width - w) x = Math.round(box.width - w)
    if (y > box.height - h) y = Math.round(box.height - h)
    floatX = x
    floatY = y
    floatW = w
    floatH = h
  }

  function placeDefault() {
    var box = screenSize()
    var w = Math.min(420, Math.max(floatMinW, box.width - floatInset * 2))
    var h = Math.min(320, Math.max(floatMinH, box.height - floatInset * 2))
    floatW = w
    floatH = h
    floatX = Math.max(floatInset, box.width - w - floatInset)
    floatY = Math.max(floatInset, box.height - h - floatInset)
    passClicks = false
    floatKnown = true
  }

  function applyFloatText(text) {
    if (floatDragging) return
    var parsed = parseFloatText(text)
    if (!parsed) return
    floatX = parsed.x
    floatY = parsed.y
    floatW = parsed.width
    floatH = parsed.height
    passClicks = parsed.clickThrough
    floatKnown = true
    var before = floatX + "," + floatY + "," + floatW + "," + floatH
    clampFloat()
    var after = floatX + "," + floatY + "," + floatW + "," + floatH
    if (before !== after) saveFloat()
  }

  function saveFloat() {
    var body = JSON.stringify({
      x: floatX,
      y: floatY,
      width: floatW,
      height: floatH,
      clickThrough: passClicks
    }, null, 2) + "\n"
    if (floatFile.text() === body) return
    floatFile.setText(body)
  }

  function dragFloat(x, y, w, h) {
    floatX = x
    floatY = y
    floatW = w
    floatH = h
    clampFloat()
  }

  function resizeFloat(mode, x, y, w, h, dx, dy) {
    var nextX = x
    var nextY = y
    var nextW = w
    var nextH = h
    if (mode.indexOf("l") >= 0) {
      nextX = x + dx
      nextW = w - dx
    }
    if (mode.indexOf("r") >= 0) nextW = w + dx
    if (mode.indexOf("t") >= 0) {
      nextY = y + dy
      nextH = h - dy
    }
    if (mode.indexOf("b") >= 0) nextH = h + dy
    dragFloat(nextX, nextY, nextW, nextH)
  }

  function finishFloatSize() {
    clampFloat()
    saveFloat()
  }

  function snapFloat() {
    var box = screenSize()
    snapFetch.command = [
      geomScript, "snap",
      String(floatX), String(floatY), String(floatW), String(floatH),
      String(box.width), String(box.height),
      passClicks ? "1" : "0"
    ]
    if (snapFetch.running) return
    snapFetch.running = true
  }

  function applySnapText(text) {
    var parsed = parseFloatText(text)
    if (!parsed) {
      clampFloat()
      saveFloat()
      return
    }
    floatX = parsed.x
    floatY = parsed.y
    floatW = parsed.width
    floatH = parsed.height
    passClicks = parsed.clickThrough
    saveFloat()
  }

  function enterFloat() {
    if (docked) undock()
    if (!floatKnown) placeDefault()
    opened = false
    floated = true
    show({ kind: "current" })
    saveFloat()
  }

  function leaveFloatToDrawer() {
    floated = false
    open("")
  }

  function togglePassClicks() {
    leaveZoom()
    if (!floatKnown) placeDefault()
    passClicks = !passClicks
    saveFloat()
  }

  function safeId(value) {
    if (typeof value !== "string") return ""
    return /^[A-Za-z0-9_-]+$/.test(value) ? value : ""
  }

  function parseCurrent(text) {
    var empty = {
      fileId: "",
      pageId: "",
      nodeId: "",
      projectName: "",
      pageName: "",
      artboardName: ""
    }
    if (!text) return empty
    try {
      var parsed = JSON.parse(text)
      return {
        fileId: safeId(parsed.fileId),
        pageId: safeId(parsed.pageId),
        nodeId: safeId(parsed.nodeId),
        projectName: typeof parsed.projectName === "string" ? parsed.projectName : "",
        pageName: typeof parsed.pageName === "string" ? parsed.pageName : "",
        artboardName: typeof parsed.artboardName === "string" ? parsed.artboardName : ""
      }
    } catch (e) {
      return empty
    }
  }

  function nameFor(text, listKey, id) {
    if (!text || id === "") return ""
    try {
      var parsed = JSON.parse(text)
      var list = parsed[listKey]
      if (!Array.isArray(list)) return ""
      for (var i = 0; i < list.length; i++) {
        var item = list[i]
        if (item && item.id === id && typeof item.name === "string" && item.name !== "")
          return item.name
      }
    } catch (e) {
      return ""
    }
    return ""
  }

  function readCurrent() {
    var current = parseCurrent(stateFile.text())
    fileId = current.fileId
    pageId = current.pageId
    nodeId = current.nodeId
    projectName = current.projectName
    pageName = current.pageName
    artboardName = current.artboardName
    imagePath = fileId !== "" && nodeId !== ""
      ? cacheDir + "/shots/" + fileId + "/" + nodeId + ".jpg"
      : ""
    readNames()
  }

  function readNames() {
    projectName = nameFor(projectsFile.text(), "resources", fileId)
    pageName = fileId === "" ? "" : nameFor(pagesFile.text(), "pages", pageId)
  }

  function show(target) {
    if (!target || !target.kind) return
    leaveZoom()
    if (target.kind === "projects") {
      pageHold = null
      view = "projects"
      browserSlots = []
      cursor = Layout.placeCursor([])
      startCommand(["browser", "projects"], "rows")
      return
    }
    if (target.kind === "pages") {
      pageHold = null
      browseFileId = target.fileId || ""
      browseProjectName = target.projectName || ""
      view = "pages"
      browserSlots = []
      cursor = Layout.placeCursor([])
      startCommand(["browser", "pages", target.fileId], "rows")
      return
    }
    if (target.kind === "page") {
      pageHold = {
        fileId: target.fileId,
        pageId: target.pageId,
        projectName: target.projectName || "",
        pageName: target.pageName || ""
      }
      view = "shot"
      startCommand(["artboards", target.fileId, target.pageId], "catalog")
      return
    }
    if (target.kind === "current") {
      readCurrent()
      pageHold = null
      if (fileId !== "" && nodeId !== "") {
        view = "shot"
        return
      }
      view = "projects"
      browserSlots = []
      cursor = Layout.placeCursor([])
      startCommand(["browser", "projects"], "rows")
    }
  }

  function rememberPlace(fileId, pageId, nodeId) {
    startCommand(["remember", fileId, pageId, nodeId], "remember")
  }

  function parseBoards(text) {
    if (!text) return []
    try {
      var parsed = JSON.parse(text)
      if (!parsed || !Array.isArray(parsed.artboards)) return []
      if (safeId(parsed.fileId) !== listedFileId || safeId(parsed.pageId) !== listedPageId) return null
      var kept = []
      for (var i = 0; i < parsed.artboards.length; i++) {
        var item = parsed.artboards[i]
        if (!item) continue
        var id = safeId(item.id)
        if (id === "" || typeof item.name !== "string") continue
        kept.push({ id: id, name: item.name })
      }
      return kept
    } catch (e) {
      return []
    }
  }

  function applyRows(parsed) {
    var rows = parsed && Array.isArray(parsed.rows) ? parsed.rows : []
    browserSlots = Layout.slotsFromBrowserJson(rows)
    cursor = Layout.placeCursor(browserSlots)
  }

  function startCommand(args, name) {
    if (commandFetch.running) {
      root.queued = { args: args, name: name }
      return
    }
    var command = [root.fetchScript]
    for (var i = 0; i < args.length; i++) command.push(args[i])
    root.pending = name
    root.queued = null
    commandFetch.command = command
    commandFetch.running = true
  }

  function drainCommand() {
    if (!root.queued || commandFetch.running) return
    var next = root.queued
    root.queued = null
    root.startCommand(next.args, next.name)
  }

  function finishCommand(text) {
    var name = root.pending
    root.pending = ""
    if (!root.opened && !root.docked) {
      root.openIntoBrowser = false
      return
    }
    var parsed = null
    try {
      parsed = JSON.parse(String(text || ""))
    } catch (e) {
      parsed = null
    }
    if (name === "resolve") root.applyResolve(parsed)
    else if (name === "rows") root.applyRows(parsed)
    else if (name === "remember") root.applyRemember()
    else if (name === "catalog") return
  }

  function applyResolve(parsed) {
    if (root.openIntoBrowser) {
      root.openIntoBrowser = false
      root.showBrowser()
      return
    }
    if (parsed && parsed.kind === "projects") {
      root.notice = typeof parsed.notice === "string" ? parsed.notice : ""
      root.show({ kind: "projects" })
      return
    }
    if (!parsed && (root.fileId === "" || root.nodeId === "")) {
      root.show({ kind: "projects" })
      return
    }
    root.notice = ""
    root.show({ kind: "current" })
    root.refreshShot()
  }

  function applyRemember() {
    root.notice = ""
    root.show({ kind: "current" })
    root.refreshShot()
  }

  function showBrowser() {
    root.notice = ""
    root.show({ kind: "projects" })
  }

  function refreshBrowse() {
    if (root.view === "pages" && root.browseFileId !== "") {
      root.startCommand(["browser", "pages", root.browseFileId, "--refresh"], "rows")
      return
    }
    if (root.view === "shot" && root.listedFileId !== "" && root.listedPageId !== "") {
      root.startCommand(["artboards", root.listedFileId, root.listedPageId, "--refresh"], "catalog")
      return
    }
    root.startCommand(["browser", "projects", "--refresh"], "rows")
  }

  function closeBrowser() {
    if (root.fileId !== "" && root.nodeId !== "") {
      root.show({ kind: "current" })
      return
    }
    if (root.docked) root.undock()
    else root.close("")
  }

  function back() {
    if (root.view === "shot" && root.pageHold) {
      root.show({
        kind: "pages",
        fileId: root.pageHold.fileId,
        projectName: root.pageHold.projectName || ""
      })
      return
    }
    if (root.view === "pages") {
      root.show({ kind: "projects" })
      return
    }
    root.closeBrowser()
  }

  function reloadSettings() {
    if (settingsFetch.running) {
      root.settingsQueued = true
      return
    }
    settingsFetch.running = true
  }

  function applySettingsText(text) {
    var parsed = null
    try {
      parsed = JSON.parse(String(text || ""))
    } catch (e) {
      parsed = null
    }
    if (!parsed || (parsed.drawerSide !== "left" && parsed.drawerSide !== "right")) {
      console.warn("paper-peek: settings reply was not usable")
      return
    }
    root.drawerSide = parsed.drawerSide
    if (typeof parsed.drawerWidth === "number") root.drawerWidth = parsed.drawerWidth
    if (typeof parsed.refreshIntervalMs === "number") {
      root.refreshIntervalMs = parsed.refreshIntervalMs
      if (statusTimer.running) statusTimer.restart()
      if (watchTimer.running) watchTimer.restart()
    }
    if (parsed.defaultMode === "drawer" || parsed.defaultMode === "float" || parsed.defaultMode === "dock")
      root.defaultMode = parsed.defaultMode
    root.paperUrl = parsed.source === "file" && typeof parsed.paperUrl === "string" ? parsed.paperUrl : ""
    var warnings = parsed.warnings
    if (warnings && warnings.length) {
      for (var i = 0; i < warnings.length; i++) console.warn("paper-peek: " + warnings[i])
    }
    root.applyHotkeys()
  }

  function applyHotkeys() {
    if (hotkeyFetch.running) {
      root.hotkeysQueued = true
      return
    }
    hotkeyFetch.running = true
  }

  function logWarnings(text) {
    var parsed = null
    try {
      parsed = JSON.parse(String(text || ""))
    } catch (e) {
      parsed = null
    }
    var warnings = parsed && parsed.warnings ? parsed.warnings : []
    for (var i = 0; i < warnings.length; i++) console.warn("paper-peek: " + warnings[i])
  }

  component CaptionProbe: PanelSectionHeader {
    text: "Recent"
    visible: false
    foreground: root.ink
    fontFamily: Style.menuFontFamily
    fontSize: Style.font.caption
  }

  component HeaderStrip: Item {
    id: headerStrip
    implicitHeight: Math.max(titleCol.implicitHeight, actionRow.implicitHeight) + root.chrome.columnGap * 2 + root.chrome.rule
    height: implicitHeight
    readonly property var cols: Layout.columns(width, root.chrome, actionRow.implicitWidth)

    Column {
      id: titleCol
      x: headerStrip.cols.textX
      y: root.chrome.columnGap
      width: headerStrip.cols.titleWidth
      spacing: root.chrome.titleGap

      Text {
        width: parent.width
        text: root.headerCopy.title
        textFormat: Text.PlainText
        maximumLineCount: 1
        wrapMode: Text.NoWrap
        elide: Text.ElideRight
        color: root.ink
        font.family: Style.menuFontFamily
        font.pixelSize: Style.font.title
      }

      Text {
        width: parent.width
        visible: root.headerCopy.trail !== ""
        text: root.headerCopy.trail
        textFormat: Text.PlainText
        maximumLineCount: 1
        wrapMode: Text.NoWrap
        elide: Text.ElideRight
        color: root.inkSecondary
        font.family: Style.menuFontFamily
        font.pixelSize: Style.font.caption
      }
    }

    Row {
      id: actionRow
      height: implicitHeight
      anchors.right: parent.right
      anchors.rightMargin: root.chrome.gutter
      anchors.verticalCenter: titleCol.verticalCenter
      spacing: root.chrome.columnGap

      Repeater {
        model: Layout.headerActions(root.view, root.pageHold !== null, root.canZoom)

        PanelActionButton {
          required property var modelData
          iconText: modelData.icon
          tooltipText: modelData.tooltip
          foreground: root.ink
          fontFamily: Style.menuFontFamily
          focusable: false
          onClicked: root.runAction(modelData.id)
        }
      }
    }

    PanelSeparator {
      anchors.bottom: parent.bottom
      width: parent.width
      foreground: root.ink
    }
  }

  component StatusLine: Item {
    id: statusLine
    height: root.chrome.footerHeight
    readonly property var cols: Layout.columns(width, root.chrome, 0)

    PanelSeparator {
      anchors.top: parent.top
      width: parent.width
      foreground: root.ink
    }

    Rectangle {
      x: statusLine.cols.textX
      width: root.chrome.dot
      height: root.chrome.dot
      radius: height / 2
      anchors.verticalCenter: parent.verticalCenter
      color: root.dotColor(root.peekStatus)
    }

    Text {
      x: statusLine.cols.textX + root.chrome.dot + root.chrome.columnGap
      width: Math.max(0, parent.width - x - root.chrome.gutter)
      text: Layout.statusWord(root.peekStatus)
      textFormat: Text.PlainText
      elide: Text.ElideRight
      maximumLineCount: 1
      anchors.verticalCenter: parent.verticalCenter
      color: root.ink
      font.family: Style.menuFontFamily
      font.pixelSize: Style.font.body
    }
  }

  component ShotStage: Item {
    clip: true
    visible: root.frame.shot !== null
    y: 0
    width: parent.width
    height: root.frame.shot ? root.frame.shot.height : 0

    Image {
      id: shot
      property string measuredSource: ""
      x: root.frame.shot ? root.frame.shot.image.x : 0
      y: root.frame.shot ? root.frame.shot.image.y : 0
      width: root.frame.shot ? root.frame.shot.image.width : 0
      height: root.frame.shot ? root.frame.shot.image.height : 0
      asynchronous: true
      cache: false
      fillMode: Image.PreserveAspectFit
      source: root.shotSource
      sourceSize.width: width > 0
        ? Math.max(1, Math.round(width * ((root.docked ? dockWindow.devicePixelRatio : window.devicePixelRatio) || 1)))
        : 0
      onStatusChanged: {
        if (status !== Image.Ready) return
        var key = String(source)
        if (key === "" || key === measuredSource) return
        if (implicitWidth <= 0 || implicitHeight <= 0) return
        root.shotNaturalW = implicitWidth
        root.shotNaturalH = implicitHeight
        measuredSource = key
      }
    }

    Text {
      anchors.centerIn: parent
      visible: root.frame.shot !== null
        && root.shotHere
        && (root.imagePath === "" || shot.status === Image.Error || shot.status === Image.Null)
      text: "No cached artboard"
      textFormat: Text.PlainText
      color: root.ink
      font.family: Style.menuFontFamily
      font.pixelSize: Style.font.body
    }

    // A click on the artboard opens it at the size of the screen. The pane's
    // margin counts as the artboard, so a near miss still opens it.
    MouseArea {
      anchors.fill: parent
      acceptedButtons: Qt.LeftButton
      cursorShape: root.canZoom ? Qt.PointingHandCursor : Qt.ArrowCursor
      onClicked: root.enterZoom()
    }
  }

  component RegionList: ListView {
    y: root.frame.list.y
    width: parent.width
    height: root.frame.list.height
    clip: true
    model: root.activeSlots
    spacing: 0
    boundsBehavior: Flickable.StopAtBounds
    interactive: contentHeight > height
    keyNavigationEnabled: false
    highlightFollowsCurrentItem: false
    focus: false
    currentIndex: root.view === "shot" ? -1 : root.cursor
    delegate: SlotDelegate {}
  }

  component SlotDelegate: Item {
    id: rowItem
    required property var modelData
    required property int index
    property var slot: modelData
    property var face: Layout.classify(slot)
    property var cols: Layout.columns(ListView.view.width, root.chrome, 0)
    property var flags: Layout.rowSurface(root.view, slot, index, root.cursor, root.nodeId, root.shotHere)
    width: ListView.view.width
    height: Layout.slotHeight(slot, root.chrome)

    CursorSurface {
      anchors.fill: parent
      radius: 0
      visible: rowItem.face.selectable
      hasCursor: rowItem.flags.hasCursor
      current: rowItem.flags.current
      foreground: root.ink
      fill: Commons.Color.menu.selectedBackground
      currentFill: Commons.Color.menu.selectedBackground
    }

    PanelSectionHeader {
      x: rowItem.cols.textX
      width: rowItem.cols.textWidth
      height: parent.height
      visible: rowItem.face.presentation === "caption"
      text: rowItem.slot.label
      elide: Text.ElideRight
      foreground: root.ink
      fontFamily: Style.menuFontFamily
      fontSize: Style.font.caption
    }

    Text {
      x: rowItem.cols.recentLeft.x
      width: rowItem.cols.recentLeft.width
      height: parent.height
      visible: rowItem.face.presentation === "recent"
      verticalAlignment: Text.AlignVCenter
      text: rowItem.slot.label
      textFormat: Text.PlainText
      elide: Text.ElideRight
      color: (rowItem.flags.hasCursor || rowItem.flags.current) ? Commons.Color.menu.selectedText : root.ink
      font.family: Style.menuFontFamily
      font.pixelSize: Style.font.body
    }

    Text {
      x: rowItem.cols.recentRight.x
      width: rowItem.cols.recentRight.width
      height: parent.height
      visible: rowItem.face.presentation === "recent"
      verticalAlignment: Text.AlignVCenter
      horizontalAlignment: Text.AlignRight
      text: rowItem.slot.detail
      textFormat: Text.PlainText
      elide: Text.ElideRight
      color: root.inkSecondary
      font.family: Style.menuFontFamily
      font.pixelSize: Style.font.body
    }

    Text {
      x: rowItem.cols.textX
      width: Math.max(
        0,
        rowItem.cols.textWidth - (rowOrdinal.visible ? rowOrdinal.width + root.chrome.columnGap : 0))
      height: parent.height
      visible: rowItem.face.presentation === "single"
      verticalAlignment: Text.AlignVCenter
      text: rowItem.slot.label
      textFormat: Text.PlainText
      elide: Text.ElideRight
      color: (rowItem.flags.hasCursor || rowItem.flags.current) ? Commons.Color.menu.selectedText : root.ink
      font.family: Style.menuFontFamily
      font.pixelSize: Style.font.body
    }

    Text {
      id: rowOrdinal
      x: rowItem.cols.textX + rowItem.cols.textWidth - width
      width: Math.min(implicitWidth, rowItem.cols.textWidth)
      height: parent.height
      visible: rowItem.face.presentation === "single" && rowItem.slot.detail !== ""
      horizontalAlignment: Text.AlignRight
      verticalAlignment: Text.AlignVCenter
      text: rowItem.slot.detail
      textFormat: Text.PlainText
      elide: Text.ElideRight
      color: root.inkSecondary
      font.family: Style.menuFontFamily
      font.pixelSize: Style.font.caption
    }

    MouseArea {
      anchors.fill: parent
      enabled: rowItem.face.selectable
      hoverEnabled: root.view !== "shot"
      onContainsMouseChanged: {
        if (containsMouse && root.view !== "shot") root.cursor = rowItem.index
      }
      onClicked: root.activateSlot(rowItem.index)
    }
  }

  component FloatStrip: Item {
    id: floatStripItem
    height: root.chrome.controlHeight
    clip: true
    readonly property var cols: Layout.columns(width, root.chrome, passButton.width)

    Rectangle {
      anchors.fill: parent
      color: Commons.Color.menu.background
    }

    PanelSeparator {
      anchors.bottom: parent.bottom
      width: parent.width
      foreground: root.ink
    }

    Rectangle {
      id: floatDot
      x: floatStripItem.cols.textX
      anchors.verticalCenter: parent.verticalCenter
      width: root.chrome.dot
      height: root.chrome.dot
      radius: height / 2
      color: root.dotColor(root.peekStatus)
    }

    Text {
      x: floatDot.x + floatDot.width + root.chrome.columnGap
      width: Math.max(0, floatStripItem.cols.titleWidth - root.chrome.dot - root.chrome.columnGap)
      anchors.verticalCenter: parent.verticalCenter
      text: root.floatName
      textFormat: Text.PlainText
      elide: Text.ElideRight
      wrapMode: Text.NoWrap
      maximumLineCount: 1
      color: root.ink
      font.family: Style.menuFontFamily
      font.pixelSize: Style.font.body
    }

    Rectangle {
      id: passButton
      anchors.right: parent.right
      anchors.rightMargin: root.chrome.gutter
      anchors.verticalCenter: parent.verticalCenter
      height: passLabel.implicitHeight + root.chrome.columnGap
      width: passLabel.implicitWidth + root.chrome.columnGap * 2
      radius: Style.cornerRadius
      color: root.passClicks ? Commons.Color.urgent : "transparent"
      border.color: Commons.Color.popups.border
      border.width: Math.max(1, root.chrome.rule)

      Text {
        id: passLabel
        anchors.centerIn: parent
        text: root.passClicks ? "Passing" : "Clicks"
        textFormat: Text.PlainText
        color: root.ink
        font.family: Style.menuFontFamily
        font.pixelSize: Style.font.body
      }

      MouseArea {
        anchors.fill: parent
        onClicked: root.togglePassClicks()
      }
    }
  }

  CaptionProbe {
    id: captionProbe
  }

  Process {
    id: shotFetch
    running: false
    environment: root.paperUrl === "" ? ({}) : ({ PAPER_MCP_URL: root.paperUrl })
    command: [root.fetchScript, "shot", "x", "x"]
    onExited: function(exitCode) {
      if (exitCode === 0) root.shotRevision += 1
    }
  }

  Process {
    id: commandFetch
    running: false
    environment: root.paperUrl === "" ? ({}) : ({ PAPER_MCP_URL: root.paperUrl })
    command: [root.fetchScript, "resolve"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.finishCommand(text)
    }
    onExited: root.drainCommand()
  }

  ShellIpc {
    target: "fmchale.paper-peek"
    function open(): string {
      root.present()
      return root.shown() ? "open" : "closed"
    }
    function browser(): string {
      root.openBrowser()
      return "ok"
    }
    function close(): string {
      root.close("")
      return "ok"
    }
    function toggle(): string {
      root.toggle()
      return root.shown() ? "open" : "closed"
    }
    function status(): string {
      return root.peekStatus
    }
    function zoom(): string {
      root.toggleZoom()
      return root.zoomed ? "open" : "closed"
    }
    function layout(): string {
      if (root.floated) {
        root.leaveFloatToDrawer()
        return "drawer"
      }
      root.enterFloat()
      return "float"
    }
    function clickthrough(): string {
      root.togglePassClicks()
      return root.passClicks ? "on" : "off"
    }
    function dock(): string {
      root.dock("")
      return "open"
    }
    function undock(): string {
      root.undock()
      return "closed"
    }
  }

  Timer {
    id: statusTimer
    interval: root.refreshIntervalMs
    repeat: true
    running: true
    triggeredOnStart: true
    onTriggered: root.probeStatus()
  }

  Timer {
    id: watchTimer
    interval: root.refreshIntervalMs
    repeat: true
    running: (root.opened || root.docked) && root.peekStatus === "live" && root.fileId !== "" && root.nodeId !== ""
    onTriggered: root.watchArtboard()
  }

  Process {
    id: watchFetch
    running: false
    environment: root.paperUrl === "" ? ({}) : ({ PAPER_MCP_URL: root.paperUrl })
    command: [root.fetchScript, "watch", "x", "x"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        if (!root.opened && !root.docked) return
        if (String(text || "").trim() === "changed") root.refreshShot()
      }
    }
  }

  Process {
    id: statusProbe
    running: false
    environment: root.paperUrl === "" ? ({}) : ({ PAPER_MCP_URL: root.paperUrl })
    command: [root.fetchScript, "status"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyStatus(text)
    }
  }

  Process {
    id: settingsFetch
    running: false
    command: [root.fetchScript, "settings"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applySettingsText(text)
    }
    onExited: {
      if (root.settingsQueued) {
        root.settingsQueued = false
        root.reloadSettings()
        return
      }
      if (!settingsWatch.running) settingsWatch.running = true
    }
  }

  Process {
    id: hotkeyFetch
    running: false
    command: [root.fetchScript, "apply-hotkeys"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.logWarnings(text)
    }
    onExited: {
      if (!root.hotkeysQueued) return
      root.hotkeysQueued = false
      root.applyHotkeys()
    }
  }

  Process {
    id: settingsWatch
    running: false
    command: ["inotifywait", "-m", "-q", "-e", "close_write,create,delete,move", "--format", "%f", root.settingsDir]
    stdout: SplitParser {
      onRead: function(line) {
        if (String(line).trim() === "settings.json") root.reloadSettings()
      }
    }
    onExited: settingsWatchRetry.start()
  }

  Timer {
    id: settingsWatchRetry
    interval: 2000
    onTriggered: if (!settingsWatch.running) settingsWatch.running = true
  }

  Component.onCompleted: root.reloadSettings()

  FileView {
    path: root.statusPath
    watchChanges: true
    blockLoading: true
    printErrors: false
    onLoaded: root.applyStatus(text())
    onFileChanged: reload()
  }

  FileView {
    id: stateFile
    path: root.statePath
    watchChanges: true
    blockLoading: true
    printErrors: false
    onLoaded: root.readCurrent()
    onFileChanged: reload()
  }

  FileView {
    id: projectsFile
    path: root.cacheDir + "/projects.json"
    watchChanges: true
    blockLoading: true
    printErrors: false
    onLoaded: root.readNames()
    onFileChanged: reload()
  }

  FileView {
    id: pagesFile
    path: root.fileId === "" ? root.absentCatalog : root.cacheDir + "/pages/" + root.fileId + ".json"
    watchChanges: true
    blockLoading: true
    printErrors: false
    onLoaded: root.readNames()
    onFileChanged: reload()
  }

  FileView {
    id: catalogFile
    path: root.listedFileId === "" || root.listedPageId === ""
      ? root.absentCatalog
      : root.cacheDir + "/artboards/" + root.listedFileId + "/" + root.listedPageId + ".json"
    watchChanges: true
    blockLoading: true
    printErrors: false
    onLoaded: {
      var parsed = root.parseBoards(text())
      if (parsed === null) return
      var next = Layout.slotsFromBoards(parsed, root.listedFileId, root.listedPageId)
      if (!Layout.sameSlots(root.boardSlots, next)) root.boardSlots = next
    }
    onFileChanged: reload()
  }

  PanelWindow {
    id: window

    property real reveal: root.opened ? 1 : 0

    Behavior on reveal {
      NumberAnimation { duration: 180; easing.type: Easing.OutCubic }
    }

    visible: reveal > 0.01 && !root.floated
    color: "transparent"
    exclusionMode: ExclusionMode.Ignore
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.namespace: "fmchale-paper-peek"
    WlrLayershell.keyboardFocus: root.opened && !root.zoomed ? WlrKeyboardFocus.Exclusive : WlrKeyboardFocus.None

    screen: Quickshell.screens.length > 0 ? Quickshell.screens[0] : null
    implicitWidth: screen ? screen.width : root.drawerWidth
    implicitHeight: screen ? screen.height : root.drawerWidth
    anchors.top: true
    anchors.bottom: true
    anchors.left: true
    anchors.right: true
    mask: Region { item: surface }

    Rectangle {
      id: surface
      clip: true
      width: root.drawerWidth
      height: window.height
      x: {
        var span = width * window.reveal
        if (root.drawerSide === "left") return span - width
        var screenWidth = window.screen ? window.screen.width : width
        return screenWidth - span
      }
      color: Commons.Color.popups.background
      radius: Style.cornerRadius

      Rectangle {
        width: Math.max(1, root.chrome.rule)
        height: parent.height
        x: root.drawerSide === "left" ? parent.width - width : 0
        color: Commons.Color.popups.border
      }

      Item {
        id: body
        anchors.fill: parent
        anchors.margins: 0

        HeaderStrip {
          id: header
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.top: parent.top
        }

        Text {
          id: noticeText
          readonly property var cols: Layout.columns(parent.width, root.chrome, 0)
          x: cols.textX
          width: cols.textWidth
          anchors.top: header.bottom
          height: root.notice === "" ? 0 : implicitHeight
          text: root.notice
          textFormat: Text.PlainText
          wrapMode: Text.Wrap
          color: root.ink
          font.family: Style.menuFontFamily
          font.pixelSize: Style.font.body
        }

        StatusLine {
          id: footer
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.bottom: parent.bottom
        }

        Item {
          id: content
          anchors.top: noticeText.bottom
          anchors.bottom: footer.top
          anchors.left: parent.left
          anchors.right: parent.right
          focus: (root.opened || root.docked) && !root.floated && !root.zoomed
          Keys.onPressed: function(event) { root.paneKey(event) }

          ShotStage { id: shotStage }

          PanelSeparator {
            visible: root.frame.rule > 0
            y: root.frame.shot ? root.frame.shot.height : 0
            width: parent.width
            height: root.frame.rule
            foreground: root.ink
          }

          RegionList {
            id: regionList
            visible: !Layout.showEmpty(root.view, root.activeSlots, root.pending, root.notice)
          }

          Text {
            readonly property var cols: Layout.columns(parent.width, root.chrome, 0)
            visible: Layout.showEmpty(root.view, root.activeSlots, root.pending, root.notice)
            anchors.verticalCenter: parent.verticalCenter
            x: cols.textX
            width: cols.textWidth
            horizontalAlignment: Text.AlignHCenter
            text: "Nothing cached yet"
            textFormat: Text.PlainText
            wrapMode: Text.Wrap
            color: root.inkEmpty
            font.family: Style.menuFontFamily
            font.pixelSize: Style.font.body
          }
        }
      }
    }
  }

  FileView {
    id: floatFile
    path: root.floatPath
    watchChanges: true
    blockLoading: true
    printErrors: false
    atomicWrites: true
    onLoaded: root.applyFloatText(text())
    onFileChanged: reload()
  }

  Process {
    id: snapFetch
    running: false
    command: [root.geomScript, "snap", "0", "0", "180", "140", "1", "1", "0"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applySnapText(text)
    }
    onExited: function(exitCode) {
      if (exitCode === 0) return
      root.clampFloat()
      root.saveFloat()
    }
  }

  // A layer surface stays on every workspace. OnDemand takes a click on the
  // card. Exclusive would take the keys the editor is using.
  PanelWindow {
    id: floatWindow
    visible: root.floated
    color: "transparent"
    screen: Quickshell.screens.length > 0 ? Quickshell.screens[0] : null
    exclusionMode: ExclusionMode.Ignore
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.namespace: "fmchale-paper-peek-float"
    WlrLayershell.keyboardFocus: root.floated && !root.passClicks && !root.zoomed ? WlrKeyboardFocus.OnDemand : WlrKeyboardFocus.None
    anchors.left: true
    anchors.top: true
    margins.left: root.floatX
    margins.top: root.floatY
    implicitWidth: root.floatW
    implicitHeight: root.floatH
    mask: Region { item: root.passClicks ? null : floatCard }

    Rectangle {
      id: floatCard
      anchors.fill: parent
      radius: Style.cornerRadius
      color: Commons.Color.popups.background
      border.width: Math.max(1, root.chrome.rule)
      border.color: Commons.Color.popups.border
      clip: true

      Item {
        anchors.fill: parent
        focus: root.floated && !root.passClicks && !root.zoomed
        Keys.onPressed: function(event) {
          if (event.key === Qt.Key_Space) {
            root.toggleZoom()
            event.accepted = true
          } else if (event.key === Qt.Key_F) {
            root.leaveFloatToDrawer()
            event.accepted = true
          } else if (event.key === Qt.Key_C) {
            root.togglePassClicks()
            event.accepted = true
          } else if (event.key === Qt.Key_Escape) {
            root.floated = false
            event.accepted = true
          }
        }
      }

      FloatStrip {
        id: floatStrip
        z: 2
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
      }

      Image {
        id: floatShot
        // The card's own margin, kept here rather than in anchors, so the
        // artboard never sits on the card's border or under the strip's rule.
        readonly property int inset:
          floatCard.width > root.chrome.gutter * 4
            && floatCard.height - floatStrip.height > root.chrome.gutter * 4
            ? root.chrome.gutter
            : 0
        x: inset
        y: floatStrip.height + inset
        width: Math.max(0, floatCard.width - inset * 2)
        height: Math.max(0, floatCard.height - floatStrip.height - inset * 2)
        asynchronous: true
        cache: false
        fillMode: Image.PreserveAspectFit
        horizontalAlignment: Image.AlignHCenter
        verticalAlignment: Image.AlignVCenter
        source: root.shotSource
        sourceSize.width: Math.max(1, Math.round(width * (floatWindow.devicePixelRatio || 1)))
      }

      Text {
        anchors.centerIn: floatShot
        visible: root.imagePath === "" || floatShot.status === Image.Error
        text: "No cached artboard"
        textFormat: Text.PlainText
        color: root.ink
        font.family: Style.menuFontFamily
        font.pixelSize: Style.font.body
      }

      MouseArea {
        id: floatGesture
        z: 1
        anchors.fill: parent
        acceptedButtons: Qt.LeftButton
        property string mode: ""
        property real pressX: 0
        property real pressY: 0
        property real originX: 0
        property real originY: 0
        property real originW: 0
        property real originH: 0

        function gestureAt(px, py) {
          var edge = 10
          var left = px <= edge
          var right = px >= width - edge
          var top = py <= edge
          var bottom = py >= height - edge
          if (left || right || top || bottom)
            return (left ? "l" : "") + (right ? "r" : "") + (top ? "t" : "") + (bottom ? "b" : "")
          if (py < floatStrip.height) return "move"
          return ""
        }

        onPressed: function(mouse) {
          mode = gestureAt(mouse.x, mouse.y)
          if (mode === "") return
          var global = floatCard.mapToGlobal(mouse.x, mouse.y)
          pressX = global.x
          pressY = global.y
          originX = root.floatX
          originY = root.floatY
          originW = root.floatW
          originH = root.floatH
          root.floatDragging = true
        }

        onPositionChanged: function(mouse) {
          if (!pressed || mode === "") return
          var global = floatCard.mapToGlobal(mouse.x, mouse.y)
          var dx = global.x - pressX
          var dy = global.y - pressY
          if (mode === "move") root.dragFloat(originX + dx, originY + dy, originW, originH)
          else root.resizeFloat(mode, originX, originY, originW, originH, dx, dy)
        }

        // The body of the card takes no drag gesture, so a click there opens
        // the artboard at the size of the screen.
        onClicked: function(mouse) {
          if (gestureAt(mouse.x, mouse.y) !== "") return
          root.enterZoom()
        }

        onReleased: {
          var ended = mode
          mode = ""
          root.floatDragging = false
          if (ended === "") return
          if (ended === "move") root.snapFloat()
          else root.finishFloatSize()
        }

        onCanceled: {
          mode = ""
          root.floatDragging = false
          root.finishFloatSize()
        }
      }
    }
  }

  // The big view. This surface maps after the drawer's and the float's, so it
  // stacks over both on the same layer. It carries no mask, so a click
  // anywhere on the screen lands here and closes it. Tiled windows keep their
  // places underneath, as they do under the drawer.
  PanelWindow {
    id: zoomWindow
    visible: root.zoomed
    color: "transparent"
    screen: Quickshell.screens.length > 0 ? Quickshell.screens[0] : null
    exclusionMode: ExclusionMode.Ignore
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.namespace: "fmchale-paper-peek-zoom"
    WlrLayershell.keyboardFocus: root.zoomed ? WlrKeyboardFocus.Exclusive : WlrKeyboardFocus.None
    anchors.top: true
    anchors.bottom: true
    anchors.left: true
    anchors.right: true
    implicitWidth: screen ? screen.width : 0
    implicitHeight: screen ? screen.height : 0

    Rectangle {
      // The theme's popup background carries its own alpha, for the blur
      // behind a panel. Over the desktop that reads as a window left ajar, and
      // the float card underneath shows through as a bright patch. The big
      // view is for reading the artboard, so the backdrop takes the theme's
      // color at full alpha and covers everything.
      readonly property color base: Commons.Color.popups.background
      anchors.fill: parent
      color: Qt.rgba(base.r, base.g, base.b, 1)
    }

    MouseArea {
      anchors.fill: parent
      acceptedButtons: Qt.LeftButton | Qt.RightButton
      onClicked: root.leaveZoom()
    }

    Item {
      id: zoomKeys
      anchors.fill: parent
      focus: root.zoomed
      Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Escape
          || event.key === Qt.Key_Space
          || event.key === Qt.Key_Return
          || event.key === Qt.Key_Enter
          || event.key === Qt.Key_F) {
          root.leaveZoom()
          event.accepted = true
        }
      }
    }

    Image {
      id: zoomShot
      x: root.zoomRect.x
      y: root.zoomRect.y
      width: root.zoomRect.width
      height: root.zoomRect.height
      asynchronous: true
      cache: false
      // No sourceSize here. The drawer decodes the JPEG at the width it draws
      // it, which is the whole point of the small view. This one takes every
      // pixel Paper sent.
      fillMode: Image.PreserveAspectFit
      source: root.zoomed ? root.shotSource : ""
      onStatusChanged: {
        if (status !== Image.Ready) return
        if (implicitWidth <= 0 || implicitHeight <= 0) return
        root.zoomNaturalW = implicitWidth
        root.zoomNaturalH = implicitHeight
      }
    }

    Text {
      anchors.centerIn: parent
      visible: root.zoomed && (zoomShot.status === Image.Error || zoomShot.status === Image.Null)
      text: "No cached artboard"
      textFormat: Text.PlainText
      color: root.ink
      font.family: Style.menuFontFamily
      font.pixelSize: Style.font.body
    }
  }

  FloatingWindow {
    id: dockWindow
    title: "Paper Peek"
    visible: false
    color: Commons.Color.popups.background
    implicitWidth: 960
    implicitHeight: 800
    minimumSize: Qt.size(360, 280)

    Item {
      id: dockPad
      anchors.fill: parent
    }

    onVisibleChanged: {
      if (visible || !root.docked) return
      root.undock()
    }
  }
}
