import SwiftUI

struct DashboardView: View {
    @Bindable var dockerVM: DockerViewModel
    @Bindable var updateVM: UpdateViewModel
    var config: LauncherConfig

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                pullProgressBanner
                updateBanner
                coreServicesSection
                customServicesSection
            }
            .padding(24)
        }
        .background(Color.ocBackground)
        .onAppear {
            dockerVM.configure(config: config)
            dockerVM.startPolling()
        }
        .onDisappear {
            dockerVM.stopPolling()
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Services")
                    .font(.title.weight(.bold))
                    .foregroundStyle(Color.ocText)
                Text("\(dockerVM.runningCount)/\(dockerVM.totalCount) running")
                    .font(.subheadline)
                    .foregroundStyle(Color.ocTextSecondary)
            }

            Spacer()

            if dockerVM.isLoading || dockerVM.isPulling {
                ProgressView()
                    .controlSize(.small)
            }

            Button {
                Task { await dockerVM.pullAllImages() }
            } label: {
                Label("Pull Images", systemImage: "arrow.down.circle")
            }
            .buttonStyle(.bordered)
            .disabled(dockerVM.isPulling || dockerVM.isLoading)

            Button {
                Task { await dockerVM.startAll() }
            } label: {
                Label("Start All", systemImage: "play.fill")
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.ocGreen)
            .disabled(dockerVM.isLoading || dockerVM.isPulling)

            Button {
                Task { await dockerVM.stopAll() }
            } label: {
                Label("Stop All", systemImage: "stop.fill")
            }
            .buttonStyle(.bordered)
            .disabled(dockerVM.isLoading)
        }
    }

    @ViewBuilder
    private var pullProgressBanner: some View {
        if dockerVM.isPulling {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(dockerVM.pullStatus)
                        .font(.subheadline)
                        .foregroundStyle(Color.ocText)
                    Spacer()
                    Text("\(Int(dockerVM.pullProgress))%")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(Color.ocTextSecondary)
                }
                ProgressBarView(value: dockerVM.pullProgress / 100)
                    .frame(height: 6)
            }
            .padding(12)
            .background(Color.ocSurface)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    @ViewBuilder
    private var updateBanner: some View {
        if updateVM.hasUpdates {
            HStack {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .foregroundStyle(Color.ocBlue)

                if let launcher = updateVM.updateStatus?.launcherUpdate {
                    Text("Launcher update available: v\(launcher.latestVersion)")
                        .foregroundStyle(Color.ocText)
                } else if let updates = updateVM.updateStatus?.imageUpdates, !updates.isEmpty {
                    Text("Image updates available: \(updates.joined(separator: ", "))")
                        .foregroundStyle(Color.ocText)
                }

                Spacer()
            }
            .padding(12)
            .background(Color.ocBlue.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.ocBlue.opacity(0.3)))
        }
    }

    private var coreServicesSection: some View {
        DisclosureGroup {
            LazyVStack(spacing: 12) {
                let definitions = BuiltInServices.all(dataDir: config.dataDir)
                ForEach(definitions) { def in
                    let container = dockerVM.builtInContainers.first { $0.name == def.containerName }
                    ContainerCardView(
                        name: def.containerName,
                        displayName: def.name,
                        image: def.image,
                        sfSymbol: def.sfSymbol,
                        description: def.description,
                        container: container,
                        logs: dockerVM.logs[def.containerName],
                        onStart: { Task { await dockerVM.startContainer(name: def.containerName) } },
                        onStop: { Task { await dockerVM.stopContainer(name: def.containerName) } },
                        onRestart: { Task { await dockerVM.restartContainer(name: def.containerName) } },
                        onFetchLogs: { Task { await dockerVM.fetchLogs(name: def.containerName) } }
                    )
                }
            }
        } label: {
            Text("Core Services")
                .font(.headline)
                .foregroundStyle(Color.ocText)
        }
    }

    private var customServicesSection: some View {
        DisclosureGroup {
            if dockerVM.customContainers.isEmpty {
                Text("No custom containers")
                    .foregroundStyle(Color.ocTextSecondary)
                    .padding()
            } else {
                LazyVStack(spacing: 12) {
                    ForEach(dockerVM.customContainers) { container in
                        ContainerCardView(
                            name: container.name,
                            displayName: container.name,
                            image: container.image,
                            sfSymbol: "shippingbox",
                            description: "Custom container",
                            container: container,
                            logs: dockerVM.logs[container.name],
                            onStart: { Task { await dockerVM.startContainer(name: container.name) } },
                            onStop: { Task { await dockerVM.stopContainer(name: container.name) } },
                            onRestart: { Task { await dockerVM.restartContainer(name: container.name) } },
                            onFetchLogs: { Task { await dockerVM.fetchLogs(name: container.name) } }
                        )
                    }
                }
            }
        } label: {
            Text("Custom Containers")
                .font(.headline)
                .foregroundStyle(Color.ocText)
        }
    }
}
