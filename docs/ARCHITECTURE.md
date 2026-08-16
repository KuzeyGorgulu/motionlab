# MotionLab Architecture

## Current architecture

MotionLab is a client-only React and TypeScript application built with Vite. There is no server. The implemented video and manual-annotation slices are organized as follows:

- `src/App.tsx` owns whether a local video is selected and switches between the empty and active workspaces.
- `src/hooks/useLocalVideoSource.ts` owns local-file validation, Object URL creation, replacement, error state, and cleanup.
- `src/components/video/VideoWorkspace.tsx` composes the active analysis workspace and keyboard shortcuts.
- `src/hooks/useVideoController.ts` isolates media-element state and commands: metadata, playback, seeking, approximate stepping, speed, errors, and displayed-frame synchronization.
- `src/components/video/VideoStage.tsx` renders the video and positions the aligned annotation canvas.
- `src/hooks/useAnnotationWorkspace.ts` coordinates transient tool/draft/drag interaction state with the annotation history reducer.
- `src/annotations/types.ts` defines Point, Line, and Angle annotations and their timestamp-frame reference.
- `src/annotations/model.ts`, `measurement.ts`, `frameAssociation.ts`, and `hitTest.ts` contain pure, tested annotation logic.
- `src/annotations/state.ts` owns the annotation document and bounded undo/redo history.
- `src/annotations/render.ts` is the canvas renderer; it does not own annotation data.
- `src/video/geometry.ts` contains pure aspect-fit and display/native coordinate conversions.
- `src/video/timing.ts` contains timestamp formatting, safe media-time clamping, and the fallback frame-step policy.
- `src/styles.css` defines the current application styling without a runtime styling dependency.

React component state is used for transient media/UI state. Annotation domain data uses a reducer, while unfinished drafts and drag previews remain transient. A global state library would not add value yet. Annotation data is session-only and is cleared when the loaded video changes; project persistence is intentionally deferred.

## Local media lifecycle

Selecting a file creates an Object URL. The browser reads and decodes the file directly from the local machine; application code does not upload it or buffer the whole file. Replacing/removing the selection and unmounting revoke the URL. Media errors are surfaced in the workspace.

## Overlay geometry

The video element fills its stage with `object-fit: contain`. Because the visible video may be letterboxed, the canvas does not blindly fill the stage. The stage is observed with `ResizeObserver`; `getContainedContentRect` calculates the exact visible media rectangle from stage and native-video dimensions. The canvas:

- is positioned at that rectangle in CSS pixels;
- uses native video width and height as its drawing-buffer dimensions;
- scales with the visible video while preserving a direct native-pixel drawing coordinate system.

Pure conversion functions translate between stage/display coordinates and native video pixels. Pointer input is converted immediately, and only native pixel coordinates enter annotation state. Hit-test tolerance and line/handle styling are converted from display pixels to native units at runtime. They are unit-tested because calibration and tracking will depend on the same mapping.

## Annotation data and interaction

Annotations are discriminated unions with a stable ID, a frame reference, and native-video points:

- Point: one `point`.
- Line: endpoints `a` and `b`; its measurement is Euclidean pixel distance.
- Angle: arm point `a`, `vertex`, and arm point `b`; its measurement is the smaller angle at the vertex in degrees.

Coincident angle arms produce a controlled `null` measurement rather than `NaN`. The UI labels these as undefined. Physical units are not implied.

Creation is a small pure state transition: Point completes after one click, Line after two, and Angle after three. Incomplete geometry stays outside the annotation document and Escape or a frame change discards it. Selection and construction input are handled only by the canvas, so they do not seek or toggle the video.

The reducer records complete create, delete, and handle-move mutations. A drag is previewed outside the document and commits once at pointer-up, which makes one drag one undo step. Selection, video playback, and seeking are not part of annotation history. History is currently capped at 100 snapshots.

## Frame/time association

Annotations do not compare `video.currentTime` values directly. `TimestampFrameReference` version `timestamp-bucket-v1` divides the timestamp axis into buckets based on the same approximate 30 fps fallback used by frame stepping. `Math.round(mediaTime / bucketDuration)` selects a bucket, giving a nominal half-bucket tolerance of about 16.7 ms around each 30 fps timestamp.

Each reference also retains the exact media timestamp at creation (`anchorTime`) and its bucket duration. This makes the current assumption explicit and gives a future metadata-aware or decoded-frame identity system enough information to migrate data. It does not claim that variable-frame-rate or inter-frame-coded video has an exact detected frame number.

## Timing and frame-access decision

Media timestamps, not assumed frame indices, are the current source of truth. While playing, `requestVideoFrameCallback()` synchronizes the displayed timestamp to decoded frames when the browser provides it; a `requestAnimationFrame()` sampling fallback is used otherwise.

Browsers generally do not expose dependable source FPS metadata, and assigning `video.currentTime` is a timestamp seek rather than a guarantee of an exact adjacent decoded frame. Current frame-step buttons therefore seek by approximately `1 / 30` seconds, clearly labeled as a 30 fps fallback. The policy lives in `video/timing.ts`, leaving room for detected metadata or a user override without rewriting the controls. Variable-frame-rate video will remain timestamp-based.

Native duration may be unavailable, non-finite, or revised during loading. Seeking and duration-dependent controls stay disabled until usable metadata exists.

## Error and accessibility boundaries

The media controller reports unsupported/corrupt media and playback failures instead of silently swallowing them. Controls are native buttons, ranges, and selects with labels, focus treatment, and disabled states. Space toggles playback and Left/Right perform approximate steps only when focus is not inside an interactive or editable element.

## Keyboard interaction

- Space: play/pause; Left/Right: approximate frame step.
- V/P/L/A: Select, Point, Line, and Angle tools.
- Escape: cancel unfinished geometry or a drag preview.
- Delete/Backspace: delete the current-frame selection.
- Ctrl/Cmd+Z: undo annotation mutation; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y: redo.

Shortcuts are ignored while focus is in normal interactive/form controls.

## Future extension points (not implemented)

- Calibration models and coordinate-system transforms should be domain modules, not canvas-component state.
- Manual tracks should store native-video coordinates with media timestamps.
- Physics functions should consume calibrated, timestamped samples and remain independent of React.
- Canvas rendering can evolve into distinct overlay layers without changing native-coordinate storage.
- Frame decoding/tracking work can move behind a worker boundary; OpenCV.js is a possible later implementation detail.
- Project persistence can be introduced after a stable project schema exists, likely with IndexedDB.

Physical-unit calibration, tracks/trajectories, physics calculations, graphs, persistence, assisted tracking, and export do not exist in the current codebase. Annotation undo history is in-memory and uses full immutable snapshots; a command/delta model can replace it if future project sizes demonstrate a need.
