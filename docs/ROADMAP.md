# MotionLab Three-Week Roadmap

The sequence favors complete vertical slices over parallel unfinished systems. Timing may change as browser/media edge cases are discovered.

## Week 1: measurement foundations

### Phase 1 — Video workspace (complete)

Deliver local import/removal, playback, seeking, precise timestamp display, approximate frame stepping, speed selection, metadata/error handling, shortcuts, and a correctly aligned native-coordinate canvas.

Acceptance criteria:

- A local supported video can be loaded, changed, removed, played, paused, and sought without uploading it.
- Object URLs are revoked on replacement, removal, and unmount.
- Current time and duration are visible; controls handle unavailable metadata safely.
- Frame stepping is isolated and honestly labeled as approximate with a documented FPS fallback.
- Overlay geometry remains aligned through aspect-ratio letterboxing and stage resize.
- Geometry tests, strict TypeScript, unit tests, and production build pass.

### Phase 2 — Manual measurement and annotation layer (complete)

Add frame-local Point, Line, and Angle creation, selection, native-coordinate handle editing, pixel/degree measurements, a lightweight inspector, and annotation undo/redo.

Acceptance criteria:

- Point, Line, and Angle geometry can be created and edited in native video coordinates.
- Lines report pixel length and angles report degrees with controlled degenerate cases.
- Timestamp buckets keep annotations isolated to the intended approximate frame position.
- Creation, update, deletion, frame association, measurements, hit-testing, and undo/redo are tested.
- Existing playback, resize alignment, local-file privacy, tests, and build remain intact.

### Phase 3 — Scene calibration (complete)

Add two-point scale calibration, real-distance/unit input, origin selection, axis orientation, and a small calibration summary. Reuse native-coordinate geometry and keep calibration separate from frame-local annotations.

Acceptance criteria:

- A user can place/edit calibration points and enter a valid known distance.
- Pixel-to-real scale and coordinate transforms are pure, tested functions.
- Calibration visuals remain aligned at different viewport sizes.
- Invalid/incomplete calibration is explained and cannot produce measurements.
- Pixel-to-world and world-to-pixel transforms round-trip within numeric tolerance.
- Calibrated Line and Point displays are derived from unchanged native annotation geometry.
- Reset and video replacement clear calibration without coupling it to annotations.

## Week 2: turn annotation points into motion data

### Phase 4 — Manual tracking (recommended next)

Create a timestamp-oriented manual point workflow with add, replace, delete, step-and-mark, and visible trajectory history.

Acceptance criteria:

- Points are stored by media timestamp in native video coordinates.
- A user can correct/delete any point without losing unrelated samples.
- The overlay distinguishes the active point and trajectory clearly.
- Track editing works with keyboard navigation and calibrated or pixel coordinates.

### Phase 5 — Physics engine

Implement independently tested sample validation, calibrated `x(t)`/`y(t)`, displacement, finite-difference velocity, speed, and acceleration. Define edge handling and smoothing policy before adding smoothing.

Acceptance criteria:

- Pure TypeScript functions accept timestamped tracks and return typed series.
- Units, coordinate orientation, irregular time intervals, and insufficient samples are handled explicitly.
- Analytic fixtures cover constant velocity and constant acceleration.
- Physics modules import no React or canvas code.

### Phase 6 — Visualization

Add trajectory inspection and focused position/velocity/acceleration graphs with selectable series and cursor-time linkage.

Acceptance criteria:

- Graph cursor and video timestamp can be compared reliably.
- Axes include quantity and units; no fake values appear.
- Dense and sparse tracks remain legible.
- Any chart dependency is selected only after accessibility, bundle, and export needs are evaluated.

## Week 3: assistance, export, and hardening

### Phase 7 — Assisted tracking

Prototype local browser-side tracking behind a replaceable worker-friendly interface. Manual tracking and correction remain first-class.

Acceptance criteria:

- The user explicitly seeds a target and can stop/restart assistance.
- Results are editable manual-quality track points, not a separate locked format.
- Failures are visible and do not overwrite confirmed points silently.
- Performance is measured on representative video; large work does not freeze the UI unnecessarily.

### Phase 8 — Export, polish, and end-to-end tests

Add CSV export for raw and processed data, project recovery appropriate to the stabilized schema, UX/error polish, and Playwright coverage for critical flows.

Acceptance criteria:

- CSV includes timestamps, coordinates, units, and clear headers.
- Exported numerical fixtures match tested physics results.
- Important import → calibrate → track → analyze → export paths have end-to-end coverage.
- Privacy claims, browser limitations, supported formats, and recovery behavior are documented.
- No server, telemetry, paid API, or required account is introduced.
