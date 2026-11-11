import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "theme-green.js" as ThemeGreen

BarWidget {
  id: root
  moduleName: "binaryfever.paper-peek"

  readonly property string home: Quickshell.env("HOME") || ""
  readonly property string statusPath: (Quickshell.env("XDG_STATE_HOME") || (home + "/.local/state")) + "/paper-peek/status"

  property string peekStatus: "off"
  property bool hasThemeGreen: false
  property color themeGreen: Commons.Color.accent
  readonly property color liveColor: hasThemeGreen ? themeGreen : Commons.Color.accent
  readonly property string themeColorsPath: home + "/.local/state/omarchy/current/theme/colors.toml"

  function applyThemeGreen(raw) {
    var color = ThemeGreen.greenIn(raw)
    if (color !== "") {
      root.themeGreen = color
      root.hasThemeGreen = true
      return
    }
    root.hasThemeGreen = false
  }

  implicitWidth: vertical ? barSize : Style.bar.iconSlot
  implicitHeight: vertical ? Style.bar.iconSlot : barSize

  function applyStatus(text) {
    var word = String(text || "").trim()
    if (word === "live" || word === "not-live" || word === "off") root.peekStatus = word
  }

  function openDrawer() {
    IpcRegistry.call("binaryfever.paper-peek", "open", [])
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
    id: themeColors
    path: root.themeColorsPath
    watchChanges: false
    blockLoading: false
    printErrors: false
    onLoaded: root.applyThemeGreen(text())
    onLoadFailed: root.applyThemeGreen("")
  }

  Connections {
    target: Commons.Color
    function onShellValuesChanged() {
      themeColors.reload()
    }
  }

  WidgetButton {
    anchors.fill: parent
    bar: root.bar
    keepSpace: true
    // The bar font's framed-picture glyph, nf-md-image-outline. An outline
    // weight so it sits with the other status icons rather than shouting over
    // them, and the colour carries the state the dot used to carry alone.
    text: "󰥶"
    foreground: root.peekStatus === "live"
      ? root.liveColor
      : (root.peekStatus === "not-live" ? Commons.Color.urgent : Commons.Color.muted)
    // The same three words the drawer's footer draws. The bar deliberately
    // does not load the drawer's layout module for them, so a test holds these
    // literals against statusWord to stop the two drifting apart.
    tooltipText: root.peekStatus === "live" ? "Connected" : (root.peekStatus === "not-live" ? "Not connected" : "No artboard")
    onPressed: root.openDrawer()
  }
}
