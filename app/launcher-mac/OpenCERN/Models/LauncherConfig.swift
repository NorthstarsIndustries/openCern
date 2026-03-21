import Foundation

struct LauncherConfig: Codable, Equatable {
    var setupComplete: Bool
    var dockerSocket: String
    var updateIntervalSecs: Int
    var autoStart: Bool
    var dataDir: String
    var customContainers: [CustomContainerConfig]

    enum CodingKeys: String, CodingKey {
        case setupComplete = "setup_complete"
        case dockerSocket = "docker_socket"
        case updateIntervalSecs = "update_interval_secs"
        case autoStart = "auto_start"
        case dataDir = "data_dir"
        case customContainers = "custom_containers"
    }

    static let `default` = LauncherConfig(
        setupComplete: false,
        dockerSocket: "",
        updateIntervalSecs: 360,
        autoStart: true,
        dataDir: NSHomeDirectory() + "/opencern-datasets",
        customContainers: []
    )
}
