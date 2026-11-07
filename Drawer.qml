import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import qs.Commons
import qs.Commons as Commons

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
  readonly property int rowHeight: Style.font.body + Style.spacing.lg * 2

  property string fileId: ""
  property string pageId: ""
  property string nodeId: ""
  property string projectName: ""
  property string pageName: ""
  property var pageHold: null
  property var boards: []
  property string imagePath: ""
  property int shotRevision: 0
  property string peekStatus: "off"
  property string view: "shot"
  property string notice: ""
  property string pending: ""
  property var queued: null
  property var rows: []
  property int cursor: 0
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

  function applyStatus(text) {
    var word = String(text || "").trim()
    if (word === "live" || word === "not-live" || word === "off") root.peekStatus = word
  }

  function probeStatus() {
    if (statusProbe.running) return
    statusProbe.running = true
  }

  readonly property string contextLine: {
    if (root.view === "projects") return "Projects"
    if (root.view === "pages")
      return root.browseProjectName !== "" ? root.browseProjectName : root.browseFileId
    if (root.view !== "shot") return "Paper Peek"
    if (root.pageHold) {
      var holdProject = root.pageHold.projectName !== "" ? root.pageHold.projectName : root.pageHold.fileId
      var holdPage = root.pageHold.pageName !== "" ? root.pageHold.pageName : root.pageHold.pageId
      if (holdPage === "") return holdProject
      return holdProject + " › " + holdPage
    }
    if (fileId === "") return "Paper Peek"
    var shotProject = projectName !== "" ? projectName : fileId
    var shotPage = pageName !== "" ? pageName : pageId
    if (shotPage === "") return shotProject
    return shotProject + " › " + shotPage
  }

  readonly property string subjectLine: {
    if (root.view !== "shot") return ""
    if (root.pageHold && !root.shotHere) return ""
    return root.boardName(root.nodeId)
  }

  readonly property string headerText: root.subjectLine === ""
    ? root.contextLine
    : root.contextLine + " › " + root.subjectLine

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
    body.anchors.margins = Style.spacing.popupPadding
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
      if (view === "shot") flick.forceActiveFocus()
      else browserFlick.forceActiveFocus()
    })
  }

  function undock() {
    if (!docked && !dockWindow.visible) return
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
    if (!floatKnown) placeDefault()
    passClicks = !passClicks
    saveFloat()
  }

  function safeId(value) {
    if (typeof value !== "string") return ""
    return /^[A-Za-z0-9_-]+$/.test(value) ? value : ""
  }

  function parseCurrent(text) {
    var empty = { fileId: "", pageId: "", nodeId: "" }
    if (!text) return empty
    try {
      var parsed = JSON.parse(text)
      return {
        fileId: safeId(parsed.fileId),
        pageId: safeId(parsed.pageId),
        nodeId: safeId(parsed.nodeId)
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
    if (target.kind === "projects") {
      pageHold = null
      view = "projects"
      rows = []
      cursor = 0
      startCommand(["browser", "projects"], "rows")
      return
    }
    if (target.kind === "pages") {
      pageHold = null
      browseFileId = target.fileId || ""
      browseProjectName = target.projectName || ""
      view = "pages"
      rows = []
      cursor = 0
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
      rows = []
      cursor = 0
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

  function boardName(nodeId) {
    if (nodeId === "") return ""
    for (var i = 0; i < boards.length; i++) {
      if (boards[i] && boards[i].id === nodeId) return boards[i].name
    }
    return ""
  }

  function stageHeight(viewport, pairHeight) {
    if (pairHeight > viewport) return pairHeight
    return viewport
  }

  function pairY(stageH, pairHeight) {
    if (pairHeight >= stageH) return 0
    return Math.round((stageH - pairHeight) / 2)
  }

  onListedFileIdChanged: boards = []
  onListedPageIdChanged: boards = []

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

  function applyRows(parsed) {
    root.rows = parsed && Array.isArray(parsed.rows) ? parsed.rows : []
    root.cursor = root.firstRow()
    browserFlick.contentY = 0
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

  function firstRow() {
    for (var i = 0; i < root.rows.length; i++) {
      if (root.rows[i] && root.rows[i].kind !== "header") return i
    }
    return 0
  }

  function moveCursor(delta) {
    if (root.rows.length === 0) return
    var index = root.cursor
    for (var step = 0; step < root.rows.length; step++) {
      index = (index + delta + root.rows.length) % root.rows.length
      var row = root.rows[index]
      if (row && row.kind !== "header") {
        root.cursor = index
        root.revealCursor()
        return
      }
    }
  }

  function revealCursor() {
    var y = root.cursor * root.rowHeight
    if (y < browserFlick.contentY) browserFlick.contentY = y
    else if (y + root.rowHeight > browserFlick.contentY + browserFlick.height)
      browserFlick.contentY = Math.max(0, y + root.rowHeight - browserFlick.height)
  }

  function activateRow(index) {
    var row = root.rows[index]
    if (!row || row.kind === "header") return
    root.cursor = index
    if (row.kind === "project") {
      root.notice = ""
      root.show({
        kind: "pages",
        fileId: row.fileId,
        projectName: row.label || ""
      })
      return
    }
    if (row.kind === "page") {
      root.show({
        kind: "page",
        fileId: row.fileId,
        pageId: row.pageId,
        projectName: root.browseProjectName,
        pageName: row.label || ""
      })
      return
    }
    if (row.kind === "recent")
      root.rememberPlace(row.fileId, row.pageId, row.nodeId)
  }

  function rowLabel(row) {
    if (!row) return ""
    if (row.kind === "recent" && row.detail) return row.label + " · " + row.detail
    return row.label || ""
  }

  function browserKey(event) {
    if (event.key === Qt.Key_F) {
      root.enterFloat()
      event.accepted = true
      return
    }
    if (event.key === Qt.Key_Up) root.moveCursor(-1)
    else if (event.key === Qt.Key_Down) root.moveCursor(1)
    else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) root.activateRow(root.cursor)
    else if (event.key === Qt.Key_Backspace) root.back()
    else if (event.key === Qt.Key_Escape) root.closeBrowser()
    else return
    event.accepted = true
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
      var next = root.parseBoards(text())
      if (next === null) return
      root.boards = next
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
    WlrLayershell.keyboardFocus: root.opened ? WlrKeyboardFocus.Exclusive : WlrKeyboardFocus.None

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
        width: Math.max(1, Style.spacing.hairline)
        height: parent.height
        x: root.drawerSide === "left" ? parent.width - width : 0
        color: Commons.Color.popups.border
      }

      Item {
        id: body
        anchors.fill: parent
        anchors.margins: Style.spacing.popupPadding

        Item {
          id: headerBar
          width: parent.width
          height: Math.max(
            headerBlock.implicitHeight,
            actionLink.implicitHeight,
            backLink.implicitHeight,
            floatLink.implicitHeight)

          Text {
            id: backLink
            visible: root.view === "pages" || (root.view === "shot" && root.pageHold)
            anchors.left: parent.left
            anchors.verticalCenter: parent.verticalCenter
            text: "Back"
            textFormat: Text.PlainText
            color: Commons.Color.popups.text
            font.family: Style.menuFontFamily
            font.pixelSize: Style.font.body

            MouseArea {
              anchors.fill: parent
              onClicked: root.back()
            }
          }

          Column {
            id: headerBlock
            anchors.left: backLink.visible ? backLink.right : parent.left
            anchors.leftMargin: backLink.visible ? Style.spacing.sm : 0
            anchors.right: floatLink.left
            anchors.rightMargin: Style.spacing.sm
            anchors.verticalCenter: parent.verticalCenter

            Text {
              width: headerBlock.width
              text: root.contextLine
              textFormat: Text.PlainText
              color: Commons.Color.popups.text
              font.family: Style.menuFontFamily
              font.pixelSize: Style.font.title
              elide: Text.ElideRight
            }

            Text {
              width: headerBlock.width
              height: Math.max(implicitHeight, Style.font.title)
              visible: root.view === "shot"
              text: root.subjectLine
              textFormat: Text.PlainText
              wrapMode: Text.WordWrap
              color: Commons.Color.popups.text
              font.family: Style.menuFontFamily
              font.pixelSize: Style.font.title
            }
          }

          Text {
            id: floatLink
            anchors.right: actionLink.left
            anchors.rightMargin: Style.spacing.md
            anchors.verticalCenter: parent.verticalCenter
            text: "Float"
            textFormat: Text.PlainText
            color: Commons.Color.popups.text
            font.family: Style.menuFontFamily
            font.pixelSize: Style.font.body

            MouseArea {
              anchors.fill: parent
              onClicked: root.enterFloat()
            }
          }

          Text {
            id: actionLink
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            text: root.view === "shot" ? "Browse" : "Refresh"
            textFormat: Text.PlainText
            color: Commons.Color.popups.text
            font.family: Style.menuFontFamily
            font.pixelSize: Style.font.body

            MouseArea {
              anchors.fill: parent
              onClicked: root.view === "shot" ? root.showBrowser() : root.refreshBrowse()
            }
          }
        }

        Text {
          id: noticeText
          width: parent.width
          anchors.top: headerBar.bottom
          anchors.topMargin: root.notice !== "" ? Style.spacing.sm : 0
          height: root.notice === "" ? 0 : implicitHeight
          visible: root.notice !== ""
          text: root.notice
          textFormat: Text.PlainText
          wrapMode: Text.WordWrap
          color: Commons.Color.popups.text
          font.family: Style.menuFontFamily
          font.pixelSize: Style.font.body
        }

        Item {
          id: footer
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.bottom: parent.bottom
          height: root.rowHeight

          Row {
            id: footerStatus
            anchors.left: parent.left
            anchors.leftMargin: Style.spacing.sm
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.spacing.sm

            Rectangle {
              width: 8
              height: 8
              radius: 4
              anchors.verticalCenter: parent.verticalCenter
              color: root.peekStatus === "live"
                ? Commons.Color.accent
                : (root.peekStatus === "not-live" ? Commons.Color.urgent : Commons.Color.muted)
            }

            Text {
              anchors.verticalCenter: parent.verticalCenter
              text: root.peekStatus === "live"
                ? "Live"
                : (root.peekStatus === "not-live" ? "Not live" : "Off")
              textFormat: Text.PlainText
              color: Commons.Color.popups.text
              font.family: Style.menuFontFamily
              font.pixelSize: Style.font.body
            }
          }

          Text {
            id: hintText
            anchors.left: footerStatus.right
            anchors.leftMargin: Style.spacing.sm
            anchors.right: parent.right
            anchors.rightMargin: Style.spacing.sm
            anchors.verticalCenter: parent.verticalCenter
            horizontalAlignment: Text.AlignRight
            elide: Text.ElideLeft
            text: root.view === "shot"
              ? "Refresh · Return browse · F float · Esc close"
              : "Up Down · Return open · Backspace back · Esc close"
            textFormat: Text.PlainText
            color: Commons.Color.muted
            font.family: Style.menuFontFamily
            font.pixelSize: Style.font.body
          }
        }

        Flickable {
          id: browserFlick
          visible: root.view !== "shot"
          anchors.top: noticeText.bottom
          anchors.topMargin: Style.spacing.sm
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.bottom: footer.top
          clip: true
          focus: (root.opened || root.docked) && root.view !== "shot"
          boundsBehavior: Flickable.StopAtBounds
          contentWidth: width
          contentHeight: browserCol.height
          interactive: contentHeight > height
          Keys.onPressed: function(event) { root.browserKey(event) }

          Column {
            id: browserCol
            width: browserFlick.width

            Repeater {
              model: root.rows.length

              Rectangle {
                required property int index
                property var row: root.rows[index]
                width: browserCol.width
                height: root.rowHeight
                color: index === root.cursor && row && row.kind !== "header"
                  ? Commons.Color.menu.selectedBackground
                  : "transparent"

                Text {
                  anchors.fill: parent
                  anchors.leftMargin: Style.spacing.sm
                  anchors.rightMargin: Style.spacing.sm
                  verticalAlignment: Text.AlignVCenter
                  text: root.rowLabel(row)
                  textFormat: Text.PlainText
                  elide: Text.ElideRight
                  color: !row || row.kind === "header"
                    ? Commons.Color.muted
                    : (index === root.cursor ? Commons.Color.menu.selectedText : Commons.Color.popups.text)
                  font.family: Style.menuFontFamily
                  font.pixelSize: Style.font.body
                  font.bold: row && row.kind === "header"
                }

                MouseArea {
                  anchors.fill: parent
                  enabled: row && row.kind !== "header"
                  onClicked: root.activateRow(index)
                }
              }
            }
          }

          Text {
            visible: root.rows.length === 0 && root.pending === "" && root.notice === ""
            text: "Nothing cached yet"
            textFormat: Text.PlainText
            color: Commons.Color.muted
            font.family: Style.menuFontFamily
            font.pixelSize: Style.font.body
          }
        }

        Flickable {
          id: flick
          visible: root.view === "shot"
          anchors.top: noticeText.bottom
          anchors.topMargin: Style.spacing.sm
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.bottom: footer.top
          clip: true
          focus: (root.opened || root.docked) && root.view === "shot"
          boundsBehavior: Flickable.StopAtBounds
          contentWidth: width
          contentHeight: stage.height
          interactive: pair.height > height
          Keys.onPressed: function(event) {
            if (event.key === Qt.Key_Escape) {
              if (root.docked) root.undock()
              else root.close("")
              event.accepted = true
              return
            }
            if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
              root.show({ kind: "projects" })
              event.accepted = true
              return
            }
            if (event.key === Qt.Key_F) {
              root.enterFloat()
              event.accepted = true
              return
            }
            if (event.key === Qt.Key_Backspace && root.pageHold) {
              root.back()
              event.accepted = true
              return
            }
            if (event.key === Qt.Key_Up) {
              flick.contentY = Math.max(0, flick.contentY - root.rowHeight)
              event.accepted = true
              return
            }
            if (event.key === Qt.Key_Down) {
              flick.contentY = Math.min(
                Math.max(0, flick.contentHeight - flick.height),
                flick.contentY + root.rowHeight)
              event.accepted = true
            }
          }

          Item {
            id: stage
            width: flick.width
            height: root.stageHeight(flick.height, pair.height)

            Column {
              id: pair
              width: parent.width
              spacing: 0
              y: root.pairY(stage.height, pair.height)

              Image {
                id: shot
                width: flick.width
                asynchronous: true
                cache: false
                fillMode: Image.PreserveAspectFit
                horizontalAlignment: Image.AlignLeft
                verticalAlignment: Image.AlignTop
                source: root.shotSource
                sourceSize.width: Math.max(1, Math.round(width * ((root.docked ? dockWindow.devicePixelRatio : window.devicePixelRatio) || 1)))
                height: root.shotHere && implicitWidth > 0 ? width * implicitHeight / implicitWidth : 0
              }

              Text {
                width: parent.width
                visible: root.shotHere
                  && (root.imagePath === "" || shot.status === Image.Error || shot.status === Image.Null)
                height: visible ? implicitHeight : 0
                text: "No cached artboard"
                textFormat: Text.PlainText
                color: Commons.Color.popups.text
                font.family: Style.menuFontFamily
                font.pixelSize: Style.font.body
              }

              Repeater {
                model: root.boards

                Rectangle {
                  required property var modelData
                  required property int index
                  property string boardId: modelData ? modelData.id : ""
                  property string boardLabel: modelData ? modelData.name : ""
                  width: pair.width
                  height: root.rowHeight
                  color: boardId === root.nodeId && root.shotHere
                    ? Commons.Color.menu.selectedBackground
                    : "transparent"

                  Text {
                    anchors.fill: parent
                    anchors.leftMargin: Style.spacing.sm
                    anchors.rightMargin: Style.spacing.sm
                    verticalAlignment: Text.AlignVCenter
                    text: boardLabel
                    textFormat: Text.PlainText
                    elide: Text.ElideRight
                    color: boardId === root.nodeId && root.shotHere
                      ? Commons.Color.menu.selectedText
                      : Commons.Color.popups.text
                    font.family: Style.menuFontFamily
                    font.pixelSize: Style.font.body
                  }

                  MouseArea {
                    anchors.fill: parent
                    onClicked: root.rememberPlace(root.listedFileId, root.listedPageId, boardId)
                  }
                }
              }
            }
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
    WlrLayershell.keyboardFocus: root.floated && !root.passClicks ? WlrKeyboardFocus.OnDemand : WlrKeyboardFocus.None
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
      border.width: Math.max(1, Style.spacing.hairline)
      border.color: Commons.Color.popups.border
      clip: true

      Item {
        anchors.fill: parent
        focus: root.floated && !root.passClicks
        Keys.onPressed: function(event) {
          if (event.key === Qt.Key_F) {
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

      Item {
        id: floatHeader
        z: 2
        height: 32
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top

        Text {
          anchors.left: parent.left
          anchors.leftMargin: Style.spacing.sm
          anchors.right: passButton.left
          anchors.rightMargin: Style.spacing.sm
          anchors.verticalCenter: parent.verticalCenter
          text: root.headerText
          textFormat: Text.PlainText
          color: Commons.Color.popups.text
          font.family: Style.menuFontFamily
          font.pixelSize: Style.font.body
          elide: Text.ElideRight
        }

        Rectangle {
          id: passButton
          anchors.right: parent.right
          anchors.rightMargin: Style.spacing.sm
          anchors.verticalCenter: parent.verticalCenter
          width: passLabel.implicitWidth + Style.spacing.lg * 2
          height: 22
          radius: Style.cornerRadius
          color: root.passClicks ? Commons.Color.urgent : "transparent"
          border.width: Math.max(1, Style.spacing.hairline)
          border.color: Commons.Color.popups.border

          Text {
            id: passLabel
            anchors.centerIn: parent
            text: root.passClicks ? "Passing" : "Clicks"
            textFormat: Text.PlainText
            color: Commons.Color.popups.text
            font.family: Style.menuFontFamily
            font.pixelSize: Style.font.body
          }

          MouseArea {
            anchors.fill: parent
            onClicked: root.togglePassClicks()
          }
        }
      }

      Image {
        id: floatShot
        anchors.top: floatHeader.bottom
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        asynchronous: true
        cache: false
        fillMode: Image.PreserveAspectFit
        horizontalAlignment: Image.AlignHCenter
        verticalAlignment: Image.AlignVCenter
        source: root.shotSource
        sourceSize.width: Math.max(1, Math.round(width * (floatWindow.devicePixelRatio || 1)))
      }

      Text {
        anchors.centerIn: parent
        visible: root.floated && (root.imagePath === "" || floatShot.status === Image.Error || floatShot.status === Image.Null)
        text: "No cached artboard"
        textFormat: Text.PlainText
        color: Commons.Color.popups.text
        font.family: Style.menuFontFamily
        font.pixelSize: Style.font.body
      }

      Text {
        visible: root.peekStatus === "not-live"
        text: "not live"
        textFormat: Text.PlainText
        anchors.left: parent.left
        anchors.leftMargin: Style.spacing.sm
        anchors.bottom: parent.bottom
        color: Commons.Color.popups.text
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
          if (py < floatHeader.height) return "move"
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
