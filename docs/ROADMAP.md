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

### Phase 4 — Manual tracking (complete)

Create a timestamp-oriented manual point workflow with add, replace, delete, step-and-mark, and visible trajectory history.

Acceptance criteria:

- Multiple stable-ID tracks can be created, selected, renamed, and intentionally deleted without changing annotations, calibration, playback, or peer tracks.
- Ordered samples store exact media anchor timestamps, shared fallback frame references, and native-video positions only.
- Re-marking within the same bucket updates the existing sample position without creating an ambiguous duplicate or changing its original anchor.
- Track Mark supports approximate step-and-mark and optional automatic advance; Track Edit previews a native-coordinate drag and commits it as one history mutation.
- Trajectories render in chronological order with active/inactive and current-frame states, plus past/current, muted-future, and current-only visibility choices.
- Sample lists seek to stored anchors, and calibrated world coordinates are always derived from unchanged native geometry.
- Tracking uses independently tested validation, selectors, hit testing, rendering, and bounded undo/redo without changing annotation history.

### Phase 5 — Kinematics and data analysis (complete)

Implement independently tested calibrated/pixel position, displacement, cumulative distance, finite-difference velocity, speed, acceleration, and lightweight timestamp-faithful graphs. Do not smooth or interpolate samples.

Acceptance criteria:

- Pure TypeScript functions accept timestamped tracks and current calibration and return typed derived series without mutating observations.
- Units, rotated coordinate orientation, image-Y inversion, irregular time intervals, effectively zero intervals, and insufficient samples are handled explicitly.
- Non-uniform three-point velocity and acceleration estimates are tested with constant velocity, constant acceleration, sparse, irregular, and edited trajectories.
- The active sample inspector shows position, displacement, path distance, velocity, speed, and acceleration with explicit physical or pixel units.
- Sample-only x(t), y(t), speed, and acceleration-magnitude graphs update reactively and seek to exact track anchors when points are selected.
- Analysis modules import no React, canvas, storage, or network code.

### Phase 5.1 — Analysis UI polish (complete)

Move the Phase 5 plots out of the narrow inspector into a responsive, collapsible horizontal analysis dock while retaining the numerical sample inspector and scientific behavior.

Acceptance criteria:

- The right inspector retains all current-sample position, displacement, distance, velocity, and acceleration quantities.
- The wide dock retains x(t), y(t), Speed, and |a| selection across collapse/reopen.
- Responsive measured SVG plots expose readable time and reactive quantity/unit axes, a clear zero baseline, exact-timestamp seeking, and current-sample highlighting.
- A local favicon removes the missing-icon console request without adding a network dependency.
- Kinematics math, calibration/pixel fallbacks, tracking data, and dependency footprint remain unchanged.

### Phase 5.2 — Workspace layout refinement (complete)

Refine the Phase 5.1 composition into a desktop left workspace and full-height right control/numerical rail without changing analysis behavior.

Acceptance criteria:

- Video, timeline, and the Analysis dock occupy the flexible left column; the dock never extends under the inspector.
- The 320–360 px desktop inspector spans both workspace rows and provides one independent scrolling region.
- Numerical groups use modestly larger labels, values, and spacing while retaining the compact instrument style.
- At 980 px and below, video, Analysis, and inspector stack without horizontal overflow.
- Analysis collapse/selection state, graph seeking, calibration reactivity, and pixel fallback remain unchanged.

### Phase 6 — Visualization (complete)

Expand the current single-series dock into a synchronized visualization workspace with focused position/velocity/acceleration comparison and cursor-time linkage.

Acceptance criteria:

- Graph cursor and video timestamp can be compared reliably.
- Axes include quantity and units; no fake values appear.
- Dense and sparse tracks remain legible.
- Position compares X/Y, Velocity compares vx/vy/Speed, and Acceleration compares ax/ay/|a| on family-wide time/value domains.
- Video playhead, time-only hover cursor, background timestamp seeking, and exact-anchor sample seeking remain distinct and synchronized.
- Missing derivatives stay absent; no lines, interpolation, smoothing, resampling, aggregation, or downsampling are introduced.
- The existing SVG architecture is retained after evaluating accessibility, bundle size, domain control, and future SVG export suitability; no chart dependency is added.

## Week 3: assistance, export, and hardening

### Phase 7 — Assisted tracking (complete / feature experimental)

Prototype local browser-side tracking behind a replaceable worker-friendly interface. Manual tracking and correction remain first-class.

Acceptance criteria:

