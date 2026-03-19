// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "kayman-capture",
    platforms: [.macOS(.v15)],
    targets: [
        .executableTarget(
            name: "kayman-capture",
            path: "Sources/kayman-capture",
            swiftSettings: [.swiftLanguageMode(.v5)]
        )
    ]
)
