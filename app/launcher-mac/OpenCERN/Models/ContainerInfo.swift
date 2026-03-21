import Foundation

struct ContainerInfo: Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let image: String
    let state: ContainerState
    let status: String
    let ports: [PortMapping]
    var stats: ContainerStats?
    var isBuiltIn: Bool

    static func == (lhs: ContainerInfo, rhs: ContainerInfo) -> Bool {
        lhs.id == rhs.id && lhs.state == rhs.state && lhs.status == rhs.status && lhs.stats == rhs.stats
    }
}

enum ContainerState: String, Equatable {
    case running
    case exited
    case created
    case paused
    case restarting
    case removing
    case dead
    case unknown

    init(from string: String) {
        self = ContainerState(rawValue: string.lowercased()) ?? .unknown
    }

    var isRunning: Bool { self == .running }
}

struct ContainerStats: Equatable, Sendable {
    let cpuPercent: Double
    let memoryUsageMB: Double
    let memoryLimitMB: Double

    var memoryPercent: Double {
        guard memoryLimitMB > 0 else { return 0 }
        return (memoryUsageMB / memoryLimitMB) * 100
    }
}

struct PortMapping: Codable, Equatable, Identifiable, Sendable {
    var host: Int
    var container: Int

    var id: String { "\(host):\(container)" }
}
