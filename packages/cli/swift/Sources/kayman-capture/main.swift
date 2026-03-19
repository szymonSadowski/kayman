import Foundation
import ScreenCaptureKit
import AVFoundation

// MARK: - Argument Parsing

enum AudioSource: String {
    case systemAndMic = "system_and_mic"
    case micOnly = "mic_only"
    case systemOnly = "system_only"
}

func parseArgs() -> (source: AudioSource, output: String)? {
    var args = Array(CommandLine.arguments.dropFirst())
    var source: AudioSource?
    var output: String?

    while !args.isEmpty {
        let arg = args.removeFirst()
        switch arg {
        case "--source":
            guard !args.isEmpty else {
                fputs("Error: --source requires a value\n", stderr); return nil
            }
            let val = args.removeFirst()
            guard let s = AudioSource(rawValue: val) else {
                fputs("Error: --source must be system_and_mic, mic_only, or system_only\n", stderr); return nil
            }
            source = s
        case "--output":
            guard !args.isEmpty else {
                fputs("Error: --output requires a value\n", stderr); return nil
            }
            output = args.removeFirst()
        default:
            fputs("Error: unknown argument \(arg)\n", stderr); return nil
        }
    }

    guard let s = source, let o = output else {
        fputs("Usage: kayman-capture --source <system_and_mic|mic_only|system_only> --output <path.caf>\n", stderr)
        return nil
    }
    return (s, o)
}

// MARK: - Capture Session

class CaptureSession: NSObject, SCStreamOutput, SCStreamDelegate {
    private var stream: SCStream?
    private var audioFile: AVAudioFile?
    private var stopping = false
    private let stopLock = NSLock()

    func start(source: AudioSource, outputPath: String) async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)

        guard let display = content.displays.first else {
            fputs("Error: no display found — ScreenCaptureKit requires a connected display even for mic-only capture. Ensure a display is attached and Screen Recording permission is granted in System Settings.\n", stderr); exit(1)
        }

        let config = SCStreamConfiguration()
        config.capturesAudio = (source == .systemAndMic || source == .systemOnly)
        config.captureMicrophone = (source == .systemAndMic || source == .micOnly)
        config.sampleRate = 44100
        config.channelCount = 2
        // Minimize video overhead — audio-only capture
        config.width = 2
        config.height = 2
        config.minimumFrameInterval = CMTime(value: 1, timescale: 1)

        let filter = SCContentFilter(display: display, excludingWindows: [])
        stream = SCStream(filter: filter, configuration: config, delegate: self)

        let outputURL = URL(fileURLWithPath: outputPath)
        let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2)!
        audioFile = try AVAudioFile(forWriting: outputURL, settings: format.settings)

        try stream!.addStreamOutput(self, type: .audio, sampleHandlerQueue: .global())
        try await stream!.startCapture()
        fputs("Recording started\n", stderr)
    }

    func stop() {
        stopLock.lock()
        defer { stopLock.unlock() }
        guard !stopping else { return }
        stopping = true

        Task {
            try? await stream?.stopCapture()
            audioFile = nil  // flushes + closes the file
            fputs("Recording stopped, file finalized\n", stderr)
            exit(0)
        }
    }

    // MARK: SCStreamOutput

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio else { return }
        stopLock.lock()
        let isStopping = stopping
        stopLock.unlock()
        guard !isStopping, let audioFile else { return }

        guard let pcmBuffer = sampleBuffer.asPCMBuffer(targetFormat: audioFile.processingFormat) else { return }
        do {
            try audioFile.write(from: pcmBuffer)
        } catch {
            fputs("Error: failed to write audio frame — \(error)\n", stderr)
        }
    }

    // MARK: SCStreamDelegate

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        fputs("Stream error: \(error)\n", stderr)
        stop()
    }
}

// MARK: - CMSampleBuffer Conversion

extension CMSampleBuffer {
    func asPCMBuffer(targetFormat: AVAudioFormat) -> AVAudioPCMBuffer? {
        guard let formatDesc = CMSampleBufferGetFormatDescription(self),
              let streamDesc = CMAudioFormatDescriptionGetStreamBasicDescription(formatDesc),
              let sourceFormat = AVAudioFormat(streamDescription: streamDesc) else { return nil }

        let frameCount = UInt32(CMSampleBufferGetNumSamples(self))
        guard frameCount > 0 else { return nil }

        guard let sourceBuffer = AVAudioPCMBuffer(pcmFormat: sourceFormat, frameCapacity: frameCount) else { return nil }
        sourceBuffer.frameLength = frameCount

        let status = CMSampleBufferCopyPCMDataIntoAudioBufferList(
            self, at: 0, frameCount: Int32(frameCount),
            into: sourceBuffer.mutableAudioBufferList
        )
        guard status == noErr else { return nil }

        // Convert to target format if needed
        if sourceFormat == targetFormat { return sourceBuffer }

        let targetFrameCount = AVAudioFrameCount(Double(frameCount) * targetFormat.sampleRate / sourceFormat.sampleRate)
        guard let converter = AVAudioConverter(from: sourceFormat, to: targetFormat),
              let outputBuffer = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: max(targetFrameCount, frameCount)) else { return nil }

        var error: NSError?
        var filled = false
        converter.convert(to: outputBuffer, error: &error) { _, outStatus in
            if !filled {
                filled = true
                outStatus.pointee = .haveData
                return sourceBuffer
            }
            outStatus.pointee = .noDataNow
            return nil
        }
        return error == nil ? outputBuffer : nil
    }
}

// MARK: - Entry Point

guard let (source, outputPath) = parseArgs() else { exit(1) }

let session = CaptureSession()

// SIGTERM handler — stop capture and finalize file
let sigSource = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .global())
signal(SIGTERM, SIG_IGN)
sigSource.setEventHandler { session.stop() }
sigSource.resume()

Task {
    do {
        try await session.start(source: source, outputPath: outputPath)
    } catch {
        fputs("Fatal: \(error)\n", stderr)
        exit(1)
    }
}

RunLoop.main.run()
