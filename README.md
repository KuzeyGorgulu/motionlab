# MotionLab

MotionLab is a local-first browser workspace for extracting physical measurements from ordinary videos. It provides private local video import, analysis-oriented playback controls, editable frame-associated geometry, uniform planar calibration, and manual multi-object trajectories.

**Live Demo:** https://motionlab-qzeybei.vercel.app/

User videos are decoded in the browser from local Object URLs. They are not uploaded, copied to a backend, or sent to analytics.

## Run locally

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite and select or drop a video file. Pause on a useful frame and use Select, Point, Line, or Angle above the video.

To calibrate, choose **Create calibration** in the inspector, click two video points whose real separation is known, then enter the distance and unit. Reference A becomes the default world origin and A → B the default positive X direction; both can be changed independently. A rightward X axis produces upward positive Y. Lines then show physical lengths and Points show derived world coordinates.

To track an object, create and select a track in **Manual tracking**, enter **Mark point** mode (or press `T`), click the object, step with Left/Right, and repeat. Marking the same timestamp bucket again moves the existing sample instead of creating a duplicate. Enable **Advance after mark** for a click-and-step workflow. **Edit current** lets you drag the active track's sample, and sample rows seek to their exact stored anchor timestamps. Trail visibility can show past/current samples, all samples with future history muted, or only the current sample.

Track samples store exact media anchor timestamps, fallback frame-bucket references, and native-video pixel positions only. Calibration-derived world positions update live without changing the stored trajectory. Tracks, calibration, and annotations are session-only and clear when the video is replaced or removed.

The full-height right-side **Numerical inspector** derives position, displacement, cumulative path distance, velocity, speed, and acceleration for the active track. Results use the calibration's physical unit when available and explicit `px`, `px/s`, and `px/s²` units otherwise. A collapsible Analysis panel fills the left workspace column below the video/timeline and compares Position (X/Y), Velocity (vx/vy/Speed), or Acceleration (ax/ay/|a|) samples on shared true-timestamp axes. A live video playhead and transient time-only graph cursor support synchronization and background timestamp seeking, while selecting an actual marker seeks to its exact media anchor.

Escape cancels the active canvas interaction; Delete/Backspace removes the current track sample while a tracking mode is active, or the selected annotation otherwise. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z apply to the active tracking domain while tracking and to annotations otherwise. Track history also has explicit controls in its panel.

## Validate

```bash
npm test
npm run typecheck
npm run build
```

See `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md` for current scope and planned phases. Automatic tracking, smoothing, model fitting, persistence, and export are intentionally not implemented yet.