- The user explicitly seeds a target and can stop/restart assistance.
- A forward-only, stable-template, bounded-search tracker runs locally behind a replaceable worker-compatible interface.
- Suggestions remain transient, render with dashed/hollow non-confirmed styling, and can be accepted or discarded explicitly.
- Results are ordinary editable track points, not a separate locked format; one accepted run is one undo/redo mutation.
- Low texture, ambiguity, poor matches, invalid frames, repeated identities, boundaries, worker/seek failures, video end, and confirmed-sample conflicts stop visibly instead of guessing.
- Existing confirmed points are protected, and stale asynchronous work cannot mutate a newer video, track, or assisted session.
- Processed-frame, elapsed-time, and average-ms/frame instrumentation is displayed for representative-video measurement; no fabricated benchmark is claimed.
- Manual tracking, calibration, kinematics, synchronized graphs, local-only privacy, strict TypeScript, tests, and production worker build remain intact.

### Phase 7.1 — Adaptive assisted-tracking robustness (complete)

Scale stable-template context and bounded movement allowance with native resolution while preserving Phase 7's workflow and ordinary `TrackSample` output.

Acceptance criteria:

- Pure deterministic geometry produces bounded odd templates and search radii across landscape, portrait, unusually shaped, very small, and very large videos.
- A wider 4K seed can use an object's boundary and markings even when the clicked physical center is locally flat; genuinely flat context still stops.
- Matched template displacement moves the previous physical anchor exactly, without drifting the reported measurement toward a strong sub-feature.
- Bounded coarse-to-fine scoring, explicit seed-edge rejection, safe search clipping, and an overflow guard retain integer-pixel deterministic results without full-frame search.
- Synthetic tests cover the observed flat-center ball failure, adaptive radius, out-of-radius stopping, boundary matches, ambiguity, deterministic refinement, and input-buffer immutability.

### Phase 7.2 — Fast-motion coarse-to-fine assisted tracking (complete)

Increase bounded high-resolution motion coverage with a true reduced-resolution search and native-pixel refinement while retaining Phase 7's scientific and session-safety boundaries.

Acceptance criteria:

- The first assisted frame can recover a large image-confirmed displacement without motion history.
- Pure resolution policy derives bounded reduction scale, coarse radius, native-equivalent coverage, and refinement radius for common, very small, and very large videos.
- Box-averaged coarse matching retains spatially distinct hypotheses; final quality and ambiguity use full-resolution one-pixel candidates.
- Timestamp-scaled observed motion may center the next ROI but never creates a sample, and invalid guidance falls back safely.
- Synthetic regressions cover fast motion, missing targets, range exhaustion, repeated patterns, irregular timing, acceleration, reversal, frame edges, deterministic output, and operation bounds.
- Worker isolation, protected samples, cancellation, transient proposals, atomic acceptance, undo/redo, stable templates, and dependency-free local processing remain unchanged.

### Phase 7.3 — Spatial ambiguity clustering (complete)

Group nearby full-resolution refined hypotheses into resolution-aware match basins so local offsets around one target do not masquerade as independent alternatives.

Acceptance criteria:

- At most eight refined hypothesis representatives are clustered deterministically in native-pixel space with a documented bounded geometry-aware radius.
- Each basin reports its best observed integer-pixel candidate; no averaging, subpixel inference, smoothing, or predicted observation is introduced.
- Confidence compares the best basin with the second-best genuinely separate basin, while distant repeated targets remain ambiguous and stop safely.
- Synthetic regressions cover same-basin offsets, refinement convergence, exact threshold behavior, 720p through 4K scaling, a soft-edged basketball-style target, and separated duplicate targets.
- Motion guidance remains an ROI hint only; worker isolation, protected samples, cancellation, transient proposals, atomic acceptance, ordinary sample output, and dependency-free local processing remain unchanged.

### Phase 7.4 — Robust tracking continuity and recovery (complete)

Survive short low-confidence runs without weakening image acceptance or inventing measurements, while preserving a stable seed reference and bounded worker execution.

Acceptance criteria:

- Low-confidence, ambiguity, missing-target, and range results advance without a proposal through three bounded recovery attempts; invalid worker/frame/state results remain hard failures.
- Recovery projects the most recent reliable motion to each later timestamp and expands only the predicted-center search to approximately 1.35×, 1.7×, and 2× normal radius, capped at 512 native pixels.
- Reacquisition creates one ordinary transient sample at the actual later timestamp, resets normal geometry, and never fills missed timestamps.
- A strictly gated 10% current-template blend is explicitly committed only after a high-confidence valid proposal; the immutable seed is compared during recovery and spatial disagreement remains ambiguous.
- Internal bounded diagnostics, worker cancellation, generation guards, protected samples, atomic acceptance, Phase 7.2 coarse-to-fine matching, and Phase 7.3 basin clustering remain intact.

