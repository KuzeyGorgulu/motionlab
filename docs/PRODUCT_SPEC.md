# MotionLab Product Specification

## Purpose

MotionLab is a desktop-first browser workspace that turns motion visible in an ordinary video into inspectable physical measurements. It should give students, educators, hobbyists, and practical experimenters a transparent path from source footage to calibrated coordinates, motion data, graphs, and exports.

The analysis workspace is the product. MotionLab should feel like a compact engineering instrument: dark, precise, information-dense, and understandable without decorative dashboard content.

## Current implemented scope

MotionLab currently imports local videos, provides timestamp-oriented transport controls, and supports editable manual Point, Line, and Angle annotations. Geometry is stored in native video pixels and associated with a bounded timestamp bucket. A video-scoped planar calibration defines real distance, unit, origin, and axis orientation. Valid calibration derives physical line lengths and Point world coordinates while angles remain in degrees.

Users can also create, select, rename, and intentionally delete multiple manual object tracks. Each track is an ordered time series of native-video positions with exact media anchor timestamps and fallback frame-bucket identity. Track Mark adds or corrects one sample per bucket, Track Edit moves the active current-frame sample, and visible trajectories support past/current, all-history, and current-only views. World positions are derived live from calibration rather than stored.

An experimental forward-only assisted tracker provides a productivity aid for semi-automatic tracking, not guaranteed fully automatic object tracking. It can use an explicit current-frame seed to propose later native-coordinate samples, performs bounded local template matching in a browser worker, displays suggestions with dashed/hollow non-confirmed styling, and stops on low confidence, ambiguity, invalid pixels, frame-identity repetition, video boundaries, or confirmed-sample conflicts. Suggestions remain transient until accepted or discarded. One acceptance creates ordinary `TrackSample`s as one undoable tracking-history mutation, so manual editing, calibration, kinematics, and synchronized graphs need no assisted-specific data model.

The active track has a readable right-side kinematics inspector for position, displacement from the previous valid sample, cumulative path distance, velocity, speed, and acceleration. On desktop, this independently scrollable control and numerical rail spans the full workspace height. A dedicated collapsible Analysis panel fills only the flexible left workspace column below the video/timeline. It compares dimensionally compatible Position (X/Y), Velocity (vx/vy/Speed), or Acceleration (ax/ay/|a|) sample series on a shared true-media-time domain. The selected family survives collapse/reopen. A continuous video playhead, transient time-only graph cursor, background timestamp seeking, and exact-anchor marker seeking synchronize the graph with the media without interpolating measurements. Analysis is physical when calibration exists and explicitly pixel-based otherwise.

Raw kinematics remains the default. A non-destructive Smoothed source evaluates timestamp-aware local quadratic fits at the genuine observation timestamps with selectable 5/7/9-sample neighborhoods; raw observations remain visible for comparison and no samples or gaps are created. Optional constant-velocity and constant-acceleration least-squares models operate on the selected raw or smoothed source. Model parameters and conservative fit metrics are descriptive derived results, and their sampled graph curves are presentation-only rather than observations.

Experiments can be downloaded as validated version-1 `.motionlab` JSON projects and reopened through explicit local-video relinking. A project stores scientifically relevant annotation, calibration, confirmed-track, and workspace metadata but never embeds video or transient Assisted Tracking state. Combined chronological CSV and human-readable JSON exports reuse the existing kinematics derivation, and the selected analysis graph can be exported as a standalone labeled SVG.

## Intended users

- Students performing mechanics experiments without specialist camera equipment.
- Educators demonstrating projectile, pendulum, bounce, jump, and ramp motion.
- Makers and experimenters who want inspectable measurements rather than opaque automated answers.
- Anyone who needs a free tool whose video does not leave their computer.

## Planned workflow

1. Import a local video and inspect it with analysis-oriented playback controls.
2. Add and adjust frame-local geometry to inspect points, pixel distances, and angles.
3. Calibrate real-world scale and define the coordinate system.
4. Record object positions manually, optionally using experimental assisted tracking as a conservative accelerator.
5. Correct the track and calculate position, displacement, velocity, and acceleration from timestamps.
6. Inspect trajectory overlays, graphs, and numerical results.
7. Save the experiment for later relinking or export raw and processed measurement data.

## Final planned capabilities

