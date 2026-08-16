# MotionLab Agent Guide

MotionLab is a local-first browser application for extracting physical measurements from ordinary videos. It is intended to become a reliable scientific tool, not a demo. The current repository contains the video workspace and a manual point/line/angle annotation layer.

## Non-negotiable constraints

- User videos stay on the user's device. Never upload video or derived frame data, add telemetry, or require a backend, account, paid API, or API key.
- Keep video, overlay geometry, future calibration/tracking, physics, and React presentation separated. Physics and mathematical logic must remain pure and independently testable.
- Use strict TypeScript. Prefer small, clearly named modules and comments that explain non-obvious reasoning.
- Work incrementally. Implement only the active roadmap phase and do not build speculative systems or silently rewrite unrelated working code.
- Add dependencies only when they provide concrete value in the current phase. In particular, do not add OpenCV.js, MediaPipe, a charting library, IndexedDB wrappers, or state libraries until their phase requires them.
- Do not copy or process whole videos unnecessarily. Preserve Object URL cleanup. Design expensive future frame work so it can move into Web Workers.

## Working conventions

- Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md` before material changes.
- Keep project/domain data distinct from transient playback and UI state. React hooks are sufficient until a demonstrated need justifies a state library.
- Treat media timestamps as the primary timing source. Never label arbitrary seeking or fallback-FPS stepping as exact frame access.
- Keep overlay coordinate transforms in pure utilities. Changes to geometry or physics math require unit tests, including boundary and round-trip cases.
- Store annotation geometry only in native video coordinates. Display coordinates are transient input/rendering values and must never enter project state.
- Associate frame-local data through `TimestampFrameReference`; do not compare floating-point media timestamps directly. Preserve its exact anchor timestamp for future migration.
- Keep annotation mutations in the annotation reducer. Playback and seeking never belong in annotation undo history.
- Handle unsupported media, missing metadata, failed playback, replacement, and cleanup explicitly.
- Maintain keyboard access, visible focus states, labels for icon-only controls, and clear disabled states.

## Definition of done for a change

Run and report:

1. `npm test`
2. `npm run typecheck`
3. `npm run build`

Also update architecture or roadmap documentation when a decision or phase changes. Do not claim an unimplemented future subsystem exists.