### Phase 7.5 — Fast-motion assisted-tracking robustness (complete)

Adapt normal tracking to recent observed velocity and add one bounded same-frame fallback for sudden motion changes without weakening image acceptance or creating predicted samples.

Acceptance criteria:

- Two recent accepted observations derive constant velocity from native-coordinate displacement and real media timestamps; insufficient or invalid history preserves the existing unguided behavior.
- The primary search is centered on the prediction and grows with projected motion plus a template-size safety allowance, under explicit coarse-aligned base-relative and 512 px caps.
- A low-confidence primary result alone triggers one wider previous-to-predicted corridor pass on the same decoded frame; there is no full-frame search.
- If both passes remain uncertain, the existing bounded multi-frame recovery continues without filling missed timestamps or changing the confidence policy.
- Predictions remain ROI hints only, and diagnostics expose prior/predicted positions, displacement, velocity, pass bounds/confidences, selected pass, and stop reason.
- Synthetic regressions cover static and constant-velocity motion, fast movement, sudden acceleration, ambiguity, frame edges, invalid timing, recovery composition, and a bounded 4K fallback work estimate.

### Phase 7.5.1 — Experimental UX and Phase 7 closure (complete)

Close the implementation phase while keeping Assisted Tracking visibly experimental and setting clear expectations for its semi-automatic, review-and-reseed workflow.

Acceptance criteria:

- The existing `EXPERIMENTAL` badge remains visible and the controls carry a concise permanent limitation/reseeding note.
- The first seed request in an application session presents an accessible experimental-use notice; acknowledgement is in memory and later reseeding remains immediate.
- Tracking-loss messaging continues to direct the user to reseed near the last reliable position without fabricating samples or treating loss as an application crash.
- README, product, architecture, and roadmap documentation distinguish a complete development phase from a guaranteed production-grade tracker and record the known limits of bounded local template matching.
- Matching, confidence, prediction, recovery, worker execution, suggestion acceptance, storage, and manual tracking behavior remain unchanged.

### Phase 8 — Save, export, and reliability (complete)

Turn the local analysis workspace into a reopenable experiment workflow with versioned project files, local video relinking, scientific exports, destructive-action protection, and deterministic browser coverage.

Acceptance criteria:

- Version-1 `.motionlab` JSON stores annotations, calibration, confirmed tracks/samples, and useful workspace metadata without embedding video or transient Assisted Tracking state.
- Safe parsing validates format, version, schema, geometry, identities, and references before a fresh relinked workspace is constructed; invalid files preserve current work.
- Relinking compares filename, native resolution, and duration when available and exposes an explicit mismatch warning with choose-another/use-anyway recovery.
- Combined chronological CSV and human-readable JSON include stable identities, timestamps/frame references, native pixels, existing derived kinematics, and unambiguous units; missing values remain empty/null.
- The current existing analysis family exports as labeled standalone SVG without interactive playhead/cursor chrome.
- Meaningful current data warns before video replacement/removal or opening another valid project.
- Unit coverage locks schema round trips, version/corruption rejection, relink comparison, multiple-track export, calibration units, unavailable derivatives, CSV escaping, and graph generation.
- Six Playwright scenarios cover save, open/relink/restore, CSV/SVG export, malformed-project safety, mismatch warning, and canceled destructive removal using only a generated local test video.
- Privacy, relinking, export fields, browser limitations, and Assisted Tracking's unchanged experimental status are documented; no server, telemetry, account, upload, or cloud dependency is introduced.

### Phase 9 — Scientific smoothing and motion-model fitting (complete)

Add an optional non-destructive scientific layer above confirmed timestamped observations while keeping raw analysis as the unchanged default.

Acceptance criteria:

