import SwiftUI

struct AddContainerSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onAdd: (CustomContainerConfig) -> Void

    @State private var config = CustomContainerConfig.new()

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Add Custom Container")
                .font(.title2.weight(.semibold))
                .foregroundStyle(Color.ocText)

            Form {
                Section("Container") {
                    TextField("Name", text: $config.name)
                    TextField("Image (e.g. nginx:latest)", text: $config.image)
                    Toggle("Join opencern-net network", isOn: $config.joinNetwork)
                }

                Section("Port Mappings") {
                    ForEach(config.ports.indices, id: \.self) { i in
                        HStack {
                            TextField("Host", value: $config.ports[i].host, format: .number)
                                .frame(width: 80)
                            Text(":")
                            TextField("Container", value: $config.ports[i].container, format: .number)
                                .frame(width: 80)
                            Button(role: .destructive) {
                                config.ports.remove(at: i)
                            } label: {
                                Image(systemName: "minus.circle")
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    Button {
                        config.ports.append(PortMapping(host: 0, container: 0))
                    } label: {
                        Label("Add Port", systemImage: "plus")
                    }
                }

                Section("Volume Mappings") {
                    ForEach(config.volumes.indices, id: \.self) { i in
                        HStack {
                            TextField("Host Path", text: binding(for: i, keyPath: \.hostPath))
                                .frame(minWidth: 120)
                            Text(":")
                            TextField("Container Path", text: binding(for: i, keyPath: \.containerPath))
                                .frame(minWidth: 120)
                            Toggle("RO", isOn: binding(for: i, keyPath: \.readonly))
                            Button(role: .destructive) {
                                config.volumes.remove(at: i)
                            } label: {
                                Image(systemName: "minus.circle")
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    Button {
                        config.volumes.append(VolumeMapping(hostPath: "", containerPath: "", readonly: false))
                    } label: {
                        Label("Add Volume", systemImage: "plus")
                    }
                }

                Section("Environment Variables") {
                    ForEach(config.envVars.indices, id: \.self) { i in
                        HStack {
                            TextField("Key", text: $config.envVars[i].key)
                            TextField("Value", text: $config.envVars[i].value)
                            Button(role: .destructive) {
                                config.envVars.remove(at: i)
                            } label: {
                                Image(systemName: "minus.circle")
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    Button {
                        config.envVars.append(EnvVar(key: "", value: ""))
                    } label: {
                        Label("Add Variable", systemImage: "plus")
                    }
                }
            }
            .formStyle(.grouped)

            HStack {
                Spacer()
                Button("Cancel") { dismiss() }
                    .buttonStyle(.bordered)
                Button("Add") {
                    onAdd(config)
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.ocGreen)
                .disabled(config.name.isEmpty || config.image.isEmpty)
            }
        }
        .padding(24)
        .frame(width: 560, height: 520)
    }

    private func binding(for index: Int, keyPath: WritableKeyPath<VolumeMapping, String>) -> Binding<String> {
        Binding(
            get: { config.volumes[index][keyPath: keyPath] },
            set: { newValue in config.volumes[index][keyPath: keyPath] = newValue }
        )
    }

    private func binding(for index: Int, keyPath: WritableKeyPath<VolumeMapping, Bool>) -> Binding<Bool> {
        Binding(
            get: { config.volumes[index][keyPath: keyPath] },
            set: { newValue in config.volumes[index][keyPath: keyPath] = newValue }
        )
    }
}
