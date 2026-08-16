# MotionLab Three-Week Roadmap

The sequence favors complete vertical slices over parallel unfinished systems. Timing may change as browser/media edge cases are discovered.

## Week 1: measurement foundations

### Phase 1 — Video workspace (current)

Deliver local import/removal, playback, seeking, precise timestamp display, approximate frame stepping, speed selection, metadata/error handling, shortcuts, and a correctly aligned native-coordinate canvas.

Acceptance criteria:

- A local supported video can be loaded, changed, removed, played, paused, and sought without uploading it.
- Object URLs are revoked on replacement, removal, and unmount.
- Current time and duration are visible; controls handle unavailable metadata safely.
- Frame stepping is isolated and honestly labeled as approximate with a documented FPS fallback.
- Overlay geometry remains aligned through aspect-ratio letterboxing and stage resize.
- Geometry tests, strict TypeScript, unit tests, and production build pass.

### Phase 2 — Scene calibration

Add two-point scale calibration, real-distance/unit input, origin selection, axis orientation, and a small calibration summary. Persist all points in native video coordinates.

Acceptance criteria:

- A user can place/edit calibration points and enter a valid known distance.
- Pixel-to-real scale and coordinate transforms are pure, tested functions.
- Calibration visuals remain aligned at different viewport sizes.
- Invalid/incomplete calibration is explained and cannot produce measurements.

### Phase 3 — Manual tracking

Create a timestamp-oriented manual point workflow with add, replace, delete, step-and-mark, and visible trajectory history.

Acceptance criteria:

- Points are stored by media timestamp in native video coordinates.
- A user can correct/delete any point without losing unrelated samples.
- The overlay distinguishes the active point and trajectory clearly.
- Track editing works with keyboard navigation and calibrated or pixel coordinates.

## Week 2: turn tracks into measurements

### Phase 4 — Physics engine

Implement independently tested sample validation, calibrated `x(t)`/`y(t)`, displacement, finite-difference velocity, speed, and acceleration. Define edge handling and smoothing policy before adding smoothing.

Acceptance criteria:

- Pure TypeScript functions accept timestamped tracks and return typed series.
- Units, coordinate orientation, irregular time intervals, and insufficient samples are handled explicitly.
- Analytic fixtures cover constant velocity and constant acceleration.
- Physics modules import no React or canvas code.

### Phase 5 — Visualization

Add trajectory inspection and focused position/velocity/acceleration graphs with selectable series and cursor-time linkage.

Acceptance criteria:

- Graph cursor and video timestamp can be compared reliably.
- Axes include quantity and units; no fake values appear.
- Dense and sparse tracks remain legible.
- Any chart dependency is selected only after accessibility, bundle, and export needs are evaluated.

## Week 3: assistance, export, and hardening

### Phase 6 — Assisted tracking

Prototype local browser-side tracking behind a replaceable worker-friendly interface. Manual tracking and correction remain first-class.

Acceptance criteria:

- The user explicitly seeds a target and can stop/restart assistance.
- Results are editable manual-quality track points, not a separate locked format.
- Failures are visible and do not overwrite confirmed points silently.
- Performance is measured on representative video; large work does not freeze the UI unnecessarily.

### Phase 7 — Export, polish, and end-to-end tests

Add CSV export for raw and processed data, project recovery appropriate to the stabilized schema, UX/error polish, and Playwright coverage for critical flows.

Acceptance criteria:

- CSV includes timestamps, coordinates, units, and clear headers.
- Exported numerical fixtures match tested physics results.
- Important import → calibrate → track → analyze → export paths have end-to-end coverage.
- Privacy claims, browser limitations, supported formats, and recovery behavior are documented.
- No server, telemetry, paid API, or required account is introduced.
