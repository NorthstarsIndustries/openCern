import SwiftUI

struct SetupView: View {
    @Bindable var viewModel: SetupViewModel
    let onComplete: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            // Left: Step indicators
            VStack(spacing: 24) {
                ForEach(SetupStep.allCases, id: \.rawValue) { step in
                    stepIndicator(step)
                }
                Spacer()
            }
            .padding(32)
            .frame(width: 200)
            .background(.ultraThinMaterial)

            // Right: Step content
            VStack {
                Spacer()
                stepContent
                Spacer()
            }
            .frame(maxWidth: .infinity)
            .padding(40)
        }
        .background(Color.ocBackground)
        .onAppear {
            Task { await viewModel.checkDocker() }
        }
    }

    private func stepIndicator(_ step: SetupStep) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(step.rawValue <= viewModel.currentStep.rawValue ? Color.ocGreen : Color.ocSurface)
                    .frame(width: 32, height: 32)

                if step.rawValue < viewModel.currentStep.rawValue {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.black)
                } else {
                    Text("\(step.rawValue + 1)")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(step.rawValue <= viewModel.currentStep.rawValue ? .black : Color.ocTextSecondary)
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(step.title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.ocText)
                Text(step.description)
                    .font(.caption2)
                    .foregroundStyle(Color.ocTextSecondary)
            }
        }
    }

    @ViewBuilder
    private var stepContent: some View {
        switch viewModel.currentStep {
        case .dockerCheck:
            dockerCheckContent
        case .pullImages:
            pullImagesContent
        case .complete:
            completeContent
        }
    }

    private var dockerCheckContent: some View {
        VStack(spacing: 20) {
            Image(systemName: "shippingbox")
                .font(.system(size: 48))
                .foregroundStyle(Color.ocBlue)

            Text("Checking Docker")
                .font(.title2.weight(.semibold))
                .foregroundStyle(Color.ocText)

            if viewModel.isChecking {
                ProgressView()
                    .controlSize(.large)
            } else if let error = viewModel.error {
                Text(error)
                    .foregroundStyle(Color.ocRed)
                    .multilineTextAlignment(.center)

                Button("Retry") {
                    Task { await viewModel.checkDocker() }
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.ocBlue)
            } else {
                HStack(spacing: 8) {
                    StatusDot(state: viewModel.dockerInstalled ? .running : .exited)
                    Text(viewModel.dockerInstalled ? "Docker installed" : "Docker not found")
                        .foregroundStyle(Color.ocText)
                }
                HStack(spacing: 8) {
                    StatusDot(state: viewModel.dockerRunning ? .running : .exited)
                    Text(viewModel.dockerRunning ? "Docker running" : "Docker not running")
                        .foregroundStyle(Color.ocText)
                }
            }
        }
    }

    private var pullImagesContent: some View {
        VStack(spacing: 20) {
            Image(systemName: "arrow.down.circle")
                .font(.system(size: 48))
                .foregroundStyle(Color.ocBlue)

            Text("Pulling Images")
                .font(.title2.weight(.semibold))
                .foregroundStyle(Color.ocText)

            if viewModel.pullImageTotal > 0 {
                Text("Image \(viewModel.pullImageIndex) of \(viewModel.pullImageTotal)")
                    .foregroundStyle(Color.ocTextSecondary)
            }

            Text(viewModel.pullStatus)
                .font(.caption)
                .foregroundStyle(Color.ocTextSecondary)
                .lineLimit(1)

            ProgressBarView(value: viewModel.pullProgress / 100)
                .frame(width: 300, height: 8)

            Text("\(Int(viewModel.pullProgress))%")
                .font(.caption.monospacedDigit())
                .foregroundStyle(Color.ocTextSecondary)
        }
        .onAppear {
            Task { await viewModel.pullImages() }
        }
    }

    private var completeContent: some View {
        VStack(spacing: 20) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 48))
                .foregroundStyle(Color.ocGreen)

            Text("Setup Complete")
                .font(.title2.weight(.semibold))
                .foregroundStyle(Color.ocText)

            Text("All services are ready to launch.")
                .foregroundStyle(Color.ocTextSecondary)

            Button("Get Started") {
                viewModel.completeSetup()
                onComplete()
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.ocGreen)
            .controlSize(.large)
        }
    }
}
