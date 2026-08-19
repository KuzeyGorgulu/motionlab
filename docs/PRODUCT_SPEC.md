# MotionLab Product Specification

## Purpose

MotionLab is a desktop-first browser workspace that turns motion visible in an ordinary video into inspectable physical measurements. It should give students, educators, hobbyists, and practical experimenters a transparent path from source footage to calibrated coordinates, motion data, graphs, and exports.

The analysis workspace is the product. MotionLab should feel like a compact engineering instrument: dark, precise, information-dense, and understandable without decorative dashboard content.

## Current implemented scope

MotionLab currently imports local videos, provides timestamp-oriented transport controls, and supports editable manual Point, Line, and Angle annotations. Geometry is stored in native video pixels and associated with a bounded timestamp bucket. A video-scoped planar calibration defines real distance, unit, origin, and axis orientation. Valid calibration derives physical line lengths and Point world coordinates while angles remain in degrees.

Users can also create, select, rename, and intentionally delete multiple manual object tracks. Each track is an ordered time series of native-video positions with exact media anchor timestamps and fallback frame-bucket identity. Track Mark adds or corrects one sample per bucket, Track Edit moves the active current-frame sample, and visible trajectories support past/current, all-history, and current-only views. World positions are derived live from calibration rather than stored.

An experimental forward-only assisted tracker can use an explicit current-frame seed to propose later native-coordinate samples. It performs bounded local template matching in a browser worker, displays suggestions with dashed/hollow non-confirmed styling, and stops on low confidence, ambiguity, invalid pixels, frame-identity repetition, video boundaries, or confirmed-sample conflicts. Suggestions remain transient until accepted or discarded. One acceptance creates ordinary `TrackSample`s as one undoable tracking-history mutation, so manual editing, calibration, kinematics, and synchronized graphs need no assisted-specific data model.

The active track has a readable right-side kinematics inspector for position, displacement from the previous valid sample, cumulative path distance, velocity, speed, and acceleration. On desktop, this independently scrollable control and numerical rail spans the full workspace height. A dedicated collapsible Analysis panel fills only the flexible left workspace column below the video/timeline. It compares dimensionally compatible Position (X/Y), Velocity (vx/vy/Speed), or Acceleration (ax/ay/|a|) sample series on a shared true-media-time domain. The selected family survives collapse/reopen. A continuous video playhead, transient time-only graph cursor, background timestamp seeking, and exact-anchor marker seeking synchronize the graph with the media without interpolating measurements. Analysis is physical when calibration exists and explicitly pixel-based otherwise.

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
6. Inspect trajectory overlays, graphs, fitted models, and numerical results.
7. Export raw and processed measurement data.

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

Imported files are represented with browser Object URLs and decoded locally by the browser. MotionLab does not upload source video or derived frames. Future persistence should store only necessary local project data using browser storage and should remain exportable and removable by the user. Any future feature that would transmit user content requires an explicit product decision and would violate the current architecture.

MotionLab is free to operate: no API keys, metered services, analytics, or required server are part of the product.

## Measurement assumptions

Current calibration uses one uniform scale for a two-dimensional scene plane. Supported units are millimeters, centimeters, meters, inches, and feet. It does not correct perspective, lens distortion, or depth. Measurements are most reliable when the calibration reference and analyzed motion occupy approximately the same plane; substantially different scene depths can introduce scale error.

## Manual tracking assumptions

Manual track samples use media timestamps as the source of truth. The current `timestamp-bucket-v1` identity uses the approximate 30 fps step duration to associate nearby timestamps while retaining the exact timestamp that anchored each sample. This is not a decoded frame number or a guarantee of exact adjacent-frame access. Re-marking the active track in the same bucket updates the existing native position and preserves its stable sample identity and original anchor.

Tracks are independent of frame-local Point annotations and scene calibration. Recalibration changes only derived world-coordinate displays; calibration reset returns tracks to native-pixel display. Track, annotation, and calibration data are session-only and scoped to the selected video.

## Assisted tracking assumptions

Assisted tracking is an experimental local-browser aid, not an authoritative detector. The user selects one active track and explicitly seeds the physical point to measure. A grayscale recognition template surrounds that anchor, and its bounded multi-resolution search scales from the native video's shorter dimension. Representative template/native-coverage/refinement values are 21/72/4 px at 720p, 33/108/6 px at 1080p, 43/144/8 px at 1440p, and 63/216/8 px at 2160p, with normal hard maxima of 65/256/8 px. The original seed template remains immutable. A separate current template may blend 10% of a newly observed patch only after a match satisfies stricter confidence, score, and ambiguity-margin gates; rejected or marginal frames cannot update it. The matched template displacement is applied to the previous physical anchor, so a distinctive edge inside the wider context never replaces the selected measurement point. The prototype tracks forward only and does not smooth observations, interpolate gaps, compensate for camera motion, or infer a missing target.

Match acceptance combines absolute normalized mean-absolute difference, separation from the representative of a genuinely separate spatial match basin, seed texture variance, and a search-boundary penalty. Nearby full-resolution hypothesis representatives are grouped with a resolution-aware native-pixel radius, and each basin keeps its best observed integer position rather than an averaged or predicted position. A low-confidence, ambiguous, missing, or out-of-range target is a recoverable miss: no sample is produced, reliable motion is projected to the following timestamp, and up to three progressively wider recovery attempts are allowed before the fourth consecutive miss stops with a reseeding message. Reacquisition resets normal geometry and leaves earlier missed timestamps empty. Invalid frame, worker, extraction, seed, and geometry states remain immediate hard failures. Existing confirmed frame identities are protected and never overwritten. Accepted suggestions lose their transient confidence/provenance and become ordinary timestamped native-coordinate samples; derived world coordinates and kinematics remain live projections.

The worker receives only the bounded template/search pixel regions needed for matching. Deterministic box averaging supports a large low-resolution search followed by exact one-pixel refinement around a bounded set of spatially distinct hypotheses. Once two visual observations exist, their timestamp-scaled displacement may add a predicted search envelope, while the previous-observation envelope remains available during normal tracking for acceleration or reversal. Recovery centers its expanded ROI on the projected location. Recovery multipliers are approximately 1.35, 1.7, and 2.0, with a 512 px absolute native-radius ceiling; normal successful frames retain the original geometry. If the current template has adapted, recovery compares it with the immutable seed and rejects spatial disagreement rather than averaging positions. The hint never becomes an observation without successful image matching. No pixels, video, results, telemetry, or analytics leave the browser. The UI reports processed frames, elapsed run time, and average milliseconds per processed frame. No representative-video benchmark is claimed: measure a chosen clip by running assistance and reading the displayed metrics after a stop, failure, or completion.

Expected limitations include occlusion, rotation, scale change, lighting change, motion blur, repetitive or low-texture targets, large inter-frame movement, and a target leaving the frame or bounded search area. Recovery is deliberately manual: accept reliable suggestions, correct or add a point, reseed, and continue.

## Kinematics assumptions

Kinematics uses exact stored media timestamps and supports unequal spacing and skipped frames. Valid interior velocities use a non-uniform three-point centered derivative, while endpoints use a second-order one-sided derivative when three valid samples exist and a two-point secant when only two exist. Acceleration differentiates the derived velocity series at interior samples only; boundary acceleration is intentionally unavailable. Intervals at or below one microsecond are invalid and never produce infinite or non-finite UI values.

No smoothing or interpolation is applied. Numerical differentiation amplifies position noise, so manual velocity estimates can fluctuate and acceleration can be substantially noisier than the tracked positions. Graphs render observed/derived sample points without connecting them through an implied continuous curve.
