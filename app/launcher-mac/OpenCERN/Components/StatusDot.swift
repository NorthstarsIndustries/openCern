import SwiftUI

struct StatusDot: View {
    let state: ContainerState
    var showLabel: Bool = false

    private var color: Color {
        switch state {
        case .running: return .ocGreen
        case .exited, .dead, .removing: return .ocRed
        case .paused, .restarting, .created: return .ocYellow
        case .unknown: return .ocTextSecondary
        }
    }

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)

            if showLabel {
                Text(state.rawValue.capitalized)
                    .font(.caption2)
                    .foregroundStyle(Color.ocTextSecondary)
            }
        }
    }
}
