import Foundation

@MainActor @Observable
final class UpdateViewModel {
    var updateStatus: UpdateStatus?
    var isChecking = false
    var error: String?

    private var checkTask: Task<Void, Never>?
    private var config: LauncherConfig = .default

    var hasUpdates: Bool {
        guard let status = updateStatus else { return false }
        return !status.imageUpdates.isEmpty || status.launcherUpdate != nil
    }

    func configure(config: LauncherConfig) {
        self.config = config
    }

    func startPeriodicChecks() {
        stopPeriodicChecks()
        checkTask = Task { [weak self] in
            // First check after 30 seconds
            try? await Task.sleep(for: .seconds(30))
            await self?.checkForUpdates()

            while !Task.isCancelled {
                let interval = self?.config.updateIntervalSecs ?? 360
                try? await Task.sleep(for: .seconds(interval))
                await self?.checkForUpdates()
            }
        }
    }

    func stopPeriodicChecks() {
        checkTask?.cancel()
        checkTask = nil
    }

    func checkForUpdates() async {
        guard let socketPath = DockerClient.detectSocket(preferred: config.dockerSocket) else { return }

        isChecking = true
        defer { isChecking = false }

        let client = DockerClient(socketPath: socketPath)
        let service = DockerService(client: client)

        var imageUpdates: [String] = []

        for image in BuiltInServices.allImages {
            let hasUpdate = await UpdateService.checkImageDigest(service: service, image: image)
            if hasUpdate {
                let shortName = image.split(separator: "/").last.map(String.init) ?? image
                imageUpdates.append(shortName)
            }
        }

        let launcherUpdate = await UpdateService.checkLatestRelease()

        self.updateStatus = UpdateStatus(imageUpdates: imageUpdates, launcherUpdate: launcherUpdate)
    }
}
