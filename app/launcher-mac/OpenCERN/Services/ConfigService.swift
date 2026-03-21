import Foundation

enum ConfigService {
    private static var configDirectory: URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return appSupport.appendingPathComponent("opencern")
    }

    private static var configFile: URL {
        configDirectory.appendingPathComponent("launcher.json")
    }

    static func load() -> LauncherConfig {
        let fm = FileManager.default
        guard fm.fileExists(atPath: configFile.path) else {
            return .default
        }
        do {
            let data = try Data(contentsOf: configFile)
            let decoder = JSONDecoder()
            return try decoder.decode(LauncherConfig.self, from: data)
        } catch {
            print("Failed to load config: \(error). Using defaults.")
            return .default
        }
    }

    static func save(_ config: LauncherConfig) throws {
        let fm = FileManager.default
        if !fm.fileExists(atPath: configDirectory.path) {
            try fm.createDirectory(at: configDirectory, withIntermediateDirectories: true)
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(config)
        try data.write(to: configFile, options: .atomic)
    }

    static func ensureDataDirectories(dataDir: String) {
        let fm = FileManager.default
        let processedDir = (dataDir as NSString).appendingPathComponent("processed")
        try? fm.createDirectory(atPath: dataDir, withIntermediateDirectories: true)
        try? fm.createDirectory(atPath: processedDir, withIntermediateDirectories: true)
    }
}
