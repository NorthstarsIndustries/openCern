// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "OpenCERN",
    platforms: [.macOS(.v15)],
    dependencies: [
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "OpenCERN",
            dependencies: ["Sparkle"],
            path: "OpenCERN",
            resources: [
                .process("Resources"),
            ]
        ),
    ]
)
