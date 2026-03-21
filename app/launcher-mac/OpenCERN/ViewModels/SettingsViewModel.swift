import Foundation

@MainActor @Observable
final class SettingsViewModel {
    var dockerSocket: String = ""
    var dataDir: String = ""
    var updateIntervalSecs: Int = 360
    var autoStart: Bool = true
    var isSaving = false
    var saveSuccess = false

    func load(from config: LauncherConfig) {
        dockerSocket = config.dockerSocket
        dataDir = config.dataDir
        updateIntervalSecs = config.updateIntervalSecs
        autoStart = config.autoStart
    }

    func save() -> LauncherConfig {
        var config = ConfigService.load()
        config.dockerSocket = dockerSocket
        config.dataDir = dataDir
        config.updateIntervalSecs = updateIntervalSecs
        config.autoStart = autoStart

        isSaving = true
        do {
            try ConfigService.save(config)
            saveSuccess = true
        } catch {
            saveSuccess = false
        }
        isSaving = false

        return config
    }

    func reset() {
        let defaults = LauncherConfig.default
        dockerSocket = defaults.dockerSocket
        dataDir = defaults.dataDir
        updateIntervalSecs = defaults.updateIntervalSecs
        autoStart = defaults.autoStart
    }

    var updateIntervalOptions: [(String, Int)] {
        [
            ("1 minute", 60),
            ("5 minutes", 300),
            ("6 minutes", 360),
            ("10 minutes", 600),
            ("30 minutes", 1800),
            ("1 hour", 3600),
        ]
    }
}
