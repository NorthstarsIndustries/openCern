import SwiftUI

struct SettingsView: View {
    @Bindable var viewModel: SettingsViewModel
    let onConfigChanged: (LauncherConfig) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Settings")
                    .font(.title.weight(.bold))
                    .foregroundStyle(Color.ocText)

                formSection("Docker") {
                    formField("Socket Path", hint: "Leave empty for auto-detection") {
                        TextField("e.g. /var/run/docker.sock", text: $viewModel.dockerSocket)
                            .textFieldStyle(.roundedBorder)
                    }

                    formField("Data Directory", hint: "Where datasets are stored") {
                        TextField("Path", text: $viewModel.dataDir)
                            .textFieldStyle(.roundedBorder)
                    }
                }

                formSection("Updates") {
                    formField("Check Interval", hint: "How often to check for updates") {
                        Picker("", selection: $viewModel.updateIntervalSecs) {
                            ForEach(viewModel.updateIntervalOptions, id: \.1) { option in
                                Text(option.0).tag(option.1)
                            }
                        }
                        .frame(width: 200)
                    }
                }

                formSection("Behavior") {
                    Toggle("Auto-start services on launch", isOn: $viewModel.autoStart)
                        .foregroundStyle(Color.ocText)
                }

                HStack(spacing: 12) {
                    Button("Save") {
                        let config = viewModel.save()
                        onConfigChanged(config)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.ocGreen)

                    Button("Reset to Defaults") {
                        viewModel.reset()
                    }
                    .buttonStyle(.bordered)

                    if viewModel.saveSuccess {
                        Text("Saved!")
                            .foregroundStyle(Color.ocGreen)
                            .font(.caption)
                    }
                }

                Divider()

                aboutSection
            }
            .padding(24)
        }
        .background(Color.ocBackground)
    }

    private func formSection(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .foregroundStyle(Color.ocText)

            VStack(alignment: .leading, spacing: 16) {
                content()
            }
            .padding(16)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    private func formField(_ label: String, hint: String = "", @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color.ocText)
            if !hint.isEmpty {
                Text(hint)
                    .font(.caption2)
                    .foregroundStyle(Color.ocTextSecondary)
            }
            content()
        }
    }

    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("About")
                .font(.headline)
                .foregroundStyle(Color.ocText)

            let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
            Text("OpenCERN Launcher v\(version)")
                .foregroundStyle(Color.ocTextSecondary)
            Text("Native macOS launcher for OpenCERN services")
                .font(.caption)
                .foregroundStyle(Color.ocTextSecondary)
        }
    }
}
