# MotionLab Product Specification

## Purpose

MotionLab is a desktop-first browser workspace that turns motion visible in an ordinary video into inspectable physical measurements. It should give students, educators, hobbyists, and practical experimenters a transparent path from source footage to calibrated coordinates, motion data, graphs, and exports.

The analysis workspace is the product. MotionLab should feel like a compact engineering instrument: dark, precise, information-dense, and understandable without decorative dashboard content.

## Current implemented scope

MotionLab currently imports local videos, provides timestamp-oriented transport controls, and supports editable manual Point, Line, and Angle annotations. Geometry is stored in native video pixels and associated with a bounded timestamp bucket. A video-scoped planar calibration defines real distance, unit, origin, and axis orientation. Valid calibration derives physical line lengths and Point world coordinates while angles remain in degrees. Trajectories and derived motion quantities remain future work.

## Intended users

- Students performing mechanics experiments without specialist camera equipment.
- Educators demonstrating projectile, pendulum, bounce, jump, and ramp motion.
- Makers and experimenters who want inspectable measurements rather than opaque automated answers.
- Anyone who needs a free tool whose video does not leave their computer.

## Planned workflow

1. Import a local video and inspect it with analysis-oriented playback controls.
2. Add and adjust frame-local geometry to inspect points, pixel distances, and angles.
3. Calibrate real-world scale and define the coordinate system.
4. Record object positions manually, with assisted tracking added later as an optional accelerator.
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
