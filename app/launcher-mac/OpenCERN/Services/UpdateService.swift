import Foundation

enum UpdateService {
    static func checkImageDigest(service: DockerService, image: String) async -> Bool {
        do {
            let localDigests = try await service.imageDigests(name: image)
            guard let localDigest = localDigests.first else { return false }

            // Pull latest
            let stream = await service.pullImage(name: image)
            for await _ in stream { /* consume */ }

            let updatedDigests = try await service.imageDigests(name: image)
            guard let updatedDigest = updatedDigests.first else { return false }

            return localDigest != updatedDigest
        } catch {
            return false
        }
    }

    struct GitHubRelease: Decodable {
        let tag_name: String
        let html_url: String
    }

    static func checkLatestRelease() async -> LauncherUpdate? {
        guard let url = URL(string: "https://api.github.com/repos/NorthstarsIndustries/openCern/releases/latest") else {
            return nil
        }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let release = try JSONDecoder().decode(GitHubRelease.self, from: data)

            let currentVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
            let latestVersion = release.tag_name.hasPrefix("v") ? String(release.tag_name.dropFirst()) : release.tag_name

            guard latestVersion > currentVersion else { return nil }

            return LauncherUpdate(currentVersion: currentVersion, latestVersion: latestVersion, downloadURL: release.html_url)
        } catch {
            return nil
        }
    }
}
