import Foundation

struct CustomContainerConfig: Codable, Identifiable, Equatable {
    var id: String
    var name: String
    var image: String
    var ports: [PortMapping]
    var volumes: [VolumeMapping]
    var envVars: [EnvVar]
    var joinNetwork: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, image, ports, volumes
        case envVars = "env_vars"
        case joinNetwork = "join_network"
    }

    static func new() -> CustomContainerConfig {
        CustomContainerConfig(
            id: UUID().uuidString,
            name: "",
            image: "",
            ports: [],
            volumes: [],
            envVars: [],
            joinNetwork: true
        )
    }
}

struct EnvVar: Codable, Identifiable, Equatable {
    var key: String
    var value: String

    var id: String { key }
}