- Raw `TrackSample` identity, timestamp/frame reference, and native position remain immutable; smoothing creates no samples, fills no gaps, and never enters tracking history.
- Smoothed analysis uses actual irregular media timestamps, deterministic nearest 5/7/9-sample neighborhoods, centered/normalized local quadratic least squares, and asymmetric boundary windows.
- Smoothed position, analytic velocity/acceleration, displacement, and path distance stay in the existing calibrated-world or pixel analysis space and fail safely for fewer than five or degenerate observations.
- Constant-velocity and constant-acceleration fits operate on the selected raw/smoothed source and report coefficients, spatial RMSE, safe per-axis R², sample count, and time span.
- The compact Analysis controls expose source, window, and model choices; the numerical inspector identifies the selected fit source and uses existing unit/number conventions.
- Graphs preserve raw evidence beside smoothing and render models as non-interactive dashed analytic overlays without changing playhead, cursor, or exact observation seeking.
- Standalone SVG reflects current measured/smoothed/model layers while excluding interactive chrome; CSV/JSON remain confirmed-observation/raw-kinematics exports.
- Phase 9 controls remain session-only, so existing version-1 `.motionlab` validation, save/open/relink, and project semantics remain unchanged.
- Pure unit/integration tests cover exact/noisy/irregular/calibrated/degenerate trajectories, immutability, metrics, recomputation, graph export, and Phase 8 compatibility; focused Playwright scenarios cover smoothing, model summary/overlay, and layered SVG.
- No numerical, statistics, chart, server, account, upload, telemetry, or other runtime dependency is added, and Assisted Tracking algorithms remain unchanged.

### Phase 10 — Guided UX and workflow polish (complete)

Make the implemented experiment workflow easier to discover without changing scientific, tracking, persistence, or local-only behavior.

Acceptance criteria:

- A compact Getting Started guide derives four visible steps and the current next action from existing video, calibration, selected-track, and confirmed-sample state.
- The standard path is clear: import a video, optionally calibrate, create a track, mark the object across multiple video positions, then inspect synchronized analysis.
- Calibration is explicitly optional and pixel-based tracking/analysis remains available; manual Tracking stays primary and Assisted Tracking stays visibly experimental.
- Empty tracking, numerical, graph, and annotation states explain what is missing and name the action that makes the area useful.
- Inspector order prioritizes Getting Started, calibration, tracking, numerical results, and annotations; shortcut help, video details, and advanced timing use native progressive disclosure.
- Main workflow copy uses task language such as video point and approximate frame stepping, while exact timestamp/fallback caveats remain available in Advanced timing.
- Raw/smoothed and motion-model controls retain unchanged computation and gain concise contextual explanations.
- Guidance and disclosure state remain presentation-only and never enter the version-1 `.motionlab` schema, domain histories, scientific data, or exports.
- Pure selector tests cover empty, calibrated, tracked, partially marked, ready, and selected-track states; Playwright covers manual progression, keyboard disclosures/state neutrality, and graph/numerical outcomes.
- Responsive layout, focus visibility, native keyboard operation, local-file privacy, project/export behavior, assisted-tracking algorithms, and dependency footprint remain intact.

### Phase 11 — Fit diagnostics and residual analysis (complete)

Turn Phase 9 model fits into inspectable evidence by deriving residual metrics, actionable deviation rankings, and synchronized residual graphs without changing measurements or fit semantics.

Acceptance criteria:

- Pure diagnostics evaluate the selected constant-velocity or constant-acceleration model at every genuine Raw or Smoothed observation and define each residual as observed minus predicted position in the active pixel/world coordinate space.
- Spatial RMSE reuses the model fit value; spatial MAE, maximum magnitude, mean signed X/Y residuals, observed/predicted coordinates, and deterministic largest-deviation rankings remain finite and observation-aligned.
- Potential-outlier styling uses a documented conservative rule only for at least seven values: magnitude strictly greater than `median + 4 × 1.4826 × MAD`; degenerate or tiny data sets produce no flags.
- Outlier flags are visual review aids only. They never remove, reweight, edit, smooth, interpolate, or otherwise alter observations or model fitting, and the UI warns that model mismatch can also produce large residuals.
- The numerical inspector exposes fit summaries and seekable largest deviations; selecting one seeks its exact stored anchor and exposes observed, predicted, and residual details for correction with normal Tracking Edit/Delete behavior.
- The Analysis dock switches between Motion and Residuals, with magnitude, signed X, and signed Y marker views that preserve exact observation seeking and do not invent connecting trajectories.
- Current residual SVG export includes correct title, unit, legend, signed zero reference, and outlier styling while excluding playhead, pointer cursor, and hit-target chrome.
- Track edits, deletes, undo/redo, calibration, active-track, source, and model changes recompute diagnostics; view/selection state remains outside tracking and project history.
- Version-1 projects, CSV/JSON semantics, Assisted Tracking, core kinematics/model formulas, local-only privacy, dependency footprint, and active workspace geometry remain unchanged.
- Pure, integration, SVG, and Playwright coverage verifies exact/irregular/calibrated fits, residual signs and metrics, outlier boundaries, immutability, reactive correction, exact seeking, and clean export.
