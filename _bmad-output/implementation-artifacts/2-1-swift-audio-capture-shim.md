# Story 2.1: Swift Audio Capture Shim

Status: in-progress

## Story

As a developer,
I want a prebuilt Swift CLI binary (`kayman-capture`) that records audio via ScreenCaptureKit,
so that Node.js can spawn it as a subprocess without requiring users to have Swift installed.

## Acceptance Criteria

1. **Given** `packages/cli/bin/kayman-capture` exists (prebuilt binary committed to repo)
   **When** `kayman-capture --source system_and_mic --output /tmp/test.caf` is run
   **Then** it begins writing audio to the specified `.caf` file

2. **Given** `kayman-capture` is running
   **When** it receives `SIGTERM`
   **Then** it finalizes the `.caf` file and exits cleanly (no truncated/corrupt audio)

3. **Given** `--source mic_only` or `--source system_only` is passed
   **When** recording runs
   **Then** only the specified audio source is captured (FR6)

## Tasks / Subtasks

- [x] Task 1 — Scaffold Swift package (AC: #1)
  - [x] Create `packages/cli/swift/Package.swift` with executable target `kayman-capture`
  - [x] Create `packages/cli/swift/Sources/kayman-capture/main.swift`
  - [x] Confirm `swift build -c release` succeeds on macOS (Apple Silicon)

- [x] Task 2 — Implement CLI argument parsing (AC: #1, #3)
  - [x] Parse `--source <value>` flag (valid values: `system_and_mic`, `mic_only`, `system_only`)
  - [x] Parse `--output <path>` flag (required; absolute path to `.caf` output file)
  - [x] Print usage and exit 1 if required args missing or invalid

- [x] Task 3 — Implement ScreenCaptureKit audio capture (AC: #1, #3)
  - [x] Request screen/audio capture permission via `SCShareableContent` (ScreenCaptureKit)
  - [x] Configure `SCStreamConfiguration` for audio only (no video frames needed)
  - [x] Conditionally enable `capturesAudio` and `captureMicrophone` based on `--source`
  - [x] Route captured audio buffers to an `AVAudioFile` writer targeting the `--output` path in `.caf` format

- [x] Task 4 — Implement clean SIGTERM shutdown (AC: #2)
  - [x] Register a `signal(SIGTERM, ...)` handler
  - [x] On SIGTERM: stop the `SCStream`, flush and close the `AVAudioFile`, then exit 0
  - [x] Ensure the `.caf` file is finalized (not left open/truncated) before exit

- [x] Task 5 — Build, test, and commit prebuilt binary (AC: #1, #2, #3)
  - [x] Run `swift build -c release` from `packages/cli/swift/`
  - [x] Copy built binary to `packages/cli/bin/kayman-capture`
  - [x] Make binary executable: `chmod +x packages/cli/bin/kayman-capture`
  - [ ] Manually verify: start recording, let it run 5s, send SIGTERM, confirm `.caf` is playable (requires Screen Recording permission granted in System Settings)
  - [ ] Commit binary to git (`packages/cli/bin/kayman-capture` tracked in repo)
  - [x] Add `packages/cli/swift/.build/` to `.gitignore`

## Dev Notes

### Tech Stack
- **Language:** Swift 5.9+ (available on macOS Sequoia / Sonoma with Xcode CLI tools)
- **Frameworks:** ScreenCaptureKit (audio capture), AVFoundation (audio file writing)
- **Build:** `swift build -c release` — no Node.js involvement; binary is standalone
- **Output format:** Core Audio Format (`.caf`) — native macOS audio container, wraps PCM data

### ScreenCaptureKit Permission Model
ScreenCaptureKit requires the app to be authorized for screen recording. For a CLI tool:
- The first run will trigger macOS permission dialog (System Preferences → Privacy & Security → Screen Recording)
- Subsequent runs proceed without dialog if permission was granted
- The binary must be signed or the user must explicitly grant permission; for development, an unsigned binary works if the user approves it manually

### Key API Pattern — SCStream for audio-only capture
```swift
import ScreenCaptureKit
import AVFoundation

// 1. Get shareable content
let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)

// 2. Configure stream — audio only, no video frames
let config = SCStreamConfiguration()
config.capturesAudio = true          // system audio
config.captureMicrophone = true      // mic audio (set based on --source flag)
config.sampleRate = 44100
config.channelCount = 2

// 3. Create stream with a display (required even for audio-only)
let display = content.displays.first!  // use primary display
let filter = SCContentFilter(display: display, excludingWindows: [])
let stream = SCStream(filter: filter, configuration: config, delegate: nil)

// 4. Add audio output
try stream.addStreamOutput(audioOutputHandler, type: .audio, sampleHandlerQueue: .global())
try await stream.startCapture()
```

### Key API Pattern — Writing .caf with AVAudioFile
```swift
import AVFoundation

let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2)!
let outputURL = URL(fileURLWithPath: outputPath)
let audioFile = try AVAudioFile(forWriting: outputURL, settings: format.settings)

// In audio buffer callback (SCStreamOutput delegate):
func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
    guard type == .audio else { return }
    // Convert CMSampleBuffer → AVAudioPCMBuffer and write
    if let pcmBuffer = sampleBuffer.asPCMBuffer() {
        try? audioFile.write(from: pcmBuffer)
    }
}
```

### `--source` flag behaviour
| `--source` value | `capturesAudio` | `captureMicrophone` |
|---|---|---|
| `system_and_mic` | `true` | `true` |
| `system_only` | `true` | `false` |
| `mic_only` | `false` | `true` |

### SIGTERM Handler Pattern
```swift
import Foundation

signal(SIGTERM) { _ in
    // Stop stream and close file — must be synchronous
    // Use DispatchSemaphore or RunLoop.exit() to unblock main thread
    stopCapture()  // sets a shared flag, stream delegate finalizes file
    exit(0)
}

RunLoop.main.run()  // keep process alive until signal
```

### Package.swift template
```swift
// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "kayman-capture",
    platforms: [.macOS(.v13)],   // ScreenCaptureKit audio capture requires macOS 13+
    targets: [
        .executableTarget(
            name: "kayman-capture",
            path: "Sources/kayman-capture"
        )
    ]
)
```

**macOS minimum version:** `.macOS(.v13)` — `SCStream.captureMicrophone` requires macOS 13 (Ventura). The project targets M-series Macs which all support Ventura+.

### File Structure to Create
```
packages/cli/
├── bin/
│   └── kayman-capture          ← prebuilt binary committed here
└── swift/
    ├── Package.swift
    └── Sources/
        └── kayman-capture/
            └── main.swift
```

Add to root `.gitignore`:
```
packages/cli/swift/.build/
```

### Project Structure Notes
- Binary lives at `packages/cli/bin/kayman-capture` — this is the path Node.js commands will use when spawning it (Story 2.3)
- Swift source lives at `packages/cli/swift/` — compile locally, commit binary
- No `tsup` changes needed for this story — binary is not TypeScript
- No changes to `@kayman/shared` for this story
- Story 2.3 (`kayman start`) will spawn this binary using `child_process.spawn` — the exact spawn signature will be: `spawn('<path>/kayman-capture', ['--source', config.audioSource, '--output', audioPath])`

### References
- Story requirements: [Source: _bmad-output/planning-artifacts/epics.md#Story-2.1:-Swift-Audio-Capture-Shim]
- Architecture — audio capture design: [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure-&-Deployment]
- Architecture — file storage layout: [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture]
- Architecture — binary location: [Source: _bmad-output/planning-artifacts/architecture.md#Complete-Project-Directory-Structure]
- FR5: System captures system audio and microphone audio during a recording session
- FR6: User can configure which audio inputs to capture (system, mic, or both)
- Architecture quote: "Shim ships as a prebuilt binary in the repo (no Swift toolchain required at runtime)"

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `captureMicrophone` requires macOS 15+ (not 13 as story stated) → bumped Package.swift to swift-tools-version:6.0 + `.macOS(.v15)`
- Swift 6 strict concurrency errors in Task/NSLock pattern → added `.swiftLanguageMode(.v5)` setting
- `AVAudioFormat(streamDescription:)` takes a pointer, not a value → used `streamDesc` directly (not `.pointee`)
- Manual verification blocked by TCC permissions on Claude Code terminal; binary correct, usage string confirmed

### Completion Notes List

- Implemented Swift CLI binary with ScreenCaptureKit + AVFoundation
- `--source` flag controls `capturesAudio`/`captureMicrophone` per spec table
- SIGTERM handled via `DispatchSource.makeSignalSource` (POSIX-safe); stops stream, nils `audioFile` (flushes/closes), then `exit(0)`
- `CMSampleBuffer → AVAudioPCMBuffer` conversion via `CMSampleBufferCopyPCMDataIntoAudioBufferList` + `AVAudioConverter` for format mismatch
- Binary is arm64 Mach-O, 95K, at `packages/cli/bin/kayman-capture`
- Swift source committed at `packages/cli/swift/`; `.build/` excluded via `.gitignore`

### Code Review Fixes (2026-03-19)

- **[HIGH]** Status reverted to `in-progress` — binary untracked/uncommitted, Tasks 5.4/5.5 still incomplete; AC1 not fully satisfied
- **[HIGH]** `try? audioFile.write(from: pcmBuffer)` → `do/catch` with `fputs` error logging; write failures now reported to stderr instead of silently dropping audio frames
- **[MEDIUM]** Improved `"no display found"` error message to explain ScreenCaptureKit display requirement and direct user to System Settings
- **[MEDIUM]** `outputBuffer` frame capacity now computed as `frameCount * targetRate / sourceRate` to prevent truncation on sample-rate mismatch
- **[MEDIUM]** Added `_bmad-output/sprint-board.md` to File List (was modified but undocumented)

### File List

packages/cli/swift/Package.swift
packages/cli/swift/Sources/kayman-capture/main.swift
packages/cli/bin/kayman-capture
.gitignore
_bmad-output/sprint-board.md
