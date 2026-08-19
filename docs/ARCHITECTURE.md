# MotionLab Architecture

## Current architecture

MotionLab is a client-only React and TypeScript application built with Vite. There is no server. The implemented video, annotation, calibration, tracking, and analysis slices are organized as follows:

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
- `src/hooks/useAssistedTracking.ts` owns the serialized forward run, cancellation identity, frame sequencing, transient proposals, and accept/discard integration without changing the track data model.
- `src/assistedTracking/` contains the replaceable tracker interface, pure template matcher/confidence policy, frame extraction geometry, transient session reducer, worker protocol/implementation, and assisted overlay renderer.
- `src/components/tracking/AssistedTrackingControls.tsx` extends the existing Tracking panel with experimental seed/start/stop/status/metrics/accept/discard controls.
- `src/analysis/types.ts`, `kinematics.ts`, `series.ts`, and `chart.ts` define the pure derived kinematics and graph-data pipeline without importing React or mutating tracks.
- `src/analysis/panelState.ts` owns the small pure collapse/quantity-family state machine for the Analysis panel; it never owns or copies derived sample data.
- `src/components/analysis/KinematicsPanel.tsx` presents compact current-sample quantities in the right inspector.
- `src/components/analysis/AnalysisPanel.tsx` presents graph selection and the collapsible analysis dock below the video/timeline in the flexible left workspace column.
- `src/components/analysis/KinematicsGraph.tsx` renders the responsive, dependency-free multi-series SVG, live video playhead, transient graph cursor, accessible markers, and timestamp-seek interactions.
- `src/math/geometry.ts` owns generic point distance and angle math shared by annotations and calibration; the Phase 2 annotation path remains a compatibility re-export.
- `src/video/geometry.ts` contains pure aspect-fit and display/native coordinate conversions.
- `src/video/timing.ts` contains timestamp formatting, safe media-time clamping, and the fallback frame-step policy.
- `src/video/frameReference.ts` owns the domain-neutral timestamp-bucket reference used by annotations and tracks; the original annotation module remains a compatibility boundary.
- `src/styles.css` defines the current application styling without a runtime styling dependency.

React component state is used for transient media/UI state. Annotation domain data uses a reducer, while unfinished drafts and drag previews remain transient. A global state library would not add value yet. Annotation data is session-only and is cleared when the loaded video changes; project persistence is intentionally deferred.

Calibration has a separate reducer and is also session-only. `VideoWorkspace` is keyed by the local Object URL, so video replacement remounts all video-scoped domain controllers; the calibration and tracking reducers additionally define explicit `video-replaced` reset transitions for testability. Calibration changes are not placed in annotation or tracking undo history. Calibration undo can be added later as an independent history if demonstrated workflow needs justify it.

Tracking uses a third, independent reducer/history. Complete create, rename, track delete, sample add/replace/move/delete mutations are undoable; selecting a track, playback, seeking, trail preferences, pointer previews, and transient assisted proposals are not. Assisted acceptance uses one validated all-or-nothing batch insertion, so an entire run is one undo/redo mutation. Track controls expose undo/redo directly. While Track Mark or Edit owns the canvas, Ctrl/Cmd+Z targets tracking; otherwise it retains its annotation behavior. This avoids merging unrelated histories and preserves all Phase 2 behavior.

## Workspace layout

The active desktop workspace is a two-column CSS Grid. The flexible left column contains the video/annotation stage and transport in its upper row and the collapsible Analysis dock in its lower row. The 320–360 px right inspector spans both rows, so calibration, tracking, numerical analysis, annotation, and source controls form one continuous rail and the graph never extends beneath them. The inspector is the only independently scrolling desktop region; its stable scrollbar gutter avoids changing control width as content grows.

At 980 px and below, the grid becomes one column in document order: video/timeline, Analysis, then inspector. The inspector returns to normal page flow and uses two internal columns until the existing narrow-screen breakpoint reduces it to one. Graph sizing remains based on its left-workspace container rather than the contained video's visible rectangle, so portrait-video letterboxing cannot narrow the graph.

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

The canvas renders calibration, confirmed trajectories, transient assisted suggestions, then frame-local annotations. Each track uses a stable palette color, while line weight, opacity, white current-frame handles, and an active ring avoid relying on color alone. The default trail shows past and current samples. The all-history option renders future segments dashed and muted, and current-only removes the path. Every sample mutation maintains the chronological array invariant once, so playback repaints do not repeatedly sort unchanged tracks.

