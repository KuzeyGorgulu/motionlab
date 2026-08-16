# MotionLab

MotionLab is a local-first browser workspace for extracting physical measurements from ordinary videos. The current milestone provides private local video import, analysis-oriented playback controls, approximate frame stepping, and a native-coordinate canvas overlay foundation.

User videos are decoded in the browser from local Object URLs. They are not uploaded, copied to a backend, or sent to analytics.

## Run locally

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite and select or drop a video file.

## Validate

```bash
npm test
npm run typecheck
npm run build
```

See `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md` for current scope and planned phases. Calibration, tracking, physics, visualization, persistence, and export are intentionally not implemented yet.
