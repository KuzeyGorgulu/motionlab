# MotionLab Architecture

## Current architecture

MotionLab is a client-only React and TypeScript application built with Vite. There is no server. The implemented video, annotation, calibration, and tracking slices are organized as follows:

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
- `src/hooks/useCalibrationWorkspace.ts` coordinates the video-scoped calibration workflow and transient canvas capture state.
- `src/calibration/types.ts`, `model.ts`, `transform.ts`, `measurement.ts`, and `state.ts` define and test calibration independently from React.
- `src/calibration/render.ts` draws scale, origin, and axis graphics without owning their state.
- `src/hooks/useTrackingWorkspace.ts` coordinates active track/mode state, current-frame lookup, marking, and transient drag previews.
- `src/tracking/types.ts`, `model.ts`, `state.ts`, `selectors.ts`, and `hitTest.ts` define validated manual tracks and their independent bounded history without importing React.
- `src/tracking/render.ts` draws chronological multi-track trajectories without owning track state.
- `src/components/tracking/TrackingPanel.tsx` owns lightweight form state and exposes track, mode, trail, history, current-sample, and sample-seek controls.
- `src/math/geometry.ts` owns generic point distance and angle math shared by annotations and calibration; the Phase 2 annotation path remains a compatibility re-export.
- `src/video/geometry.ts` contains pure aspect-fit and display/native coordinate conversions.
- `src/video/timing.ts` contains timestamp formatting, safe media-time clamping, and the fallback frame-step policy.
- `src/video/frameReference.ts` owns the domain-neutral timestamp-bucket reference used by annotations and tracks; the original annotation module remains a compatibility boundary.
- `src/styles.css` defines the current application styling without a runtime styling dependency.

React component state is used for transient media/UI state. Annotation domain data uses a reducer, while unfinished drafts and drag previews remain transient. A global state library would not add value yet. Annotation data is session-only and is cleared when the loaded video changes; project persistence is intentionally deferred.

Calibration has a separate reducer and is also session-only. `VideoWorkspace` is keyed by the local Object URL, so video replacement remounts all video-scoped domain controllers; the calibration and tracking reducers additionally define explicit `video-replaced` reset transitions for testability. Calibration changes are not placed in annotation or tracking undo history. Calibration undo can be added later as an independent history if demonstrated workflow needs justify it.

Tracking uses a third, independent reducer/history. Complete create, rename, track delete, sample add/replace/move/delete mutations are undoable; selecting a track, playback, seeking, trail preferences, and pointer previews are not. Track controls expose undo/redo directly. While Track Mark or Edit owns the canvas, Ctrl/Cmd+Z targets tracking; otherwise it retains its annotation behavior. This avoids merging unrelated histories and preserves all Phase 2 behavior.

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

The shared implementation now lives in `video/frameReference.ts`. Track samples also contain `time`, which is validated to equal the reference's exact `anchorTime`; it is convenient input for chronological and future physics selectors, not a second identity scheme. Same-frame matching uses scheme, bucket index, and bucket duration rather than floating-point time equality.

## Manual track data and ordering

A `Track` owns stable `id`, user-visible `name`, stable palette `color`, and `samples`. A `TrackSample` owns stable `id`, exact `time`, `TimestampFrameReference`, and `nativePosition`. It never stores display/CSS coordinates, world coordinates, distance, velocity, acceleration, or interpolation.

Pure model functions validate IDs, names, colors, finite non-negative time, finite native coordinates, frame-reference structure, time/anchor agreement, duplicate IDs, and duplicate frame identities. Insertion always sorts by exact media time with deterministic bucket/ID tie breakers, so seeking backward and filling gaps cannot corrupt trajectory order. Re-marking the same active track in the same frame bucket replaces only its native position while retaining its original ID, time, and frame reference. Deleting the final sample preserves the empty track.

Selectors find the current sample by frame identity, partition past/current/future history, apply lightweight trail modes, and derive ordered world samples through the existing `pixelToWorld` transform. Derived world values are never persisted. Calibration changes therefore update displays immediately; calibration reset leaves tracks untouched.

The canvas renders calibration, then trajectories, then frame-local annotations. Each track uses a stable palette color, while line weight, opacity, white current-frame handles, and an active ring avoid relying on color alone. The default trail shows past and current samples. The all-history option renders future segments dashed and muted, and current-only removes the path. Every sample mutation maintains the chronological array invariant once, so playback repaints do not repeatedly sort unchanged tracks.

Track Mark and Track Edit are explicit canvas modes. Entering either pauses playback, cancels calibration capture and unfinished annotation interaction, and selects the annotation Select tool. Starting an annotation or calibration interaction exits tracking. Mark creates or corrects the active current-bucket sample; an optional action then performs the existing approximate 30 fps step. Edit hit-tests only the active track's current sample, stores drag preview outside document state, and commits once at pointer-up. Starting playback exits tracking, while Left/Right stepping keeps the tracking mode active for efficient manual work.

## Calibration model and validity

