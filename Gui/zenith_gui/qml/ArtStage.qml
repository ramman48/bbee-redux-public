import QtQuick

// A mod's own pictures on the right of the window. One figure is put by its face; a party stands on a
// ground line, the first in front. Each picture carries its own measurements (controller.py: _arts).
// Left of `clearFrom` nothing of a picture shows, right of `clearTo` all of it: words stay readable.
// Each is drawn through shaders/figure.frag: a rim of the mod's colour, a sheen that crosses now and then, and
// a signal's tear as it leaves and arrives. The figures shift a little against the pointer, the front one most.
//
// The stage is the size of the window in real pixels, so a picture is drawn once at the screen's own
// resolution. Where things go is given in the layout's units (`u` real pixels each, `across` of them wide).
Item {
    id: root
    property var arts: []
    property real fade: 1          // 0..1: the pictures leave and come back when the mod changes
    property real lit: 1           // 1 when the mod is switched on, lower when it is off
    property real u: 1
    property real across: 1280
    property real focusX: across - 300
    property real focusY: 216
    property real groundY: 612
    property real zoom: 1
    property real partyZoom: 1     // a party is drawn smaller where there is less room
    property real clearFrom: 700
    property real clearTo: 900
    readonly property real tall: 720 * u    // the height a picture's own measurements are fractions of
    property color tone: Theme.cyan
    property real sweep: -0.4
    property real seed: 0
    SequentialAnimation on sweep {
        loops: Animation.Infinite
        running: !Theme.calm && Fx.full && root.arts.length > 0
        PauseAnimation { duration: 4200 }
        NumberAnimation { from: -0.4; to: 1.4; duration: 1700; easing.type: Easing.InOutSine }
    }
    Timer { interval: 45; repeat: true; running: root.fade < 0.999 && !Theme.calm; onTriggered: root.seed = Math.random() }
    // the pointer, smoothed: the room turns a little toward it
    property real lookX: Theme.calm ? 0 : Fx.pointer.x - 0.5
    property real lookY: Theme.calm ? 0 : Fx.pointer.y - 0.5
    Behavior on lookX { SmoothedAnimation { velocity: 0.6 } }
    Behavior on lookY { SmoothedAnimation { velocity: 0.6 } }

    // a party that would stand past the right edge is moved left as one
    readonly property real nudge: {
        let over = 0
        const unit = partyZoom * zoom * tall
        for (let i = 0; i < arts.length; ++i) {
            const a = arts[i]
            if (!a.stand) continue
            const k = a.tall * unit / Math.max(1, (a.b - a.t) * a.h)
            over = Math.max(over, focusX * u + a.dx * unit + (a.r - a.ax) * a.w * k - (across - 10) * u)
        }
        return over
    }

    Repeater {
        model: root.arts
        delegate: Item {
            id: figure
            required property int index
            required property var modelData
            readonly property var a: modelData
            readonly property real unit: (a.stand ? root.partyZoom : 1) * root.zoom * root.tall
            readonly property real k: a.tall * unit / Math.max(1, (a.b - a.t) * a.h)
            readonly property real picW: a.w * k
            readonly property real picH: a.h * k
            readonly property real depth: 1 - index * 0.3
            readonly property real px: root.focusX * root.u + a.dx * unit - a.ax * picW - (a.stand ? root.nudge : 0)
                                       + (1 - root.fade) * (18 + 10 * index) * root.u - root.lookX * 22 * depth * root.u
            readonly property real py: (a.stand ? root.groundY * root.u - a.dy * unit : root.focusY * root.u + a.dy * unit) - a.ay * picH
            // the veil, in the picture's own widths (the shader draws it)
            readonly property real p0: (root.clearFrom * root.u - px) / Math.max(1, picW)
            readonly property real p1: (root.clearTo * root.u - px) / Math.max(1, picW)
            z: a.z

            Image {
                id: picture
                visible: false
                source: figure.a.src
                mipmap: true
                width: figure.picW; height: figure.picH
            }
            ShaderEffect {
                objectName: "figure"
                x: figure.px
                y: figure.py + (bob - root.lookY * 10 * figure.depth) * root.u
                width: figure.picW; height: figure.picH
                property var src: picture
                property real p0: figure.p0
                property real p1: figure.p1
                property real fade: root.fade
                property real sweep: root.sweep - figure.index * 0.12
                property real rim: Fx.full ? 0.9 : 0.55
                property real seed: root.seed + figure.index * 0.37
                property vector2d texel: Qt.vector2d(1 / Math.max(1, width), 1 / Math.max(1, height))
                property color tone: root.tone
                fragmentShader: "shaders/figure.frag.qsb"
                visible: picture.status === Image.Ready && root.fade > 0.001
                opacity: root.lit * figure.a.dim
                property real bob: 0
                SequentialAnimation on bob {
                    loops: Animation.Infinite
                    running: !Theme.calm
                    NumberAnimation { to: -7 + 2 * figure.index; duration: 4800 + 700 * figure.index; easing.type: Easing.InOutSine }
                    NumberAnimation { to: 5 - 2 * figure.index; duration: 4800 + 700 * figure.index; easing.type: Easing.InOutSine }
                }
            }
        }
    }
}
