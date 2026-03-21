import Foundation

struct UpdateStatus: Equatable {
    var imageUpdates: [String]
    var launcherUpdate: LauncherUpdate?
}

struct LauncherUpdate: Equatable {
    let currentVersion: String
    let latestVersion: String
    let downloadURL: String
}
