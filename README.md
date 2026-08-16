# MotionLab

MotionLab is a local-first browser workspace for extracting physical measurements from ordinary videos. It provides private local video import, analysis-oriented playback controls, editable frame-associated geometry, and uniform planar calibration from native video pixels into physical coordinates.

User videos are decoded in the browser from local Object URLs. They are not uploaded, copied to a backend, or sent to analytics.

## Run locally

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite and select or drop a video file. Pause on a useful frame and use Select, Point, Line, or Angle above the video.

To calibrate, choose **Create calibration** in the inspector, click two video points whose real separation is known, then enter the distance and unit. Reference A becomes the default world origin and A → B the default positive X direction; both can be changed independently. A rightward X axis produces upward positive Y. Lines then show physical lengths and Points show derived world coordinates.

Escape cancels unfinished geometry or calibration capture; Delete/Backspace removes an annotation selection; Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo and redo annotation changes.

## Validate

```bash
npm test
npm run typecheck
npm run build
```

See `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md` for current scope and planned phases. Tracking/trajectories, physics, visualization, persistence, and export are intentionally not implemented yet. Calibration and annotations remain session-only.
