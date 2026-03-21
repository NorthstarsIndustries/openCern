import SwiftUI

@main
struct OpenCERNApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(minWidth: 860, minHeight: 520)
                .preferredColorScheme(.dark)
        }
        .defaultSize(width: 1060, height: 680)
    }
}
