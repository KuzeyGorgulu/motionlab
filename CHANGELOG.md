# Changelog

All notable changes to MotionLab are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-20

### Added

- Local video import, analysis-oriented transport controls, and aligned native-coordinate overlays.
- Editable Point, Line, and Angle annotations with frame association and independent undo/redo.
- Planar scale, origin, and axis calibration with pixel-to-world coordinate conversion.
- Editable multi-object manual tracking and experimental local assisted tracking with reviewable suggestions, adaptive bounded search, and recovery.
- Timestamp-based position, displacement, path distance, velocity, speed, and acceleration analysis.
- Synchronized motion graphs, non-destructive smoothing, constant-velocity/constant-acceleration fitting, fit diagnostics, and residual analysis.
- Versioned `.motionlab` project save/reopen with explicit local-video relinking and mismatch guidance.
- Scientific CSV/JSON data export, standalone SVG graph export, configurable experiment reports, print/PDF workflow, and offline HTML reports.
- First-run onboarding, contextual workflow guidance, keyboard shortcut help, examples, About/Privacy information, and a bundled constant-speed sample experiment.
- Public release documentation, genuine v1 screenshots, assisted-tracking demo media, and release checklists.

### Changed

- Promoted the authoritative application/package version to `1.0.0` and exposed it through one UI version source.
- Polished important empty, loading, error, narrow-layout, keyboard-focus, and product-copy states for release readiness.
- Deferred report analysis construction until the Report workspace is opened and lazy-loaded its presentation module.
- Updated public documentation to describe the complete v1 product, privacy boundaries, exports, limitations, and semantic-version policy.

### Fixed

- Improved video errors with likely causes and practical recovery actions without exposing raw browser exceptions.
- Prevented a small analysis-workspace horizontal overflow at phone-width viewports.
- Restored focus to the invoking control when release dialogs close and explicitly focused the primary first-run action.

[1.0.0]: https://github.com/KuzeyGorgulu/motionlab/releases/tag/v1.0.0
