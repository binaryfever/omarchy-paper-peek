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
  readonly property string cacheDir: Quickshell.env("PAPER_PEEK_CACHE") || (home + "/.cache/paper-peek")
  readonly property int drawerWidth: 480

  property string fileId: ""
  property string pageId: ""
  property string nodeId: ""
  property string projectName: ""
  property string pageName: ""
  property string artboardName: ""
  property string imagePath: ""

  readonly property string headerText: {
    if (fileId === "") return "Paper Peek"
    var project = projectName !== "" ? projectName : fileId
    var page = pageName !== "" ? pageName : pageId
    var artboard = artboardName !== "" ? artboardName : nodeId
    if (page === "") return project + " › " + artboard
    return project + " › " + page + " › " + artboard
  }

  function open(payloadJson) {
    stateFile.reload()
    readCurrent()
    opened = true
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
    pageName = nameFor(pagesFile.text(), "pages", pageId)
    artboardName = nameFor(artboardsFile.text(), "artboards", nodeId)
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
    path: root.fileId === "" ? root.statePath : root.cacheDir + "/pages/" + root.fileId + ".json"
    watchChanges: true
    blockLoading: true
    printErrors: false
    onLoaded: root.readNames()
    onFileChanged: reload()
  }

  FileView {
    id: artboardsFile
    path: root.fileId === "" || root.pageId === ""
      ? root.statePath
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

        Text {
          id: header
          width: parent.width
          text: root.headerText
          textFormat: Text.PlainText
          color: Commons.Color.popups.text
          font.family: Style.menuFontFamily
          font.pixelSize: Style.font.title
          elide: Text.ElideRight
        }

        Flickable {
          id: flick
          anchors.top: header.bottom
          anchors.topMargin: Style.spacing.sm
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.bottom: parent.bottom
          clip: true
          focus: root.opened
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
            source: root.imagePath === "" ? "" : ("file://" + root.imagePath)
            sourceSize.width: Math.max(1, Math.round(width * (window.devicePixelRatio || 1)))
            height: implicitWidth > 0 ? width * implicitHeight / implicitWidth : 0
          }
        }

        Text {
          anchors.top: header.bottom
          anchors.topMargin: Style.spacing.sm
          visible: root.opened && (root.imagePath === "" || shot.status === Image.Error || shot.status === Image.Null)
          text: "No cached artboard"
          textFormat: Text.PlainText
          color: Commons.Color.popups.text
          font.family: Style.menuFontFamily
          font.pixelSize: Style.font.body
        }
      }
    }
  }
}
