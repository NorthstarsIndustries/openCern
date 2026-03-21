import Foundation

struct ServiceDefinition: Identifiable {
    let id: String
    let name: String
    let containerName: String
    let image: String
    let ports: [PortMapping]
    let volumes: [VolumeMapping]
    let env: [String: String]
    let description: String
    let sfSymbol: String
}

struct VolumeMapping: Codable, Equatable, Identifiable {
    var hostPath: String
    var containerPath: String
    var readonly: Bool

    var id: String { "\(hostPath):\(containerPath)" }

    enum CodingKeys: String, CodingKey {
        case hostPath = "host_path"
        case containerPath = "container_path"
        case readonly
    }
}

enum BuiltInServices {
    static let networkName = "opencern-net"

    static func all(dataDir: String) -> [ServiceDefinition] {
        [
            ui,
            api(dataDir: dataDir),
            xrootd(dataDir: dataDir),
            streamer(dataDir: dataDir),
            quantum,
        ]
    }

    static var allImages: [String] {
        [
            "ghcr.io/ceoatnorthstar/ui:latest",
            "ghcr.io/ceoatnorthstar/api:latest",
            "ghcr.io/ceoatnorthstar/xrootd:latest",
            "ghcr.io/ceoatnorthstar/streamer:latest",
            "ghcr.io/ceoatnorthstar/quantum:latest",
        ]
    }

    static let ui = ServiceDefinition(
        id: "ui",
        name: "UI",
        containerName: "opencern-ui",
        image: "ghcr.io/ceoatnorthstar/ui:latest",
        ports: [PortMapping(host: 3000, container: 3000)],
        volumes: [],
        env: ["NEXT_PUBLIC_API_URL": "http://localhost:8080"],
        description: "Next.js web interface",
        sfSymbol: "globe"
    )

    static func api(dataDir: String) -> ServiceDefinition {
        ServiceDefinition(
            id: "api",
            name: "API",
            containerName: "opencern-api",
            image: "ghcr.io/ceoatnorthstar/api:latest",
            ports: [PortMapping(host: 8080, container: 8080)],
            volumes: [VolumeMapping(hostPath: dataDir, containerPath: "/home/appuser/opencern-datasets", readonly: false)],
            env: [:],
            description: "FastAPI backend with ROOT processing",
            sfSymbol: "server.rack"
        )
    }

    static func xrootd(dataDir: String) -> ServiceDefinition {
        ServiceDefinition(
            id: "xrootd",
            name: "XRootD",
            containerName: "opencern-xrootd",
            image: "ghcr.io/ceoatnorthstar/xrootd:latest",
            ports: [PortMapping(host: 8081, container: 8081)],
            volumes: [VolumeMapping(hostPath: dataDir, containerPath: "/home/appuser/opencern-datasets", readonly: false)],
            env: [:],
            description: "CERN XRootD protocol proxy",
            sfSymbol: "externaldrive"
        )
    }

    static func streamer(dataDir: String) -> ServiceDefinition {
        ServiceDefinition(
            id: "streamer",
            name: "Streamer",
            containerName: "opencern-streamer",
            image: "ghcr.io/ceoatnorthstar/streamer:latest",
            ports: [PortMapping(host: 9001, container: 9001), PortMapping(host: 9002, container: 9002)],
            volumes: [VolumeMapping(hostPath: dataDir + "/processed", containerPath: "/home/appuser/opencern-datasets/processed", readonly: true)],
            env: [:],
            description: "Rust WebSocket event streamer",
            sfSymbol: "antenna.radiowaves.left.and.right"
        )
    }

    static let quantum = ServiceDefinition(
        id: "quantum",
        name: "Quantum",
        containerName: "opencern-quantum",
        image: "ghcr.io/ceoatnorthstar/quantum:latest",
        ports: [PortMapping(host: 8082, container: 8082)],
        volumes: [],
        env: [:],
        description: "Qiskit quantum computing service",
        sfSymbol: "atom"
    )
}