Track Mark and Track Edit are explicit canvas modes. Entering either pauses playback, cancels calibration capture and unfinished annotation interaction, and selects the annotation Select tool. Starting an annotation or calibration interaction exits tracking. Mark creates or corrects the active current-bucket sample; an optional action then performs the existing approximate 30 fps step. Edit hit-tests only the active track's current sample, stores drag preview outside document state, and commits once at pointer-up. Starting playback exits tracking, while Left/Right stepping keeps the tracking mode active for efficient manual work.

## Assisted tracking subsystem

Assisted tracking is a separate replaceable subsystem whose UI controller depends on the `AssistedTracker` interface (`initialize`, `locate`, explicit template-update commit, `reset`, and lifecycle disposal), not the current template implementation. Vite builds `tracker.worker.ts` as a dedicated worker. If worker construction is unavailable, a same-interface inline fallback yields before the bounded computation; scientific outputs and failure semantics remain identical.

The main thread retains the `HTMLVideoElement`, serializes timestamp seeks using the existing `getFrameStepSeconds()` policy, waits for decoded seek completion, and extracts only a bounded native-pixel ROI with a reusable canvas. RGBA buffers are transferred to the worker, which never receives full video frames. The worker retains an immutable grayscale seed plus a separate current template; all matching, seed fallback, and pending adaptation remain off the UI thread.

`geometry.ts` derives transient native-pixel geometry from the shorter video dimension. With `s = min(width, height) / 720`, template size remains `21s` rounded upward when the nearest integer is even and clamped to an odd 21–65 px. The requested native search radius is `clamp(round(72s), 72, 256)`. A reduction divisor of 2 is used through 720p, 3 through 1080p, and 4 above 1080p; coarse radius is the requested native radius divided by that factor and rounded up, so the actual native envelope is exactly `coarseScale * coarseRadius`. Full-resolution refinement radius is `clamp(round(4s), 4, 8)`. Representative template/divisor/coarse-radius/native-radius/refinement values are 21/2/36/72/4 at 720p, 33/3/36/108/6 at 1080p, 43/4/36/144/8 at 1440p, and 63/4/54/216/8 at 2160p.

The extraction ROI is the bounded union of one envelope centered on the previous observation and one centered on the current search hint. Each envelope includes the native search radius, template half-size, and one refinement-radius guard. Retaining the observation-centered envelope keeps prediction from becoming a hard constraint during acceleration or reversal. The union remains a small crop rather than a full frame, uses the reusable canvas, and clamps safely at native frame edges. The full template is predictably rejected if it would clip at seed time.

The worker converts the stable seed and search ROI to grayscale. Pure box averaging reduces both arrays by the configured divisor. Normalized mean absolute difference scores the bounded coarse candidates, and at most eight spatially distinct hypotheses are mapped back to native coordinates. Only small full-resolution neighborhoods around those hypotheses are searched at one-pixel resolution. Each hypothesis retains its best full-resolution integer-pixel candidate; those at-most-eight representatives are then grouped into connected spatial match basins before ambiguity is evaluated. The guarded one-center 4K policy has a synthetic upper estimate below 13 million pixel comparisons, and a conservative maximum guided-union rectangle remains below 16 million, compared with about 31.5 million for the Phase 7.1 bounded matcher. Basin clustering is a bounded pairwise pass over at most eight representatives, so it does not change those matching-work bounds. These are operation bounds, not real-video latency claims.

The clicked `TrackSample.nativePosition` remains the physical measurement anchor; the larger template is recognition context only. Each search carries the rounded visual-template center expected around the previous anchor. A successful match returns its integer displacement from that visual center, and the controller adds exactly that displacement to the prior physical anchor. Strong edges or markings elsewhere in the template therefore cannot replace the requested anchor.

Confidence policy is centralized in `confidence.ts`, while `matchClustering.ts` defines spatial basin identity. The native-pixel basin-link radius is `clamp(max(round(templateSize * 2/3), 2 * refinementRadius + coarseScale), 12, 48)`: 14 px at 720p, 22 px at 1080p, 29 px at 1440p, and 42 px at 2160p/4K. Representatives are processed by ascending full-resolution score and join the nearest existing basin whose best candidate is at Euclidean separation `<=` the radius. This deterministic best-first rule prevents a weaker candidate between two strong alternatives from transitively collapsing them. A basin representative is its lowest-score full-resolution integer position, with Y then X providing deterministic score-tie ordering; positions are never averaged. A usable seed needs grayscale standard deviation of at least 6. The best basin representative must have normalized mean absolute error no greater than 0.22, a relative score margin of at least 0.08 over the second-best separate basin, and combined confidence of at least 0.55. Search-boundary candidates receive a conservative penalty. Motion guidance does not rank or rescue basins. These constants are prototype policy, not claims of statistical probability.

