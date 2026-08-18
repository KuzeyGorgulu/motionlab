# MotionLab Agent Guide

MotionLab is a local-first browser application for extracting physical measurements from ordinary videos. It is intended to become a reliable scientific tool, not a demo. The current repository contains the video workspace, manual point/line/angle annotations, single-scale planar world-coordinate calibration, manual multi-object tracks, and derived kinematic analysis.

## Non-negotiable constraints

- User videos stay on the user's device. Never upload video or derived frame data, add telemetry, or require a backend, account, paid API, or API key.
- Keep video, overlay geometry, annotations, calibration, tracking, physics, and React presentation separated. Physics and mathematical logic must remain pure and independently testable.
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
- Keep tracks distinct from Point annotations. A track is an ordered time series whose samples store stable IDs, exact media anchor time, `TimestampFrameReference`, and native-video position only.
- Enforce at most one sample per track per frame identity. A same-bucket remark updates only the existing native position and preserves the original sample ID and anchor timestamp.
- Keep track mutations in the independent tracking history. Drag previews are transient and a completed sample drag is one undo step. Track selection, playback, and seeking are not history mutations.
- Derive sample ordering by time and frame identity; never assume users marked sequentially or use an integer frame estimate as authoritative identity.
- Derive kinematics from exact sample anchor timestamps and current calibration. Never use the approximate 30 fps step fallback as an analysis timestep.
- Keep position, displacement, distance, velocity, speed, and acceleration out of track state. Analysis results are immutable projections that update when tracks or calibration change.
- Represent insufficient or invalid derivative estimates as unavailable. Never emit `NaN`, `Infinity`, or a fabricated zero, and do not silently interpolate or smooth observations.
- Preserve dimensional units: a position unit `u` implies velocity `u/s` and acceleration `u/s²`; uncalibrated analysis must remain visibly pixel-based.
- Build visualization families only from existing derived samples and give every series in a family the full analyzed-track media-time domain. Missing derivative points stay missing; never narrow a derivative graph's time domain to only its available points.
- Keep the continuous video playhead separate from the transient graph cursor and frame-reference-selected sample. Arbitrary graph cursor positions are time-only, are never persisted, and must not imply interpolated measurements.
- Store calibration reference points and origin in native video coordinates. Store only the normalized image-space positive-X basis; derive positive Y as `(xAxis.y, -xAxis.x)` so image-down becomes Cartesian world-up.
- Keep full precision in calibration and transforms. Store no derived world coordinates in annotations or tracks; derive them from native positions and the active calibration.
- Calibration is video-scoped, session-only, and independent from annotation undo history. Replacing/removing a video must clear it without deleting annotations through calibration actions.
- Tracking is video-scoped and session-only. Replacing/removing a video clears every track and sample. Resetting calibration must never clear or mutate native track geometry.
- Route canvas input through one explicit domain mode. Annotation creation/editing, calibration capture, Track Mark, and Track Edit must never handle the same pointer event.
- Never describe a single scale as perspective correction. It applies only to motion and references that are approximately coplanar.
- Handle unsupported media, missing metadata, failed playback, replacement, and cleanup explicitly.
- Maintain keyboard access, visible focus states, labels for icon-only controls, and clear disabled states.

## Definition of done for a change

Run and report:

1. `npm test`
2. `npm run typecheck`
3. `npm run build`

Also update architecture or roadmap documentation when a decision or phase changes. Do not claim an unimplemented future subsystem exists.
