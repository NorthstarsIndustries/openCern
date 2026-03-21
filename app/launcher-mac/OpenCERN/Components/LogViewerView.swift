import SwiftUI

struct LogViewerView: View {
    let logs: String
    let onRefresh: () -> Void

    @State private var autoRefreshTask: Task<Void, Never>?

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Logs")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Color.ocTextSecondary)
                Spacer()

                Button {
                    onRefresh()
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.caption)
                        .foregroundStyle(Color.ocTextSecondary)
                }
                .buttonStyle(.plain)

                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(logs, forType: .string)
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(.caption)
                        .foregroundStyle(Color.ocTextSecondary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)

            ScrollViewReader { proxy in
                ScrollView {
                    Text(logs)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Color.ocText.opacity(0.8))
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .id("logContent")
                }
                .onChange(of: logs) {
                    proxy.scrollTo("logContent", anchor: .bottom)
                }
            }
            .background(Color.black.opacity(0.3))
        }
        .onAppear {
            autoRefreshTask = Task {
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(5))
                    onRefresh()
                }
            }
        }
        .onDisappear {
            autoRefreshTask?.cancel()
        }
    }
}