A stored `Calibration` is always valid. Invalid or incomplete input remains transient and `createCalibration`/update functions return controlled result unions with explicit errors. The model contains:

- native-video reference points A and B;
- positive finite known distance and one typed unit (`mm`, `cm`, `m`, `in`, or `ft`);
- native-video origin, defaulting to reference A;
- a normalized positive-X vector in image coordinates, defaulting to A → B;
- source flags that distinguish defaults from custom origin/axis choices.

Coincident/nearly coincident references, non-positive or non-finite physical distances, unsupported/missing units, non-finite points, and degenerate X directions are rejected. Scale is derived at use time as:

`unitsPerPixel = knownDistance / distance(referenceA, referenceB)`

Editing distance or unit preserves origin and axis state. Re-picking the reference creates a new calibration with documented defaults. Reset removes only calibration; annotation native geometry remains unchanged and immediately returns to pixel display.

## Coordinate convention and transforms

Native video coordinates use rightward +x and downward +y. Calibration stores a normalized image-space `xAxis = (x, y)`. Positive world Y is derived as `(xAxis.y, -xAxis.x)`, the image-space direction 90° counterclockwise from positive X. Consequently, a rightward X axis yields an upward Y axis.

Pixel → world is a pure transform:

1. subtract the native-video origin;
2. project the pixel delta onto the X and derived Y unit vectors;
3. multiply both components by `unitsPerPixel`.

World → pixel divides world components by scale, expands them in the same orthonormal basis, and adds the native origin. Tests cover translated and rotated systems, image-down/world-up behavior, origin mapping, and round trips. Full precision is retained internally; only UI strings are rounded.

Annotations never store world coordinates. Line lengths and Point coordinates are derived from native geometry and the active calibration on every render, so edits or reset cannot leave stale values. Angle calculations remain unchanged because uniform translation, rotation, and scale preserve angles.

## Calibration overlay and interaction

The existing native-resolution canvas renders calibration first and annotations second. Calibration reference geometry uses a distinct purple treatment; origin and positive X/Y arrows use separate colors. Canvas input is routed to exactly one active domain. Starting calibration pauses playback, selects the annotation Select tool, and cancels incomplete annotation geometry. Annotation shortcuts and mutations are suppressed while calibration capture is active. A timestamp-bucket change cancels incomplete calibration selection so reference points cannot silently come from different video positions.

The calibration assumes a single uniform planar scale. It is not a perspective homography, camera calibration, lens correction, or depth model. A reference and measured motion at substantially different scene depths can produce inaccurate distances.

## Timing and frame-access decision

Media timestamps, not assumed frame indices, are the current source of truth. While playing, `requestVideoFrameCallback()` synchronizes the displayed timestamp to decoded frames when the browser provides it; a `requestAnimationFrame()` sampling fallback is used otherwise.

Browsers generally do not expose dependable source FPS metadata, and assigning `video.currentTime` is a timestamp seek rather than a guarantee of an exact adjacent decoded frame. Current frame-step buttons therefore seek by approximately `1 / 30` seconds, clearly labeled as a 30 fps fallback. The policy lives in `video/timing.ts`, leaving room for detected metadata or a user override without rewriting the controls. Variable-frame-rate video will remain timestamp-based.

Native duration may be unavailable, non-finite, or revised during loading. Seeking and duration-dependent controls stay disabled until usable metadata exists.

## Error and accessibility boundaries

The media controller reports unsupported/corrupt media and playback failures instead of silently swallowing them. Controls are native buttons, ranges, and selects with labels, focus treatment, and disabled states. Space toggles playback and Left/Right perform approximate steps only when focus is not inside an interactive or editable element.

## Keyboard interaction

- Space: play/pause; Left/Right: approximate frame step.
- V/P/L/A: Select, Point, Line, and Angle tools.
- T: enter or leave Track Mark for the active track.
- Escape: cancel unfinished geometry or a drag preview.
- Delete/Backspace: delete the current track sample while tracking, or the current-frame annotation selection otherwise. It never deletes a track.
- Ctrl/Cmd+Z: undo the active tracking domain while tracking, or annotation mutation otherwise; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo the same domain.

Shortcuts are ignored while focus is in normal interactive/form controls.

## Future extension points (not implemented)

- Phase 5 physics functions should consume ordered timestamped native samples plus optional calibration and remain independent of React. They should return derived position, displacement, distance, finite-difference velocity/speed, and acceleration series without mutating tracks.
- Canvas rendering can evolve into distinct overlay layers without changing native-coordinate storage.
- Frame decoding/tracking work can move behind a worker boundary; OpenCV.js is a possible later implementation detail.
- Project persistence can be introduced after a stable project schema exists, likely with IndexedDB.

Physics calculations, graphs, interpolation, persistence, perspective correction, assisted tracking, and export do not exist in the current codebase. Annotation and tracking undo histories are in-memory and use bounded full immutable snapshots; a command/delta model can replace them if large projects demonstrate a measured need. Calibration currently has no undo history and must be reset or edited explicitly. Timestamp buckets remain an approximate fallback identity until a decoded-frame-aware strategy is available.
