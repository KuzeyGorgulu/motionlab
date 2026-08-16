# MotionLab

MotionLab is a local-first browser workspace for extracting physical measurements from ordinary videos. The current milestone provides private local video import, analysis-oriented playback controls, approximate frame stepping, and editable frame-associated point, pixel-line, and angle annotations.

User videos are decoded in the browser from local Object URLs. They are not uploaded, copied to a backend, or sent to analytics.

## Run locally

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite and select or drop a video file. Pause on a useful frame and use Select, Point, Line, or Angle above the video. Escape cancels unfinished geometry; Delete/Backspace removes a selection; Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo and redo annotation changes.

## Validate

```bash
npm test
npm run typecheck
npm run build
```

See `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md` for current scope and planned phases. Physical-unit calibration, tracking/trajectories, physics, visualization, persistence, and export are intentionally not implemented yet.
