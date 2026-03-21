import SwiftUI

struct ProgressBarView: View {
    let value: Double // 0.0 to 1.0, negative for indeterminate

    @State private var pulseOffset: CGFloat = -1

    var isIndeterminate: Bool { value < 0 }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.ocSurface)

                if isIndeterminate {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.ocBlue)
                        .frame(width: geo.size.width * 0.3)
                        .offset(x: pulseOffset * geo.size.width)
                        .onAppear {
                            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                                pulseOffset = 0.7
                            }
                        }
                } else {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.ocGreen)
                        .frame(width: max(0, geo.size.width * min(value, 1.0)))
                        .animation(.easeInOut(duration: 0.3), value: value)
                }
            }
        }
    }
}
