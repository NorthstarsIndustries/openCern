import Foundation

struct PullProgress: Sendable {
    let status: String
    let progress: String?
    let percent: Double?
}

actor DockerService {
    private let client: DockerClient

    init(client: DockerClient) {
        self.client = client
    }

    // MARK: - Ping

    func ping() async -> Bool {
        do {
            let data = try await client.get("/_ping")
            return String(data: data, encoding: .utf8) == "OK"
        } catch {
            return false
        }
    }

    // MARK: - Containers

    func fetchContainers(builtInNames: Set<String>) async throws -> [ContainerInfo] {
        let data = try await client.get("/containers/json?all=true")
        guard let json = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }

        return json.compactMap { container -> ContainerInfo? in
            guard let id = container["Id"] as? String,
                  let names = container["Names"] as? [String],
                  let rawName = names.first,
                  let image = container["Image"] as? String,
                  let stateStr = container["State"] as? String,
                  let status = container["Status"] as? String else {
                return nil
            }

            let name = rawName.hasPrefix("/") ? String(rawName.dropFirst()) : rawName

            var ports: [PortMapping] = []
            if let portsArray = container["Ports"] as? [[String: Any]] {
                for p in portsArray {
                    if let publicPort = p["PublicPort"] as? Int,
                       let privatePort = p["PrivatePort"] as? Int {
                        ports.append(PortMapping(host: publicPort, container: privatePort))
                    }
                }
            }

            return ContainerInfo(
                id: String(id.prefix(12)),
                name: name,
                image: image,
                state: ContainerState(from: stateStr),
                status: status,
                ports: ports,
                stats: nil,
                isBuiltIn: builtInNames.contains(name)
            )
        }
    }

    func createAndStartContainer(definition: ServiceDefinition, networkName: String) async throws {
        // Remove existing container if present
        try? await removeContainer(name: definition.containerName, force: true)

        // Build create payload
        var config: [String: Any] = [
            "Image": definition.image,
            "Hostname": definition.containerName,
        ]

        // Exposed ports
        var exposedPorts: [String: Any] = [:]
        var portBindings: [String: Any] = [:]
        for port in definition.ports {
            exposedPorts["\(port.container)/tcp"] = [String: Any]()
            portBindings["\(port.container)/tcp"] = [["HostIp": "127.0.0.1", "HostPort": String(port.host)]]
        }
        config["ExposedPorts"] = exposedPorts

        // Environment
        if !definition.env.isEmpty {
            config["Env"] = definition.env.map { "\($0.key)=\($0.value)" }
        }

        // Host config
        var hostConfig: [String: Any] = [
            "PortBindings": portBindings,
            "NetworkMode": networkName,
            "RestartPolicy": ["Name": "unless-stopped", "MaximumRetryCount": 0],
        ]

        // Volumes / Binds
        if !definition.volumes.isEmpty {
            let binds = definition.volumes.map { vol -> String in
                var bind = "\(vol.hostPath):\(vol.containerPath)"
                if vol.readonly { bind += ":ro" }
                return bind
            }
            hostConfig["Binds"] = binds
        }

        config["HostConfig"] = hostConfig

        let body = try JSONSerialization.data(withJSONObject: config)
        let createData = try await client.post("/containers/create?name=\(definition.containerName)", body: body)

        // Parse container ID
        guard let createJson = try JSONSerialization.jsonObject(with: createData) as? [String: Any],
              let containerId = createJson["Id"] as? String else {
            throw DockerClientError.invalidResponse
        }

        // Start
        _ = try await client.post("/containers/\(containerId)/start")
    }

    func createAndStartCustomContainer(config: CustomContainerConfig, networkName: String) async throws {
        try? await removeContainer(name: config.name, force: true)

        var containerConfig: [String: Any] = [
            "Image": config.image,
            "Hostname": config.name,
        ]

        var exposedPorts: [String: Any] = [:]
        var portBindings: [String: Any] = [:]
        for port in config.ports {
            exposedPorts["\(port.container)/tcp"] = [String: Any]()
            portBindings["\(port.container)/tcp"] = [["HostIp": "127.0.0.1", "HostPort": String(port.host)]]
        }
        containerConfig["ExposedPorts"] = exposedPorts

        if !config.envVars.isEmpty {
            containerConfig["Env"] = config.envVars.map { "\($0.key)=\($0.value)" }
        }

        var hostConfig: [String: Any] = [
            "PortBindings": portBindings,
            "RestartPolicy": ["Name": "unless-stopped", "MaximumRetryCount": 0],
        ]

        if config.joinNetwork {
            hostConfig["NetworkMode"] = networkName
        }

        if !config.volumes.isEmpty {
            let binds = config.volumes.map { vol -> String in
                var bind = "\(vol.hostPath):\(vol.containerPath)"
                if vol.readonly { bind += ":ro" }
                return bind
            }
            hostConfig["Binds"] = binds
        }

        containerConfig["HostConfig"] = hostConfig

        let body = try JSONSerialization.data(withJSONObject: containerConfig)
        let createData = try await client.post("/containers/create?name=\(config.name)", body: body)

        guard let createJson = try JSONSerialization.jsonObject(with: createData) as? [String: Any],
              let containerId = createJson["Id"] as? String else {
            throw DockerClientError.invalidResponse
        }

        _ = try await client.post("/containers/\(containerId)/start")
    }

    func startContainer(name: String) async throws {
        _ = try await client.post("/containers/\(name)/start")
    }

    func stopContainer(name: String, timeout: Int = 10) async throws {
        _ = try await client.post("/containers/\(name)/stop?t=\(timeout)")
    }

    func restartContainer(name: String, timeout: Int = 5) async throws {
        _ = try await client.post("/containers/\(name)/restart?t=\(timeout)")
    }

    func removeContainer(name: String, force: Bool = false) async throws {
        _ = try await client.delete("/containers/\(name)?force=\(force)")
    }

    func containerLogs(name: String, tail: Int = 80) async throws -> String {
        let data = try await client.get("/containers/\(name)/logs?stdout=true&stderr=true&tail=\(tail)")
        // Docker log stream has 8-byte header per frame; strip them for display
        return stripDockerLogHeaders(data)
    }

    func containerStats(name: String) async throws -> ContainerStats {
        let data = try await client.get("/containers/\(name)/stats?stream=false")
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw DockerClientError.invalidResponse
        }
        return parseStats(json)
    }

    // MARK: - Images

    func pullImage(name: String) -> AsyncStream<PullProgress> {
        AsyncStream { continuation in
            Task {
                do {
                    let encoded = name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? name
                    let stream = try await client.streamGet("/images/create?fromImage=\(encoded)")
                    for await chunk in stream {
                        let lines = String(data: chunk, encoding: .utf8)?.split(separator: "\n") ?? []
                        for line in lines {
                            if let obj = try? JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any] {
                                let status = obj["status"] as? String ?? ""
                                let progress = obj["progress"] as? String
                                let detail = obj["progressDetail"] as? [String: Any]
                                var percent: Double?
                                if let current = detail?["current"] as? Double,
                                   let total = detail?["total"] as? Double, total > 0 {
                                    percent = (current / total) * 100
                                }
                                continuation.yield(PullProgress(status: status, progress: progress, percent: percent))
                            }
                        }
                    }
                } catch {
                    continuation.yield(PullProgress(status: "Error: \(error.localizedDescription)", progress: nil, percent: nil))
                }
                continuation.finish()
            }
        }
    }

    func imageDigests(name: String) async throws -> [String] {
        let encoded = name.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? name
        let data = try await client.get("/images/\(encoded)/json")
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let digests = json["RepoDigests"] as? [String] else {
            return []
        }
        return digests
    }

    // MARK: - Networks

    func ensureNetwork(name: String) async throws {
        // Check if network exists
        let data = try await client.get("/networks")
        if let networks = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            let exists = networks.contains { ($0["Name"] as? String) == name }
            if exists { return }
        }

        // Create network
        let body = try JSONSerialization.data(withJSONObject: [
            "Name": name,
            "Driver": "bridge",
        ])
        _ = try await client.post("/networks/create", body: body)
    }

    // MARK: - Helpers

    private func parseStats(_ json: [String: Any]) -> ContainerStats {
        var cpuPercent = 0.0
        var memUsage = 0.0
        var memLimit = 0.0

        if let cpuStats = json["cpu_stats"] as? [String: Any],
           let preCpuStats = json["precpu_stats"] as? [String: Any],
           let cpuUsage = cpuStats["cpu_usage"] as? [String: Any],
           let preCpuUsage = preCpuStats["cpu_usage"] as? [String: Any],
           let totalUsage = cpuUsage["total_usage"] as? Double,
           let preTotalUsage = preCpuUsage["total_usage"] as? Double,
           let systemUsage = cpuStats["system_cpu_usage"] as? Double,
           let preSystemUsage = preCpuStats["system_cpu_usage"] as? Double,
           let onlineCpus = cpuStats["online_cpus"] as? Double {
            let cpuDelta = totalUsage - preTotalUsage
            let systemDelta = systemUsage - preSystemUsage
            if systemDelta > 0 && cpuDelta >= 0 {
                cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100
            }
        }

        if let memStats = json["memory_stats"] as? [String: Any] {
            memUsage = (memStats["usage"] as? Double ?? 0) / 1_048_576
            memLimit = (memStats["limit"] as? Double ?? 0) / 1_048_576
        }

        return ContainerStats(cpuPercent: cpuPercent, memoryUsageMB: memUsage, memoryLimitMB: memLimit)
    }

    private func stripDockerLogHeaders(_ data: Data) -> String {
        var result = Data()
        var offset = 0
        while offset + 8 <= data.count {
            let frameSize = Int(data[offset + 4]) << 24
                | Int(data[offset + 5]) << 16
                | Int(data[offset + 6]) << 8
                | Int(data[offset + 7])
            let start = offset + 8
            let end = min(start + frameSize, data.count)
            if start < end {
                result.append(data[start..<end])
            }
            offset = end
        }
        // If parsing fails, return raw string
        if result.isEmpty {
            return String(data: data, encoding: .utf8) ?? ""
        }
        return String(data: result, encoding: .utf8) ?? ""
    }
}
