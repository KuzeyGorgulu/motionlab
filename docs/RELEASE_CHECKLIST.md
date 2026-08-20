# MotionLab v1.0.0 Release Checklist

## Scientific functionality

- [ ] Import and remove a supported local video; confirm no upload occurs.
- [ ] Play, seek, change speed, and step approximately backward/forward.
- [ ] Create/edit/delete Point, Line, and Angle annotations; verify undo/redo.
- [ ] Create, update, reset, and visually verify planar calibration.
- [ ] Create/edit/delete tracks and samples; verify track undo/redo and exact sample seeking.
- [ ] Seed, run, review, accept/discard, stop, and recover/reseed Assisted Tracking.
- [ ] Inspect raw/smoothed kinematics and position/velocity/acceleration graphs.
- [ ] Fit both supported motion models and inspect residual diagnostics/deviation links.
- [ ] Export CSV, scientific JSON, and current SVG graph.
- [ ] Configure, print, and export a standalone HTML report.
- [ ] Save a `.motionlab` project, reopen it, relink its video, and verify restored state.

## Product quality

- [ ] Clear browser storage and confirm first-run onboarding appears once, skips cleanly, and reopens from Help.
- [ ] Open Keyboard Shortcuts from Help and `?`; verify documented keys and Escape/focus behavior.
- [ ] Review About, Privacy, version, GitHub, live-demo, license, and Qzeybei attribution.
- [ ] Open the bundled constant-speed sample from the import screen and Help → Examples.
- [ ] Review no-video, no-calibration, no-track, no-sample, no-fit, no-diagnostics, no-report-track, unavailable-graph, and relink states.
- [ ] Inspect README screenshots/GIF and follow the demo recording sequence.
- [ ] Keyboard-navigate dialogs, forms, menus, toolbar, inspector, graphs, and report controls with visible focus.
- [ ] Check contrast, labels, headings, tab order, disabled communication, and screen-reader dialog names.
- [ ] Sanity-check 1440, 1024, 768, and 390 px widths for overlap and horizontal overflow.

## Error and recovery

- [ ] Try a non-video import, unsupported/corrupt video, malformed project, unrelated JSON, older/newer project version, and mismatched relink video.
- [ ] Trigger unavailable smoothing/model/residual states and Assisted Tracking loss; verify the next action is understandable.
- [ ] Cancel destructive replacement/removal and confirm existing work remains intact.
- [ ] Simulate a failed download if practical and verify no source work is lost.

## Technical verification

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] `git diff --check`
- [ ] Production `dist/` loads without console errors.
- [ ] No dependency, telemetry, network-processing, scientific-algorithm, or project-format regression was introduced.

## Release

- [ ] Package and UI version are `1.0.0` / `v1.0.0`.
- [ ] Changelog date and v1.0.0 release notes are final.
- [ ] README, product specification, architecture, roadmap, release process, and media are current.
- [ ] Release diff has received human review.
- [ ] Release commit is created.
- [ ] Annotated `v1.0.0` tag is created and pushed.
- [ ] GitHub Release is created from the prepared notes.
- [ ] Live deployment and public links are verified after publication.
