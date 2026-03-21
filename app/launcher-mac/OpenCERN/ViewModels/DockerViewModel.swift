import Foundation
import SwiftUI

@MainActor @Observable
final class DockerViewModel {
    var containers: [ContainerInfo] = []
    var isLoading = false
    var error: String?
    var logs: [String: String] = [:]

    private var dockerService: DockerService?
    private var pollingTask: Task<Void, Never>?
    private var config: LauncherConfig = .default

    var runningCount: Int {
        containers.filter { $0.state.isRunning }.count
    }

    var totalCount: Int {
        containers.count
    }

    var builtInContainers: [ContainerInfo] {
        containers.filter { $0.isBuiltIn }
    }

    var customContainers: [ContainerInfo] {
        containers.filter { !$0.isBuiltIn }
    }

    func configure(config: LauncherConfig) {
        self.config = config
        guard let socketPath = DockerClient.detectSocket(preferred: config.dockerSocket) else {
            error = "No Docker socket found"
            return
        }
        let client = DockerClient(socketPath: socketPath)
        dockerService = DockerService(client: client)
    }

    func startPolling() {
        stopPolling()
        pollingTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refreshContainers()
                try? await Task.sleep(for: .seconds(3))
            }
        }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }

    func refreshContainers() async {
        guard let service = dockerService else { return }
        do {
            let builtInNames = Set(BuiltInServices.all(dataDir: config.dataDir).map(\.containerName))
            var parsed = try await service.fetchContainers(builtInNames: builtInNames)

            // Fetch stats for running containers
            for i in parsed.indices where parsed[i].state.isRunning {
                if let stats = try? await service.containerStats(name: parsed[i].name) {
                    parsed[i].stats = stats
                }
            }

            self.containers = parsed
            self.error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    func startAll() async {
        guard let service = dockerService else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            try await service.ensureNetwork(name: BuiltInServices.networkName)
            ConfigService.ensureDataDirectories(dataDir: config.dataDir)

            let definitions = BuiltInServices.all(dataDir: config.dataDir)
            for def in definitions {
                try await service.createAndStartContainer(definition: def, networkName: BuiltInServices.networkName)
            }
            await refreshContainers()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func stopAll() async {
        guard let service = dockerService else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            let builtInNames = BuiltInServices.all(dataDir: config.dataDir).map(\.containerName)
            for name in builtInNames {
                try? await service.stopContainer(name: name)
            }
            await refreshContainers()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func startContainer(name: String) async {
        guard let service = dockerService else { return }
        do {
            // Find service definition
            if let def = BuiltInServices.all(dataDir: config.dataDir).first(where: { $0.containerName == name }) {
                try await service.ensureNetwork(name: BuiltInServices.networkName)
                ConfigService.ensureDataDirectories(dataDir: config.dataDir)
                try await service.createAndStartContainer(definition: def, networkName: BuiltInServices.networkName)
            } else if let custom = config.customContainers.first(where: { $0.name == name }) {
                try await service.ensureNetwork(name: BuiltInServices.networkName)
                try await service.createAndStartCustomContainer(config: custom, networkName: BuiltInServices.networkName)
            } else {
                try await service.startContainer(name: name)
            }
            await refreshContainers()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func stopContainer(name: String) async {
        guard let service = dockerService else { return }
        do {
            try await service.stopContainer(name: name)
            await refreshContainers()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func restartContainer(name: String) async {
        guard let service = dockerService else { return }
        do {
            try await service.restartContainer(name: name)
            await refreshContainers()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func fetchLogs(name: String) async {
        guard let service = dockerService else { return }
        do {
            let logText = try await service.containerLogs(name: name, tail: 80)
            self.logs[name] = logText
        } catch {
            self.logs[name] = "Failed to fetch logs: \(error.localizedDescription)"
        }
    }

    // MARK: - Image pulling

    var isPulling = false
    var pullProgress: Double = 0
    var pullStatus: String = ""

    func pullAllImages() async {
        guard let service = dockerService else { return }
        isPulling = true
        pullProgress = 0
        pullStatus = "Starting..."
        defer { isPulling = false }

        let images = BuiltInServices.allImages
        for (index, image) in images.enumerated() {
            let shortName = image.split(separator: "/").last.map(String.init) ?? image
            pullStatus = "Pulling \(shortName)..."

            let stream = await service.pullImage(name: image)
            for await progress in stream {
                pullStatus = progress.status
                if let pct = progress.percent {
                    let base = Double(index) / Double(images.count)
                    let imagePart = pct / 100.0 / Double(images.count)
                    self.pullProgress = (base + imagePart) * 100
                }
            }
            pullProgress = Double(index + 1) / Double(images.count) * 100
        }

        pullStatus = "All images up to date"
    }

    func startCustomContainer(_ config: CustomContainerConfig) async {
        guard let service = dockerService else { return }
        do {
            try await service.ensureNetwork(name: BuiltInServices.networkName)
            try await service.createAndStartCustomContainer(config: config, networkName: BuiltInServices.networkName)
            await refreshContainers()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
