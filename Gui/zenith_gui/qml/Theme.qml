pragma Singleton
import QtQuick

// The one place colours, type and timing are written down. Measured against the game's own menus:
// near-black cool panels, thin light rules with end ticks, bracket marks on the chosen row, hexagon
// badges, and its two typefaces (Aldrich for labels, Chakra Petch for reading text).
QtObject {
    readonly property color bg: "#05070b"
    readonly property color panel: "#0a0d14"
    readonly property color line: "#c9d3e0"
    readonly property color text: "#e9eef6"
    readonly property color dim: "#8d97a9"
    readonly property color faint: "#7a8599"       // small print: 4.5 to 1 or better on the page and on a chosen row
    readonly property color cyan: "#4fdcf0"
    readonly property color rose: "#ff3f6c"
    readonly property color amber: "#ffb657"

    readonly property string display: "Aldrich"
    readonly property string body: "Chakra Petch"
    readonly property string mono: "Share Tech Mono"

    readonly property int fast: 140
    readonly property int base: 280
    readonly property int slow: 560

    // the person asked for a calm window (Options): nothing drifts or idles; things still answer a click
    property bool calm: false

    // The screens are laid out for 1280 x 720 and drawn at one scale for the window's real size (Main.qml sets
    // both). `hair` is one whole pixel in layout units, so a thin line stays sharp at any scale, and `ink` is
    // the size in real pixels a drawn shape is made at.
    property real unit: 1
    property real dpr: 1
    readonly property real hair: Math.max(1, Math.round(unit)) / unit
    function ink(w, h) { return Qt.size(Math.max(1, Math.ceil(w * unit * dpr - 0.01)), Math.max(1, Math.ceil(h * unit * dpr - 0.01))) }

    // The keyboard. `modal`: a question or the progress screen is up, and what is behind it is switched off.
    // `keys`: from a Tab until the next mouse press, the control the keyboard is on shows its mark.
    property bool modal: false
    property bool keys: false
}
