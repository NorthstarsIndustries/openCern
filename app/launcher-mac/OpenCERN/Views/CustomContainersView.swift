import SwiftUI

struct CustomContainersView: View {
    @Bindable var dockerVM: DockerViewModel
    @State private var config: LauncherConfig = ConfigService.load()
    @State private var showAddSheet = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    Text("Custom Containers")
                        .font(.title.weight(.bold))
                        .foregroundStyle(Color.ocText)

                    Spacer()

                    Button {
                        showAddSheet = true
                    } label: {
                        Label("Add Container", systemImage: "plus")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.ocBlue)
                }

                if config.customContainers.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "shippingbox")
                            .font(.system(size: 40))
                            .foregroundStyle(Color.ocTextSecondary)
                        Text("No custom containers configured")
                            .foregroundStyle(Color.ocTextSecondary)
                        Text("Add custom Docker containers to manage alongside core services.")
                            .font(.caption)
                            .foregroundStyle(Color.ocTextSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(40)
                } else {
                    LazyVStack(spacing: 12) {
                        ForEach(config.customContainers) { custom in
                            let container = dockerVM.customContainers.first { $0.name == custom.name }
                            ContainerCardView(
                                name: custom.name,
                                displayName: custom.name,
                                image: custom.image,
                                sfSymbol: "shippingbox",
                                description: "Custom container",
                                container: container,
                                logs: dockerVM.logs[custom.name],
                                onStart: { Task { await dockerVM.startCustomContainer(custom) } },
                                onStop: { Task { await dockerVM.stopContainer(name: custom.name) } },
                                onRestart: { Task { await dockerVM.restartContainer(name: custom.name) } },
                                onFetchLogs: { Task { await dockerVM.fetchLogs(name: custom.name) } },
                                onRemove: { removeContainer(custom) }
                            )
                        }
                    }
                }
            }
            .padding(24)
        }
        .background(Color.ocBackground)
        .sheet(isPresented: $showAddSheet) {
            AddContainerSheet { newContainer in
                config.customContainers.append(newContainer)
                try? ConfigService.save(config)
                dockerVM.configure(config: config)
            }
        }
    }

    private func removeContainer(_ container: CustomContainerConfig) {
        config.customContainers.removeAll { $0.id == container.id }
        try? ConfigService.save(config)
        dockerVM.configure(config: config)
    }
}
