import SwiftUI
import AVKit

struct SplashView: View {
    let onDismiss: () -> Void

    @State private var showTitle = false
    @State private var player: AVPlayer?

    var body: some View {
        ZStack {
            Color.ocBackground.ignoresSafeArea()

            if let player {
                VideoPlayer(player: player)
                    .disabled(true)
                    .ignoresSafeArea()
            }

            VStack {
                Spacer()

                Text("OpenCERN")
                    .font(.system(size: 48, weight: .bold, design: .default))
                    .foregroundStyle(.white)
                    .opacity(showTitle ? 1 : 0)
                    .offset(y: showTitle ? 0 : 20)

                Spacer()

                Text("Click anywhere to continue")
                    .font(.caption)
                    .foregroundStyle(Color.ocTextSecondary)
                    .opacity(showTitle ? 0.6 : 0)
                    .padding(.bottom, 40)
            }
        }
        .onTapGesture { onDismiss() }
        .onAppear {
            if let url = Bundle.main.url(forResource: "collision", withExtension: "mp4") {
                player = AVPlayer(url: url)
                player?.isMuted = true
                player?.play()
            }

            withAnimation(.easeOut(duration: 1.0).delay(0.5)) {
                showTitle = true
            }

            // Auto-dismiss after 3 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                onDismiss()
            }
        }
    }
}
