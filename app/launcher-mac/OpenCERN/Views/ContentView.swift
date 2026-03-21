import SwiftUI

enum AppScreen: Hashable {
    case splash
    case setup
    case main
}

enum SidebarItem: String, CaseIterable, Identifiable {
    case services = "Services"
    case containers = "Containers"
    case settings = "Settings"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .services: return "square.grid.2x2"
        case .containers: return "shippingbox"
        case .settings: return "gearshape"
        }
    }
}

struct ContentView: View {
    @State private var screen: AppScreen = .splash
    @State private var selectedSidebar: SidebarItem = .services
    @State private var config: LauncherConfig = ConfigService.load()

    @State private var dockerVM = DockerViewModel()
    @State private var setupVM = SetupViewModel()
    @State private var settingsVM = SettingsViewModel()
    @State private var updateVM = UpdateViewModel()

    var body: some View {
        Group {
            switch screen {
            case .splash:
                SplashView {
                    withAnimation(.easeInOut(duration: 0.3)) {
                        screen = config.setupComplete ? .main : .setup
                    }
                }
            case .setup:
                SetupView(viewModel: setupVM) {
                    config = ConfigService.load()
                    withAnimation(.easeInOut(duration: 0.3)) {
                        screen = .main
                    }
                }
            case .main:
                mainView
            }
        }
        .onAppear {
            setupVM.configure(config: config)
            dockerVM.configure(config: config)
            settingsVM.load(from: config)
            updateVM.configure(config: config)
        }
    }

    private var mainView: some View {
        NavigationSplitView {
            sidebar
        } detail: {
            detail
        }
        .onAppear {
            updateVM.startPeriodicChecks()
            if config.autoStart {
                Task { await dockerVM.startAll() }
            }
        }
        .onDisappear {
            updateVM.stopPeriodicChecks()
            dockerVM.stopPolling()
        }
    }

    private var sidebar: some View {
        List(SidebarItem.allCases, selection: $selectedSidebar) { item in
            Label(item.rawValue, systemImage: item.icon)
                .tag(item)
        }
        .safeAreaInset(edge: .bottom) {
            Button {
                NSWorkspace.shared.open(URL(string: "http://localhost:3000")!)
            } label: {
                Label("Open in Browser", systemImage: "globe")
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .foregroundStyle(Color.ocBlue)
        }
        .navigationSplitViewColumnWidth(min: 180, ideal: 200, max: 240)
    }

    @ViewBuilder
    private var detail: some View {
        switch selectedSidebar {
        case .services:
            DashboardView(dockerVM: dockerVM, updateVM: updateVM, config: config)
        case .containers:
            CustomContainersView(dockerVM: dockerVM)
        case .settings:
            SettingsView(viewModel: settingsVM) { newConfig in
                config = newConfig
                dockerVM.configure(config: config)
                updateVM.configure(config: config)
            }
        }
    }
}
