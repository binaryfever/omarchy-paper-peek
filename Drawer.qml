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
  readonly property int drawerWidth: 480
  readonly property int rowHeight: Style.font.body + Style.spacing.lg * 2

  property string fileId: ""
  property string pageId: ""
  property string nodeId: ""
  property string projectName: ""
  property string pageName: ""
  property string artboardName: ""
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
  property string browsePageId: ""
  property string browseProjectName: ""
  property string browsePageName: ""

  function applyStatus(text) {
    var word = String(text || "").trim()
    if (word === "live" || word === "not-live" || word === "off") root.peekStatus = word
  }

  function probeStatus() {
    if (statusProbe.running) return
    statusProbe.running = true
  }

  readonly property string headerText: {
    if (root.view === "projects") return "Projects"
    if (root.view === "pages") return root.browseProjectName !== "" ? root.browseProjectName : root.browseFileId
    if (root.view === "artboards") {
      var project = root.browseProjectName !== "" ? root.browseProjectName : root.browseFileId
      var page = root.browsePageName !== "" ? root.browsePageName : root.browsePageId
      return project + " › " + page
    }
    if (fileId === "") return "Paper Peek"
    var shotProject = projectName !== "" ? projectName : fileId
    var shotPage = pageName !== "" ? pageName : pageId
    var artboard = artboardName !== "" ? artboardName : nodeId
    if (shotPage === "") return shotProject + " › " + artboard
    return shotProject + " › " + shotPage + " › " + artboard
  }

  function open(payloadJson) {
    stateFile.reload()
    readCurrent()
    opened = true
    notice = ""
    view = fileId !== "" && nodeId !== "" ? "shot" : "projects"
    startCommand(["resolve"], "resolve")
  }

  function refreshShot() {
    if (fileId === "" || nodeId === "") return
    if (shotFetch.running) return
    shotFetch.command = [fetchScript, "shot", fileId, nodeId]
    shotFetch.running = true
  }

  function watchArtboard() {
    if (!opened || peekStatus !== "live") return
    if (fileId === "" || nodeId === "") return
    if (watchFetch.running || shotFetch.running) return
    watchFetch.command = [fetchScript, "watch", fileId, nodeId]
    watchFetch.running = true
  }

  function close(payloadJson) {
    opened = false
  }

  function toggle() {
    if (opened) close("")
    else open("")
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
    artboardName = fileId === "" || pageId === ""
      ? ""
      : nameFor(artboardsFile.text(), "artboards", nodeId)
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
    if (!root.opened) return
    var parsed = null
    try {
      parsed = JSON.parse(String(text || ""))
    } catch (e) {
      parsed = null
    }
    if (name === "resolve") root.applyResolve(parsed)
    else if (name === "project") root.applyProject(parsed)
    else if (name === "rows") root.applyRows(parsed)
    else if (name === "remember") root.applyRemember()
  }

  function applyResolve(parsed) {
    if (parsed && parsed.kind === "projects") {
      root.notice = typeof parsed.notice === "string" ? parsed.notice : ""
      root.view = "projects"
      root.startCommand(["browser", "projects"], "rows")
      return
    }
    if (!parsed && (root.fileId === "" || root.nodeId === "")) {
      root.view = "projects"
      root.startCommand(["browser", "projects"], "rows")
      return
    }
    root.view = "shot"
    root.notice = ""
    root.readCurrent()
    root.refreshShot()
  }

  function applyProject(parsed) {
    if (!parsed || parsed.kind === "shot") {
      root.view = "shot"
      root.notice = ""
      root.readCurrent()
      root.refreshShot()
      return
    }
    root.notice = typeof parsed.notice === "string" ? parsed.notice : ""
    if (parsed.kind === "pages" && root.safeId(parsed.fileId) !== "") {
      root.browseFileId = parsed.fileId
      root.view = "pages"
      root.startCommand(["browser", "pages", parsed.fileId], "rows")
      return
    }
    root.view = "projects"
    root.startCommand(["browser", "projects"], "rows")
  }

  function applyRows(parsed) {
    root.rows = parsed && Array.isArray(parsed.rows) ? parsed.rows : []
    root.cursor = root.firstRow()
    browserFlick.contentY = 0
  }

  function applyRemember() {
    root.readCurrent()
    root.view = "shot"
    root.notice = ""
    root.refreshShot()
  }

  function showBrowser() {
    root.notice = ""
    root.view = "projects"
    root.startCommand(["browser", "projects"], "rows")
  }

  function refreshBrowse() {
    if (root.view === "pages" && root.browseFileId !== "") {
      root.startCommand(["browser", "pages", root.browseFileId, "--refresh"], "rows")
      return
    }
    if (root.view === "artboards" && root.browseFileId !== "" && root.browsePageId !== "") {
      root.startCommand(["browser", "artboards", root.browseFileId, root.browsePageId, "--refresh"], "rows")
      return
    }
    root.startCommand(["browser", "projects", "--refresh"], "rows")
  }

  function closeBrowser() {
    if (root.fileId !== "" && root.nodeId !== "") {
      root.view = "shot"
      root.notice = ""
      return
    }
    root.close("")
  }

  function back() {
    if (root.view === "artboards") {
      root.view = "pages"
      root.startCommand(["browser", "pages", root.browseFileId], "rows")
      return
    }
    if (root.view === "pages") {
      root.view = "projects"
      root.startCommand(["browser", "projects"], "rows")
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
      root.browseFileId = row.fileId
      root.browseProjectName = row.label || ""
      root.startCommand(["resolve-project", row.fileId], "project")
      return
    }
    if (row.kind === "page") {
      root.browseFileId = row.fileId
      root.browsePageId = row.pageId
      root.browsePageName = row.label || ""
      root.view = "artboards"
      root.startCommand(["browser", "artboards", row.fileId, row.pageId], "rows")
      return
    }
    if (row.kind === "recent" || row.kind === "artboard")
      root.startCommand(["remember", row.fileId, row.pageId, row.nodeId], "remember")
  }

  function rowLabel(row) {
    if (!row) return ""
    if (row.kind === "recent" && row.detail) return row.label + " · " + row.detail
    return row.label || ""
  }

  function browserKey(event) {
    if (event.key === Qt.Key_Up) root.moveCursor(-1)
    else if (event.key === Qt.Key_Down) root.moveCursor(1)
    else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) root.activateRow(root.cursor)
    else if (event.key === Qt.Key_Backspace) root.back()
    else if (event.key === Qt.Key_Escape) root.closeBrowser()
    else return
    event.accepted = true
  }

  Process {
    id: shotFetch
    running: false
    command: [root.fetchScript, "shot", "x", "x"]
    onExited: function(exitCode) {
      if (exitCode === 0) root.shotRevision += 1
    }
  }

  Process {
    id: commandFetch
    running: false
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
      root.open("")
      return "ok"
    }
    function close(): string {
      root.close("")
      return "ok"
    }
    function toggle(): string {
      root.toggle()
      return root.opened ? "open" : "closed"
    }
    function status(): string {
      return root.peekStatus
    }
  }

  Timer {
    interval: 2000
    repeat: true
    running: true
    triggeredOnStart: true
    onTriggered: root.probeStatus()
  }

  Timer {
    interval: 2000
    repeat: true
    running: root.opened && root.peekStatus === "live" && root.fileId !== "" && root.nodeId !== ""
    onTriggered: root.watchArtboard()
  }

  Process {
    id: watchFetch
    running: false
    command: [root.fetchScript, "watch", "x", "x"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        if (!root.opened) return
        if (String(text || "").trim() === "changed") root.refreshShot()
      }
    }
  }

  Process {
    id: statusProbe
    running: false
    command: [root.fetchScript, "status"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyStatus(text)
    }
  }

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
    id: artboardsFile
    path: root.fileId === "" || root.pageId === ""
      ? root.absentCatalog
      : root.cacheDir + "/artboards/" + root.fileId + "/" + root.pageId + ".json"
    watchChanges: true
    blockLoading: true
    printErrors: false
    onLoaded: root.readNames()
    onFileChanged: reload()
  }

  PanelWindow {
    id: window

    property real reveal: root.opened ? 1 : 0

    Behavior on reveal {
      NumberAnimation { duration: 180; easing.type: Easing.OutCubic }
    }

    visible: reveal > 0.01
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
      x: (window.screen ? window.screen.width : width) - width * window.reveal
      color: Commons.Color.popups.background
      radius: Style.cornerRadius

      Rectangle {
        width: Math.max(1, Style.spacing.hairline)
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        anchors.left: parent.left
        color: Commons.Color.popups.border
      }

      Item {
        id: body
        anchors.fill: parent
        anchors.margins: Style.spacing.popupPadding

        Item {
          id: headerBar
          width: parent.width
          height: Math.max(header.implicitHeight, actionLink.implicitHeight, backLink.implicitHeight)

          Text {
            id: backLink
            visible: root.view === "pages" || root.view === "artboards"
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

          Text {
            id: header
            anchors.left: backLink.visible ? backLink.right : parent.left
            anchors.leftMargin: backLink.visible ? Style.spacing.sm : 0
            anchors.right: actionLink.left
            anchors.rightMargin: Style.spacing.sm
            anchors.verticalCenter: parent.verticalCenter
            text: root.headerText
            textFormat: Text.PlainText
            color: Commons.Color.popups.text
            font.family: Style.menuFontFamily
            font.pixelSize: Style.font.title
            elide: Text.ElideRight
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

        Flickable {
          id: browserFlick
          visible: root.view !== "shot"
          anchors.top: noticeText.bottom
          anchors.topMargin: Style.spacing.sm
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.bottom: parent.bottom
          anchors.bottomMargin: root.peekStatus === "not-live" ? notLive.implicitHeight + Style.spacing.sm : 0
          clip: true
          focus: root.opened && root.view !== "shot"
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
          anchors.bottom: parent.bottom
          anchors.bottomMargin: root.peekStatus === "not-live" ? notLive.implicitHeight + Style.spacing.sm : 0
          clip: true
          focus: root.opened && root.view === "shot"
          boundsBehavior: Flickable.StopAtBounds
          contentWidth: width
          contentHeight: shot.height
          interactive: contentHeight > height
          Keys.onEscapePressed: function(event) {
            root.close("")
            event.accepted = true
          }

          Image {
            id: shot
            width: flick.width
            asynchronous: true
            cache: false
            fillMode: Image.PreserveAspectFit
            horizontalAlignment: Image.AlignLeft
            verticalAlignment: Image.AlignTop
            source: root.imagePath === "" ? "" : (Util.fileUrl(root.imagePath) + (root.shotRevision > 0 ? ("?v=" + root.shotRevision) : ""))
            sourceSize.width: Math.max(1, Math.round(width * (window.devicePixelRatio || 1)))
            height: implicitWidth > 0 ? width * implicitHeight / implicitWidth : 0
          }
        }

        Text {
          anchors.top: noticeText.bottom
          anchors.topMargin: Style.spacing.sm
          visible: root.view === "shot" && root.opened && (root.imagePath === "" || shot.status === Image.Error || shot.status === Image.Null)
          text: "No cached artboard"
          textFormat: Text.PlainText
          color: Commons.Color.popups.text
          font.family: Style.menuFontFamily
          font.pixelSize: Style.font.body
        }

        Text {
          id: notLive
          z: 1
          visible: root.peekStatus === "not-live"
          text: "not live"
          textFormat: Text.PlainText
          anchors.left: parent.left
          anchors.bottom: parent.bottom
          color: Commons.Color.popups.text
          font.family: Style.menuFontFamily
          font.pixelSize: Style.font.body
        }
      }
    }
  }
}
