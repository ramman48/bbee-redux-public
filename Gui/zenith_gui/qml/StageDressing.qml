import QtQuick
import QtQuick.Particles
import Qt5Compat.GraphicalEffects

// What stands round the featured mod's pictures, behind them, in the layout's units: its name in huge outlined letters
// drifting across the back of the room, a floor of light under it (a lit disc with turning rings and a tick ring,
// laid flat), and sparks rising off that floor. All of it takes the mod's colour and leaves and comes back with it.
Item {
    id: root
    property string name: ""
    property color tone: Theme.cyan
    property real focusX: 900
    property real groundY: 614
    property real on: 1           // 0..1: the room shows a mod's pictures
    property real swap: 1         // 0..1: it leaves and comes back when the mod changes
    property real lit: 1          // lower when the mod is off
    property real clearFrom: 610  // the words' side ends here
    readonly property real shows: on * swap

    // ---- the name, drifting -------------------------------------------------------------------------------------
    Item {
        id: nameBand
        x: root.clearFrom - 60; y: root.height * 0.18
        width: root.width - x; height: 300
        clip: true
        opacity: root.shows * 0.9
        visible: root.name !== "" && opacity > 0.01
        layer.enabled: true
        layer.effect: ShaderEffect {
            property real from: 0.0
            property real to: 0.34
            property real edge: 0.0
            fragmentShader: "shaders/fadeh.frag.qsb"
        }
        property real drift: 0
        NumberAnimation on drift { from: 0; to: 1; duration: 60000; loops: Animation.Infinite; running: !Theme.calm && nameBand.visible }
        Row {
            id: words
            y: 10 + (1 - root.swap) * 26
            x: -width / 2 * nameBand.drift
            spacing: 70
            Repeater {
                model: 4
                delegate: Text {
                    required property int index
                    text: root.name
                    font.family: Theme.display; font.pixelSize: 232; font.letterSpacing: 6
                    color: Qt.rgba(root.tone.r, root.tone.g, root.tone.b, 0.035)
                    style: Text.Outline
                    styleColor: Qt.rgba(root.tone.r, root.tone.g, root.tone.b, index % 2 ? 0.16 : 0.26)
                }
            }
        }
    }

    // ---- the floor of light ---------------------------------------------------------------------------------------
    Item {
        id: floor
        width: 640; height: 640
        x: root.focusX - width / 2
        y: root.groundY - height / 2
        opacity: root.shows * root.lit
        visible: opacity > 0.01
        transform: Rotation { origin.x: floor.width / 2; origin.y: floor.height / 2; axis { x: 1; y: 0; z: 0 } angle: 74 }
        property real turn: 0
        NumberAnimation on turn { from: 0; to: 360; duration: 48000; loops: Animation.Infinite; running: !Theme.calm && floor.visible }
        RadialGradient {
            anchors.centerIn: parent
            width: 620 * (0.9 + 0.1 * root.swap); height: width
            gradient: Gradient {
                GradientStop { position: 0.0; color: Qt.rgba(root.tone.r, root.tone.g, root.tone.b, 0.34) }
                GradientStop { position: 0.22; color: Qt.rgba(root.tone.r, root.tone.g, root.tone.b, 0.12) }
                GradientStop { position: 0.5; color: Qt.rgba(root.tone.r, root.tone.g, root.tone.b, 0.0) }
            }
        }
        Repeater {
            model: [ { s: 600, w: 1.4, a: 0.30, k: 1 }, { s: 470, w: 2.2, a: 0.55, k: -1.6 }, { s: 300, w: 1.2, a: 0.40, k: 2.4 } ]
            delegate: Rectangle {
                required property var modelData
                anchors.centerIn: parent
                width: modelData.s; height: width; radius: width / 2
                color: "transparent"
                border.width: modelData.w
                border.color: Qt.rgba(root.tone.r, root.tone.g, root.tone.b, modelData.a)
                rotation: floor.turn * modelData.k
                // a gap in each ring so its turning shows
                Rectangle {
                    width: 46; height: modelData.w * 4
                    x: parent.width / 2 - width / 2; y: -height / 2 + modelData.w / 2
                    color: "#05070b"
                }
                Rectangle {
                    width: 18; height: modelData.w * 4
                    x: parent.width / 2 - width / 2; y: parent.height - height / 2 - modelData.w / 2
                    color: "#05070b"
                }
            }
        }
        // the tick ring
        Repeater {
            model: 60
            delegate: Rectangle {
                required property int index
                width: index % 5 === 0 ? 3 : 1.5; height: index % 5 === 0 ? 22 : 11
                x: floor.width / 2 - width / 2; y: floor.height / 2 - 262
                color: Qt.rgba(root.tone.r, root.tone.g, root.tone.b, index % 5 === 0 ? 0.55 : 0.28)
                transform: Rotation { origin.x: width / 2; origin.y: 262; angle: index * 6 - floor.turn * 0.5 }
            }
        }
        // the hot centre
        Rectangle {
            anchors.centerIn: parent
            width: 330; height: 330; radius: 165
            color: "transparent"
            border.width: 70
            border.color: Qt.rgba(root.tone.r, root.tone.g, root.tone.b, 0.05)
        }
        Rectangle {
            anchors.centerIn: parent
            width: 190; height: 190; radius: 95
            color: Qt.rgba(root.tone.r, root.tone.g, root.tone.b, 0.10)
        }
    }

    // ---- sparks off the floor -------------------------------------------------------------------------------------
    ParticleSystem {
        id: sparks
        running: Fx.full && root.shows > 0.2 && root.visible
    }
    ImageParticle {
        system: sparks
        source: "qrc:///particleresources/glowdot.png"
        color: root.tone
        colorVariation: 0.08
        alpha: 0.75
        alphaVariation: 0.25
        entryEffect: ImageParticle.Fade
        opacity: root.shows * root.lit
    }
    Emitter {
        system: sparks
        x: root.focusX - 230; y: root.groundY - 30
        width: 460; height: 60
        shape: EllipseShape { fill: true }
        emitRate: 16
        lifeSpan: 4200; lifeSpanVariation: 1400
        size: 9; sizeVariation: 6; endSize: 2
        velocity: AngleDirection { angle: 270; angleVariation: 14; magnitude: 34; magnitudeVariation: 22 }
        acceleration: AngleDirection { angle: 270; magnitude: 4 }
    }
    Wander { system: sparks; xVariance: 30; pace: 40 }
}