`useAssistedTracking` owns transient `idle`, `seed-selecting`, `seeded`, `running`, `stopped`, `failed`, and `completed` session states. Each run records the seed, native resolution, selected geometry, current position, transient proposals, processed count, latest confidence, consecutive misses, whether the latest search used motion guidance, elapsed time, average milliseconds/frame, and a session identity. A bounded 120-entry internal diagnostic trail records frame/time, prediction, search radius, best position, confidence, cluster count, recovery attempt, template source, acceptance, and failure reason without adding production UI. None of this diagnostic geometry or guidance is written to `TrackSample`. `AbortController` plus a generation token prevents late seek/worker results from mutating a stopped, replaced, or newer session. Playback, active-track change, incompatible canvas interaction, video replacement, and unmount cancel in-scope work safely.

The first assisted frame uses the large seed-centered coarse envelope without prediction. After two image-confirmed observations exist, `motionGuidance.ts` scales their measured displacement by `nextDt / previousDt` when both intervals are valid and the ratio is between 0.25 and 4. The finite hint magnitude is capped at the active search radius; invalid timing/history or an implausibly off-frame prediction falls back to the latest observation. Normal guidance adds a second envelope without removing the envelope around the last observation. A low-confidence result advances a separate processed-frame cursor but leaves the reliable observations and physical anchor unchanged. Subsequent recovery attempts project those reliable observations to the later media time and use predicted-center geometry at approximately 1.35×, 1.7×, then 2× the normal native radius, aligned to the coarse scale and capped at 512 px. Three misses are tolerated; a fourth consecutive miss terminates recovery. A proposed sample is created only after coarse search, full-resolution refinement, and normal confidence acceptance locate real pixels, so missed timestamps remain genuine gaps.

`adaptiveTemplate.ts` owns conservative appearance continuity. The seed template never changes. A successful match is eligible to stage a current-template update only when confidence is at least 0.82, normalized error is at most half the ordinary 0.22 acceptance maximum (0.11), and any runner-up margin is at least the existing good-margin value of 0.2. The staged patch is a 10% blend and is committed by the controller only after the matched position becomes a valid transient sample; a cancelled or stale response cannot commit it. During recovery only, an adapted current template and the seed template are both matched. The lower-error accepted result wins when their positions occupy the same Phase 7.3 basin; if both accepted results are farther apart than that basin radius, recovery returns an unresolved ambiguity. Seed fallback and double matching are skipped on normal frames and before any real adaptation.

At run start, every pre-existing active-track frame identity except the seed is protected. The controller checks requested and actual decoded frame identities before matching; conflicts, repeated buckets, video end, seek/extraction/worker errors, and invalid state stop with visible reasons. Low visual quality, genuine ambiguity, a missing target, and range exhaustion enter bounded recovery instead. Persistent loss stops with a reseeding message. Proposals render after confirmed trajectories as a dashed path with hollow diamond markers, so they are distinguishable without color. They are not included in calibration, kinematics, graphs, or tracking history until acceptance.

Acceptance revalidates every proposal against current track invariants and inserts all of them atomically. No existing ID or frame identity can be replaced. The seed is already an explicit ordinary sample; accepted observations are ordinary `TrackSample`s containing only ID, exact anchor time/frame reference, and native position. One undo removes the accepted batch and redo restores it. Discard resets only transient assisted state.

Performance instrumentation is user-visible rather than fabricated: processed frames, elapsed run time, and average milliseconds per processed frame are derived from the actual run. To measure a representative video, seed it, run until stop/failure/completion, and record those displayed values. No repository benchmark fixture or universal speed claim is included.

The prototype is intentionally forward-only and remains limited by sustained occlusion, rapid rotation or scale change, abrupt lighting changes, severe motion blur, repetitive/flat texture, motion beyond the bounded recovery envelope, and targets leaving frame. Short misses may recover automatically; persistent loss still requires accepting reliable proposals, making a normal manual correction, and reseeding. No smoothing, interpolation, predicted observations, optical flow, camera compensation, or ML inference is present.

## Derived kinematics

Kinematics is an immutable projection of the active `Track` and current `Calibration`; none of its outputs enter tracking history or sample storage. Invalid source samples are excluded, remaining samples are normalized chronologically, and calibrated positions are obtained only through the existing `pixelToWorld` transform. Without calibration, native positions remain in explicit pixel space. The unit metadata is dimensional: `u`, `u/s`, and `u/s²`, where `u` is the selected calibration unit or `px`.

