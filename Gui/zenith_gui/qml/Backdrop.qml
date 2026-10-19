import QtQuick
import QtQuick.Particles

// The room behind every page (shaders/room.frag: the grid floor, the horizon, haze, falling light, data rain), and
// motes of light rising through it on the GPU. In the light setting the room stays still and the motes stop.
Item {
    id: root
    property real reveal: 0
    property real heat: 0          // 0 cyan .. 1 rose: a page can warm the room (Redux, powered)
    property real horizon: 0.62    // where the floor meets the hall; a page that looks down at a floor raises it
    Behavior on horizon { NumberAnimation { duration: 900; easing.type: Easing.InOutCubic } }
    Behavior on heat { NumberAnimation { duration: 900; easing.type: Easing.InOutCubic } }

    ShaderEffect {
        anchors.fill: parent
        property real time: 0
        property real intro: root.reveal
        property vector2d res: Qt.vector2d(Math.max(1, width), Math.max(1, height))
        property color glowA: Theme.cyan
        property color glowB: Theme.rose
        property vector2d pointer: Qt.vector2d(Fx.pointer.x, Fx.pointer.y)
        property real horizon: root.horizon
        property real rain: Fx.full ? 1 : 0
        property real heat: root.heat
        property var glyphs: Image { source: Qt.resolvedUrl("../art/fx/glyphs.png"); mipmap: true; visible: false }
        NumberAnimation on time { from: 0; to: 36000; duration: 36000000; loops: Animation.Infinite; running: Fx.full }
        fragmentShader: "shaders/room.frag.qsb"
    }

    ParticleSystem {
        id: motes
        anchors.fill: parent
        running: Fx.full && root.reveal > 0
    }
    ImageParticle {
        system: motes
        source: Qt.resolvedUrl("../art/fx/mote.png")
        color: Qt.rgba(0.55, 0.92, 1.0, 0.55)
        colorVariation: 0.08
        alpha: 0.0; alphaVariation: 0.4
        entryEffect: ImageParticle.Fade
        opacity: root.reveal
    }
    Emitter {
        system: motes
        width: parent.width; height: parent.height * 0.4
        y: parent.height * 0.55
        emitRate: 6; lifeSpan: 9000; lifeSpanVariation: 3000
        size: 7; sizeVariation: 5; endSize: 2
        velocity: AngleDirection { angle: -90; angleVariation: 14; magnitude: 22; magnitudeVariation: 14 }
        acceleration: PointDirection { x: 0; y: -2; xVariation: 3 }
    }
}
