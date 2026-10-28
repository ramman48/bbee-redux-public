import QtQuick
import Qt.labs.platform as Platform

// The tray: beside the clock while the window is closed; a pop-up when an update is ready. Its own file, loaded by
// Main.qml only when the Interpreter has Qt.labs.platform and Qt Widgets (trayAvailable): a Terminal first
// installed before 0.5.0 has neither, and its window opens without the tray instead of not opening at all.
Platform.SystemTrayIcon {
    id: tray
    property var win: null
    visible: available && controller.settings.tray !== "off" && !shell.capture && !controller.demo
    icon.source: Qt.resolvedUrl("../../art/logo/zenith.ico")
    tooltip: qsTr("The Zenith Terminal") + (controller.available.length > 0 ? ": " + controller.available.length + (controller.available.length === 1 ? qsTr(" update ready") : qsTr(" updates ready")) : "")
    onActivated: (reason) => { if (reason !== Platform.SystemTrayIcon.Context) tray.win.showAgain() }
    onMessageClicked: tray.win.showAgain()
    menu: Platform.Menu {
        Platform.MenuItem { text: qsTr("Open the Terminal"); onTriggered: tray.win.showAgain() }
        Platform.MenuItem { text: qsTr("Get updates now"); enabled: controller.canUpdate && !controller.busy; onTriggered: { controller.checkUpdates(); tray.win.showAgain() } }
        Platform.MenuItem {
            text: qsTr("Wait with updates while I play")
            checkable: true
            checked: controller.settings.quietWhilePlaying !== false
            onTriggered: controller.setSetting("quietWhilePlaying", !(controller.settings.quietWhilePlaying !== false))
        }
        Platform.MenuSeparator {}
        Platform.MenuItem { text: qsTr("Quit"); onTriggered: { tray.win.quitting = true; Qt.quit() } }
    }
}