- Local video import, playback, timestamp seeking, approximate frame stepping, speed control, and video metadata.
- Scale, origin, axis-orientation, and coordinate-rotation calibration.
- Manual point tracking that always remains available and scientifically transparent.
- Optional browser-side assisted tracking with manual correction.
- Timestamp-based position, displacement, velocity, speed, and acceleration calculations.
- Later experiment-specific analyses such as projectile fits, launch measurements, experimental gravity, pendulum period, polynomial fitting, and uncertainty handling.
- Video trajectory overlays, selectable graph series, numerical summaries, CSV export, and reasonable graph-image export.

## Non-goals

- No backend, cloud media pipeline, user accounts, subscriptions, or paid service dependency.
- No social/video hosting features.
- No claim of frame-perfect access when browser decoding and source metadata cannot guarantee it.
- No opaque AI result that prevents a user from seeing or correcting the underlying measurements.
- No mobile-first editing experience in the initial product plan.

## Privacy and local-first philosophy

Imported files are represented with browser Object URLs and decoded locally by the browser. MotionLab does not upload source video or derived frames. Explicitly downloaded `.motionlab`, CSV, JSON, and SVG files are generated locally and remain under user control. MotionLab does not persist video in browser storage. Any future feature that would transmit user content requires an explicit product decision and would violate the current architecture.

MotionLab is free to operate: no API keys, metered services, analytics, or required server are part of the product.

## Measurement assumptions

Current calibration uses one uniform scale for a two-dimensional scene plane. Supported units are millimeters, centimeters, meters, inches, and feet. It does not correct perspective, lens distortion, or depth. Measurements are most reliable when the calibration reference and analyzed motion occupy approximately the same plane; substantially different scene depths can introduce scale error.

## Manual tracking assumptions

Manual track samples use media timestamps as the source of truth. The current `timestamp-bucket-v1` identity uses the approximate 30 fps step duration to associate nearby timestamps while retaining the exact timestamp that anchored each sample. This is not a decoded frame number or a guarantee of exact adjacent-frame access. Re-marking the active track in the same bucket updates the existing native position and preserves its stable sample identity and original anchor.

Tracks are independent of frame-local Point annotations and scene calibration. Recalibration changes only derived world-coordinate displays; calibration reset returns tracks to native-pixel display. Track, annotation, and calibration data are session-only and scoped to the selected video.

## Assisted tracking assumptions

Assisted tracking is an experimental local-browser productivity aid for semi-automatic tracking, not an authoritative detector or guaranteed fully automatic object tracker. The intended workflow is: seed a target, generate suggestions, review them, accept them when correct, and manually reseed near the last reliable position if tracking is lost. The user selects one active track and explicitly seeds the physical point to measure. A grayscale recognition template surrounds that anchor, and its bounded multi-resolution base geometry scales from the native video's shorter dimension. Representative template/native-coverage/refinement values are 21/72/4 px at 720p, 33/108/6 px at 1080p, 43/144/8 px at 1440p, and 63/216/8 px at 2160p, with normal hard maxima of 65/256/8 px. The original seed template remains immutable. A separate current template may blend 10% of a newly observed patch only after a match satisfies stricter confidence, score, and ambiguity-margin gates; rejected or marginal frames cannot update it. The matched template displacement is applied to the previous physical anchor, so a distinctive edge inside the wider context never replaces the selected measurement point. The prototype tracks forward only and does not smooth observations, interpolate gaps, compensate for camera motion, or infer a missing target.

Match acceptance combines absolute normalized mean-absolute difference, separation from the representative of a genuinely separate spatial match basin, seed texture variance, and a search-boundary penalty. Nearby full-resolution hypothesis representatives are grouped with a resolution-aware native-pixel radius, and each basin keeps its best observed integer position rather than an averaged or predicted position. A low-confidence, ambiguous, missing, or out-of-range target is a recoverable miss: no sample is produced, reliable motion is projected to the following timestamp, and up to three progressively wider recovery attempts are allowed before the fourth consecutive miss stops with a reseeding message. Reacquisition resets normal geometry and leaves earlier missed timestamps empty. Invalid frame, worker, extraction, seed, and geometry states remain immediate hard failures. Existing confirmed frame identities are protected and never overwritten. Accepted suggestions lose their transient confidence/provenance and become ordinary timestamped native-coordinate samples; derived world coordinates and kinematics remain live projections.

