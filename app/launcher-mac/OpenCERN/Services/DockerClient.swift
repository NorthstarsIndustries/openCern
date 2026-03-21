import Foundation

enum DockerClientError: LocalizedError {
    case noSocketFound
    case requestFailed(Int, String)
    case connectionFailed(String)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .noSocketFound:
            return "No Docker socket found. Is Docker running?"
        case .requestFailed(let code, let body):
            return "Docker API error (\(code)): \(body)"
        case .connectionFailed(let msg):
            return "Connection failed: \(msg)"
        case .invalidResponse:
            return "Invalid response from Docker"
        }
    }
}

/// Low-level Docker socket HTTP client using curl --unix-socket.
/// This is simpler and more reliable than NWConnection for HTTP over Unix sockets.
actor DockerClient {
    let socketPath: String

    init(socketPath: String) {
        self.socketPath = socketPath
    }

    static func detectSocket(preferred: String = "") -> String? {
        if !preferred.isEmpty && FileManager.default.fileExists(atPath: preferred) {
            return preferred
        }
        let candidates = [
            "/var/run/docker.sock",
            NSHomeDirectory() + "/.colima/default/docker.sock",
            NSHomeDirectory() + "/.rd/docker.sock",
        ]
        return candidates.first { FileManager.default.fileExists(atPath: $0) }
    }

    func get(_ path: String) async throws -> Data {
        try await request("GET", path: path)
    }

    func post(_ path: String, body: Data? = nil) async throws -> Data {
        try await request("POST", path: path, body: body)
    }

    func delete(_ path: String) async throws -> Data {
        try await request("DELETE", path: path)
    }

    func streamGet(_ path: String) async throws -> AsyncStream<Data> {
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/usr/bin/curl")
        proc.arguments = [
            "--unix-socket", socketPath,
            "--no-buffer",
            "-s",
            "http://localhost\(path)"
        ]

        let pipe = Pipe()
        proc.standardOutput = pipe
        proc.standardError = FileHandle.nullDevice

        try proc.run()

        return AsyncStream { continuation in
            pipe.fileHandleForReading.readabilityHandler = { handle in
                let data = handle.availableData
                if data.isEmpty {
                    continuation.finish()
                    pipe.fileHandleForReading.readabilityHandler = nil
                } else {
                    continuation.yield(data)
                }
            }

            continuation.onTermination = { _ in
                pipe.fileHandleForReading.readabilityHandler = nil
                if proc.isRunning { proc.terminate() }
            }
        }
    }

    private func request(_ method: String, path: String, body: Data? = nil) async throws -> Data {
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/usr/bin/curl")

        var args = [
            "--unix-socket", socketPath,
            "-s",
            "-w", "\n%{http_code}",
            "-X", method,
        ]

        if let body = body {
            args += ["-H", "Content-Type: application/json"]
            args += ["-d", String(data: body, encoding: .utf8) ?? ""]
        }

        args.append("http://localhost\(path)")
        proc.arguments = args

        let outPipe = Pipe()
        let errPipe = Pipe()
        proc.standardOutput = outPipe
        proc.standardError = errPipe

        try proc.run()
        proc.waitUntilExit()

        let output = outPipe.fileHandleForReading.readDataToEndOfFile()
        guard let outputStr = String(data: output, encoding: .utf8) else {
            throw DockerClientError.invalidResponse
        }

        let lines = outputStr.split(separator: "\n", omittingEmptySubsequences: false)
        guard let statusStr = lines.last, let statusCode = Int(statusStr) else {
            throw DockerClientError.invalidResponse
        }

        let bodyStr = lines.dropLast().joined(separator: "\n")
        let bodyData = Data(bodyStr.utf8)

        if statusCode >= 400 {
            throw DockerClientError.requestFailed(statusCode, bodyStr)
        }

        return bodyData
    }
}
