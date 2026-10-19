import QtQuick

// Text that arrives decoding: each letter cycles through code glyphs, then settles, left to right. It runs when
// `run` turns true and again when the text changes while shown; with motion calm it simply shows the text. Its size
// is the finished text's, so nothing round it moves while it decodes.
Item {
    id: dt
    property string text: ""
    property bool run: true
    property alias font: label.font
    property alias color: label.color
    property int duration: Math.min(900, 260 + text.length * 28)
    property real p: 1
    readonly property string glyphs: "0123456789ABCDEF#%&/<>[]{}=+*"
    implicitWidth: measure.implicitWidth
    implicitHeight: measure.implicitHeight

    function start() { if (Theme.calm) { anim.stop(); dt.p = 1; return } anim.restart() }
    Component.onCompleted: if (run) start(); else p = 0
    onRunChanged: if (run) start(); else { anim.stop(); dt.p = 0 }
    onTextChanged: if (run && visible) start()

    Text { id: measure; visible: false; text: dt.text; font: label.font }
    Text {
        id: label
        text: {
            const t = dt.text, p = dt.p
            if (p >= 1) return t
            if (!dt.run) return ""
            let out = ""
            const front = p * (t.length + 6)
            for (let i = 0; i < t.length; i++) {
                const c = t[i]
                if (i < front - 6 || c === " ") out += c
                else if (i < front) out += dt.glyphs[Math.floor(Math.random() * dt.glyphs.length)]
                else out += " "
            }
            return out
        }
    }
    NumberAnimation { id: anim; target: dt; property: "p"; from: 0; to: 1; duration: dt.duration }
}
