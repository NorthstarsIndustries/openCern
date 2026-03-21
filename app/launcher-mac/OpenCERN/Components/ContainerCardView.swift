import SwiftUI

struct ContainerCardView: View {
    let name: String
    let displayName: String
    let image: String
    let sfSymbol: String
    let description: String
    let container: ContainerInfo?
    let logs: String?
    let onStart: () -> Void
    let onStop: () -> Void
    let onRestart: () -> Void
    let onFetchLogs: () -> Void
    var onRemove: (() -> Void)? = nil

    @State private var isExpanded = false

    private var state: ContainerState {
        container?.state ?? .unknown
    }

    private var isRunning: Bool {
        state.isRunning
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(spacing: 12) {
                // Left accent border
                RoundedRectangle(cornerRadius: 2)
                    .fill(isRunning ? Color.ocGreen : Color.ocRed.opacity(0.5))
                    .frame(width: 3, height: 40)

                Image(systemName: sfSymbol)
                    .font(.system(size: 20))
                    .foregroundStyle(isRunning ? Color.ocGreen : Color.ocTextSecondary)
                    .frame(width: 28)

                VStack(alignment: .leading, spacing: 2) {
                    Text(displayName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.ocText)

                    HStack(spacing: 6) {
                        StatusDot(state: state)

                        Text(container?.status ?? "Not created")
                            .font(.caption2)
                            .foregroundStyle(Color.ocTextSecondary)
                    }
                }

                Spacer()

                // Port badges
                if let container, !container.ports.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(container.ports) { port in
                            Text(":\(port.host)")
                                .font(.caption2.monospacedDigit())
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.ocSurface)
                                .clipShape(Capsule())
                                .foregroundStyle(Color.ocTextSecondary)
                        }
                    }
                }

                // Stats
                if let stats = container?.stats {
                    HStack(spacing: 8) {
                        Text("CPU \(String(format: "%.1f%%", stats.cpuPercent))")
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(Color.ocTextSecondary)
                        Text("MEM \(String(format: "%.0fMB", stats.memoryUsageMB))")
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(Color.ocTextSecondary)
                    }
                }

                // Action buttons
                HStack(spacing: 4) {
                    if isRunning {
                        actionButton("stop.fill", color: Color.ocRed, action: onStop)
                        actionButton("arrow.clockwise", color: Color.ocYellow, action: onRestart)
                    } else {
                        actionButton("play.fill", color: Color.ocGreen, action: onStart)
                    }

                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            isExpanded.toggle()
                        }
                        if isExpanded { onFetchLogs() }
                    } label: {
                        Image(systemName: "chevron.down")
                            .font(.caption)
                            .foregroundStyle(Color.ocTextSecondary)
                            .rotationEffect(.degrees(isExpanded ? 180 : 0))
                    }
                    .buttonStyle(.plain)

                    if let onRemove {
                        actionButton("trash", color: Color.ocRed, action: onRemove)
                    }
                }
            }
            .padding(12)

            // Expanded: Logs
            if isExpanded {
                Divider()
                LogViewerView(
                    logs: logs ?? "Loading...",
                    onRefresh: onFetchLogs
                )
                .frame(height: 200)
            }
        }
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.ocBorder, lineWidth: 1)
        )
    }

    private func actionButton(_ symbol: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 12))
                .foregroundStyle(color)
                .frame(width: 28, height: 28)
                .background(color.opacity(0.1))
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
    }
}
