import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Commons as Commons
import qs.Ui

BarWidget {
  id: root
  moduleName: "fmchale.paper-peek"

  readonly property string home: Quickshell.env("HOME") || ""
  readonly property string statusPath: (Quickshell.env("XDG_STATE_HOME") || (home + "/.local/state")) + "/paper-peek/status"

  property string peekStatus: "off"

  implicitWidth: vertical ? barSize : Style.bar.statusSlot
  implicitHeight: vertical ? Style.bar.statusSlot : barSize

  function applyStatus(text) {
    var word = String(text || "").trim()
    if (word === "live" || word === "not-live" || word === "off") root.peekStatus = word
  }

  function openDrawer() {
    IpcRegistry.call("fmchale.paper-peek", "open", [])
  }

  FileView {
    path: root.statusPath
    watchChanges: true
    blockLoading: true
    printErrors: false
    onLoaded: root.applyStatus(text())
    onFileChanged: reload()
  }

  WidgetButton {
    anchors.fill: parent
    bar: root.bar
    keepSpace: true
    text: ""
    labelVisible: false
    hasVisualContent: true
    tooltipText: root.peekStatus === "live" ? "Live" : (root.peekStatus === "not-live" ? "Not live" : "Off")
    onPressed: root.openDrawer()

    Rectangle {
      width: 8
      height: 8
      radius: 4
      anchors.centerIn: parent
      color: root.peekStatus === "live" ? "#6fbf73" : (root.peekStatus === "not-live" ? Commons.Color.urgent : Commons.Color.muted)
    }
  }
}
