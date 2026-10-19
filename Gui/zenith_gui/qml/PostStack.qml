import QtQuick
import QtQuick.Effects

// The finish over the whole window: everything inside is drawn once into a picture, its bright parts are blurred tight
// and wide into a bloom, and shaders/composite.frag lays them back together with the beats Fx asks for (a shock wave,
// a flash, a colour split, a shake). Off ("light" in Options, or a calm window) the content is drawn as it is.
Item {
    id: root
    default property alias content: scene.data
    readonly property bool on: Fx.full && width > 0 && height > 0

    Item {
        id: scene
        anchors.fill: parent
        transform: Translate { x: Fx.shakeX; y: Fx.shakeY }
    }
    ShaderEffectSource { id: sceneTex; sourceItem: scene; hideSource: root.on; live: root.on; visible: false }

    ShaderEffect {
        id: bright
        width: Math.ceil(root.width / 2); height: Math.ceil(root.height / 2)
        visible: root.on
        property var src: sceneTex
        property real threshold: 0.70
        property real knee: 0.20
        fragmentShader: "shaders/bright.frag.qsb"
    }
    ShaderEffectSource { id: brightTex; sourceItem: bright; hideSource: true; live: root.on; visible: false }

    MultiEffect {
        id: nearBlur
        width: bright.width; height: bright.height
        visible: root.on
        source: brightTex
        autoPaddingEnabled: false
        blurEnabled: true; blur: 1.0; blurMax: 24; blurMultiplier: 0.6
    }
    ShaderEffectSource { id: nearTex; sourceItem: nearBlur; hideSource: true; live: root.on; visible: false }
    MultiEffect {
        id: farBlur
        width: Math.ceil(root.width / 4); height: Math.ceil(root.height / 4)
        visible: root.on
        source: brightTex
        autoPaddingEnabled: false
        blurEnabled: true; blur: 1.0; blurMax: 64; blurMultiplier: 1.4
    }
    ShaderEffectSource { id: farTex; sourceItem: farBlur; hideSource: true; live: root.on; visible: false }

    ShaderEffect {
        anchors.fill: parent
        visible: root.on
        property var src: sceneTex
        property var near: nearTex
        property var far: farTex
        property vector2d res: Qt.vector2d(width, height)
        property real bloom: Fx.bloom
        property real split: Fx.split
        property vector2d shockAt: Qt.vector2d(Fx.shockAt.x / Math.max(1, width), Fx.shockAt.y / Math.max(1, height))
        property real shockT: Fx.shockT
        property real shockPower: Fx.shockPower
        property color flashTone: Fx.flashTone
        property real flash: Fx.flash
        property real grain: 0.018
        property real time: 0
        NumberAnimation on time { from: 0; to: 1000; duration: 1000000; loops: Animation.Infinite; running: root.on }
        fragmentShader: "shaders/composite.frag.qsb"
    }
}
