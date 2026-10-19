import QtQuick

// The window opening: over a dark veil the Zenith mark arrives as a signal (shaders/reveal.frag) inside two rings, flares
// with a shock wave on the opening sound's hit (1.18 s), then flies to its place in the header as the veil lifts and the
// pages build in underneath. It takes no input. Calm motion skips it.
Item {
    id: root
    property real lw: 1280
    property real lh: 720
    property rect target: Qt.rect(25, 14, 46, 46)        // the header mark, layout units
    property real unit: 1
    readonly property bool playing: run.running
    property real veil: Theme.calm ? 0 : 1
    property real p: 0           // the mark resolving
    property real flare: 0
    property real fly: 0         // 0 at the centre .. 1 in the header
    property real rings: 0
    property real seed: 0
    signal landed()
    enabled: false
    visible: veil > 0.001 || run.running
    function start() { if (Theme.calm) { root.veil = 0; root.landed(); return } run.restart() }

    Timer { interval: 50; repeat: true; running: root.visible && root.p < 1; onTriggered: root.seed = Math.random() }

    SequentialAnimation {
        id: run
        PauseAnimation { duration: 120 }
        ParallelAnimation {
            NumberAnimation { target: root; property: "p"; from: 0; to: 1; duration: 1000; easing.type: Easing.InOutSine }
            NumberAnimation { target: root; property: "rings"; from: 0; to: 1; duration: 1060; easing.type: Easing.OutCubic }
        }
        ScriptAction {
            script: {
                const c = root.mapToItem(null, root.lw / 2, root.lh / 2)
                Fx.shock(c.x, c.y, 0.8); Fx.burst("#4fdcf0", 0.22)
                root.flare = 1
            }
        }
        ParallelAnimation {
            NumberAnimation { target: root; property: "flare"; to: 0; duration: 420; easing.type: Easing.OutCubic }
            SequentialAnimation {
                PauseAnimation { duration: 90 }
                NumberAnimation { target: root; property: "fly"; from: 0; to: 1; duration: 560; easing.type: Easing.InOutCubic }
            }
            NumberAnimation { target: root; property: "veil"; to: 0; duration: 620; easing.type: Easing.InOutQuad }
            NumberAnimation { target: root; property: "rings"; to: 1.6; duration: 520; easing.type: Easing.OutCubic }
        }
        ScriptAction { script: root.landed() }
    }

    Rectangle { anchors.fill: parent; color: "#05070b"; opacity: root.veil }

    // two rings round the mark: they open out with it, and burst wide on the flare
    Repeater {
        model: 2
        delegate: Rectangle {
            required property int index
            readonly property real size: (index ? 330 : 250) * root.rings
            x: root.lw / 2 - size / 2; y: root.lh / 2 - size / 2
            width: size; height: size; radius: size / 2
            color: "transparent"
            border.color: index ? Theme.rose : Theme.cyan; border.width: 1.2
            opacity: Math.min(1, root.rings * 2) * Math.max(0, 1 - Math.max(0, root.rings - 1) * 1.6) * (index ? 0.5 : 0.8)
            rotation: root.rings * (index ? -90 : 120)
        }
    }

    Image { id: logo; source: Qt.resolvedUrl("../../art/logo/zenith_logo.png"); sourceSize: Qt.size(512, 512); visible: false; mipmap: true }
    ShaderEffect {
        readonly property real big: 190
        readonly property real cx: root.lw / 2 + (root.target.x + root.target.width / 2 - root.lw / 2) * root.fly
        readonly property real cy: root.lh / 2 + (root.target.y + root.target.height / 2 - root.lh / 2) * root.fly
        readonly property real s: big + (root.target.width - big) * root.fly
        x: cx - s / 2; y: cy - s / 2; width: s; height: s
        visible: root.fly < 1
        property var src: logo
        property real p: root.p
        property real seed: root.seed
        property real flare: root.flare
        property color tint: Theme.cyan
        fragmentShader: "shaders/reveal.frag.qsb"
    }
}