The worker receives only the bounded template/search pixel regions needed for matching. Deterministic box averaging supports a large low-resolution search followed by exact one-pixel refinement around a bounded set of spatially distinct hypotheses. Once two visual observations exist, their real timestamp interval and native displacement provide a constant-velocity prediction for the next timestamp. The main pass centers on that prediction and expands its radius by 35% of projected motion plus 25% of template size, capped at 1.5× the base radius and 512 px. Only a low-confidence main pass triggers one wider same-frame corridor search between the previous observation and prediction, using the full projected-motion and template-size allowances with the same 512 px ceiling. This tolerates moderate acceleration or reversal without full-frame search and without changing confidence thresholds. If both passes are uncertain, recovery centers progressively expanded geometry on the projected location at approximately 1.35×, 1.7×, and 2.0×, still capped at 512 px. If the current template has adapted, recovery compares it with the immutable seed and rejects spatial disagreement rather than averaging positions. Predictions never become observations without successful image matching. No pixels, video, results, telemetry, or analytics leave the browser. The UI reports processed frames, elapsed run time, and average milliseconds per processed frame. No representative-video benchmark is claimed: measure a chosen clip by running assistance and reading the displayed metrics after a stop, failure, or completion.

Expected limitations include fast or sudden motion, severe motion blur, occlusion, significant rotation or scale change, abrupt lighting change, visually repetitive, ambiguous, or low-texture targets, motion beyond bounded search limits, and targets leaving the frame. These are known limits of the lightweight local template-matching approach rather than promises of fully automatic detection. Recovery is deliberately manual: review and accept reliable suggestions, correct or add a point, reseed near the last reliable position, and continue.

## Project and export assumptions

The version-1 project schema contains the original video name with optional duration and native dimensions, annotations and frame references, calibration and coordinate-axis metadata, confirmed tracks/samples, active-track identity, trail and mark-advance preferences, analysis mode/collapse state, and media time. It excludes Object URLs, video bytes, undo stacks, pointer drafts, worker execution, templates, predictions, diagnostics, and unaccepted Assisted Tracking suggestions. Parsing is read-then-validate; only a valid project can replace the live workspace.

Opening a project requires the user to select a local video. Filename, dimensions, and duration are compared when present. A mismatch is visible and can be rejected by choosing another video or explicitly accepted with an alignment warning. Validated project state initializes a newly mounted workspace atomically.

CSV is one chronological multi-track table. Native pixel coordinates are always present. Generic analysis columns are paired with explicit `position_space`, `position_unit`, `velocity_unit`, and `acceleration_unit` fields, so calibrated world values and uncalibrated pixel values are unambiguous. Missing derivatives are empty. Scientific JSON contains the same derived sample quantities plus calibration/annotation context but omits workspace-only metadata. CSV and scientific JSON remain based on confirmed observations and the unchanged raw kinematics path even when a Phase 9 derived view is selected. Graph SVG reflects the current selected position, velocity, or acceleration visualization, including optional measured/smoothed/model layers, and excludes interactive chrome. Phase 9 source, window, and model selections are session-only and do not alter the version-1 project schema.

## Kinematics assumptions

Kinematics uses exact stored media timestamps and supports unequal spacing and skipped frames. Valid interior velocities use a non-uniform three-point centered derivative, while endpoints use a second-order one-sided derivative when three valid samples exist and a two-point secant when only two exist. Acceleration differentiates the derived velocity series at interior samples only; boundary acceleration is intentionally unavailable. Intervals at or below one microsecond are invalid and never produce infinite or non-finite UI values.

Raw analysis applies no smoothing or interpolation and preserves its Phase 5 behavior exactly. Numerical differentiation amplifies position noise, so manual velocity estimates can fluctuate and acceleration can be substantially noisier than tracked positions.

Optional smoothing selects the nearest available samples in real-time proximity (at least five, with a requested window of 5, 7, or 9), centers and normalizes time at each original observation, solves independent degree-2 least-squares fits for X and Y, and evaluates position plus analytic first/second derivatives only at that observation timestamp. Boundary neighborhoods may be asymmetric. Singular, near-zero-span, non-finite, or otherwise unusable windows produce a controlled unavailable state rather than a raw fallback disguised as smoothing. Smoothed displacement and cumulative distance are derived from the smoothed positions. Calibration is applied before smoothing so all quantities remain consistently in physical world space or explicit pixel space.

Constant-velocity and constant-acceleration models perform global least-squares fits over all usable selected-source positions using exact timestamps relative to a reported `t0`. Results include vector parameters, spatial RMSE, per-axis R² when the axis has non-zero variance, sample count, and observed time span. Undefined R² remains unavailable. Fits do not imply causation or measurement certainty, and model-rendering points never enter track state. Smoothing may make noisy motion easier to inspect but may also suppress genuine rapid changes; users should compare it with raw markers and judge model quality in experimental context.
