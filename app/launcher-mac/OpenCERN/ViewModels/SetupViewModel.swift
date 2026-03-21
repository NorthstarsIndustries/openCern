import Foundation

enum SetupStep: Int, CaseIterable {
    case dockerCheck = 0
    case pullImages = 1
    case complete = 2

    var title: String {
        switch self {
        case .dockerCheck: return "Docker"
        case .pullImages: return "Images"
        case .complete: return "Ready"
        }
    }

    var description: String {
        switch self {
        case .dockerCheck: return "Checking Docker installation"
        case .pullImages: return "Pulling container images"
        case .complete: return "Setup complete"
        }
    }
}

@MainActor @Observable
final class SetupViewModel {
    var currentStep: SetupStep = .dockerCheck
    var dockerInstalled = false
    var dockerRunning = false
    var isChecking = false
    var pullProgress: Double = 0
    var pullStatus: String = ""
    var pullImageIndex: Int = 0
    var pullImageTotal: Int = 0
    var error: String?

    private var config: LauncherConfig = .default

    func configure(config: LauncherConfig) {
        self.config = config
    }

    func checkDocker() async {
        isChecking = true
        defer { isChecking = false }

        guard let socketPath = DockerClient.detectSocket(preferred: config.dockerSocket) else {
            dockerInstalled = false
            dockerRunning = false
            error = "Docker not found. Please install Docker Desktop."
            return
        }

        dockerInstalled = true

        let client = DockerClient(socketPath: socketPath)
        let service = DockerService(client: client)
        dockerRunning = await service.ping()

        if !dockerRunning {
            error = "Docker is installed but not running. Please start Docker."
            return
        }

        error = nil
        currentStep = .pullImages
    }

    func pullImages() async {
        guard let socketPath = DockerClient.detectSocket(preferred: config.dockerSocket) else {
            error = "Docker socket not found"
            return
        }

        let client = DockerClient(socketPath: socketPath)
        let service = DockerService(client: client)
        let images = BuiltInServices.allImages
        pullImageTotal = images.count

        for (index, image) in images.enumerated() {
            pullImageIndex = index + 1
            pullStatus = "Pulling \(image.split(separator: "/").last ?? Substring(image))..."

            let stream = await service.pullImage(name: image)
            for await progress in stream {
                pullStatus = progress.status
                if let pct = progress.percent {
                    // Weight each image equally
                    let baseProgress = Double(index) / Double(images.count)
                    let imageProgress = pct / 100.0 / Double(images.count)
                    self.pullProgress = (baseProgress + imageProgress) * 100
                }
            }

            pullProgress = Double(index + 1) / Double(images.count) * 100
        }

        pullStatus = "All images pulled successfully"
        currentStep = .complete
    }

    func completeSetup() {
        var updatedConfig = config
        updatedConfig.setupComplete = true
        try? ConfigService.save(updatedConfig)
    }
}