For each valid positive interval, displacement is the coordinate-space difference between consecutive positions and cumulative distance adds each segment magnitude. It is path length, not endpoint displacement. Intervals of one microsecond or less are treated as effectively zero and produce unavailable interval/derivative values rather than `NaN` or infinity.

Velocity is differentiated from position using the derivative of the quadratic interpolant through three samples. This is a centered three-point estimate at interior samples and a second-order one-sided estimate at endpoints, and its weights account for unequal timestamp spacing. A two-sample track uses its valid secant velocity at both endpoints. Acceleration applies the same non-uniform centered derivative to velocity at interior samples; it is deliberately unavailable at boundaries or when any required neighboring velocity is unavailable. No constant-frame-rate assumption, smoothing, interpolation, or extrapolated boundary acceleration is used.

`VideoWorkspace` memoizes full-track analysis once on active track/calibration identity and passes the same immutable projection to both the numerical inspector and Analysis panel. Playback timestamp updates only select the current derived sample and do not recompute the numerical series. A track edit, delete, undo/redo, active-track switch, or calibration change produces a new dependency and updates all quantities and graphs immediately.

Visualization selectors expose three dimensionally coherent groups: Position contains X and Y, Velocity contains vx, vy, and Speed, and Acceleration contains ax, ay, and magnitude. `series.ts` creates these immutable groups from `TrackKinematics`, preserving source sample IDs/timestamps and omitting each unavailable derivative independently. Their selected family and the dock's expanded state live in a tiny reducer above the panel, so collapsing hides only presentation and preserves the selection and derived analysis.

`chart.ts` derives one X domain from the full valid analyzed-track timeline and applies it to every series in the selected group. It therefore retains the source-time context when acceleration endpoints are missing. Pure functions map media time to SVG X and SVG X back to clamped media time, handle degenerate domains, and produce one combined Y domain because every displayed series shares a unit. The deterministic marker policy reduces ordinary marker size for denser tracks without dropping or aggregating samples.

The responsive SVG labels media time and the reactive dimensional unit explicitly and draws a distinct zero baseline whenever the displayed range crosses zero. Circle, square, and diamond markers plus labels distinguish components without relying on color. No lines connect observations. The actual `controller.currentTime` drives an unsnapped video playhead, while pointer movement owns a transient time-only cursor; arbitrary cursor positions never produce interpolated quantities. Background clicks pause and seek by mapped timestamp. Marker activation stops propagation and seeks to the sample's exact anchor, and the existing frame-reference selector—not floating-point equality—continues to determine active-marker highlighting.

Phase 6 intentionally retains the hand-authored SVG rather than adding a chart dependency. It already provides accessible keyboard markers, responsive layout, exact domain control, and a direct future SVG export path at materially lower bundle and integration cost. No smoothing, interpolation, resampling, chart library, or new persistence boundary is introduced.

Numerical differentiation amplifies tracking noise. Velocity is less stable than position, and acceleration—being a second numerical derivative—can be substantially noisier. This limitation is presented in the UI; Phase 5 intentionally adds no smoothing policy.

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

The existing native-resolution canvas renders calibration first, confirmed trajectories second, transient assisted proposals third, and frame-local annotations last. Calibration reference geometry uses a distinct purple treatment; origin and positive X/Y arrows use separate colors. Canvas input is routed to exactly one active domain. Starting calibration pauses playback, selects the annotation Select tool, and cancels incomplete annotation geometry. Annotation shortcuts and mutations are suppressed while calibration capture is active. A timestamp-bucket change cancels incomplete calibration selection so reference points cannot silently come from different video positions.

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

- Canvas rendering can evolve into distinct overlay layers without changing native-coordinate storage.
- The `AssistedTracker` interface can accept a later optical-flow, WASM, or ML implementation without changing tracks, acceptance, or the UI session contract.
- Project persistence can be introduced after a stable project schema exists, likely with IndexedDB.

Smoothing, model fitting, multi-track graph comparison, interpolation, persistence, perspective correction, and export do not exist in the current codebase. Assisted tracking is only the documented conservative template prototype, not general object tracking. Annotation and tracking undo histories are in-memory and use bounded full immutable snapshots; a command/delta model can replace them if large projects demonstrate a measured need. Calibration currently has no undo history and must be reset or edited explicitly. Timestamp buckets remain an approximate fallback identity until a decoded-frame-aware strategy is available.
