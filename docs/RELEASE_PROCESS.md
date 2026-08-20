# MotionLab Release Process

MotionLab uses semantic versioning. PATCH releases contain fixes without intended feature changes, MINOR releases add backward-compatible features, and MAJOR releases may change product or project-format compatibility.

## Prepare a release

1. Run the complete automated verification suite:

   ```bash
   npm test
   npm run typecheck
   npm run build
   npm run test:e2e
   git diff --check
   ```

2. Complete the manual smoke test in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md), including a real local video and representative viewport widths.
3. Refresh genuine screenshots with [MEDIA_CAPTURE.md](MEDIA_CAPTURE.md) and review any externally recorded demo video.
4. Update `CHANGELOG.md` with user-facing changes and the release date.
5. Confirm `package.json`, `package-lock.json`, About MotionLab, report provenance, and release notes show the intended version.
6. Review the full diff, then commit the release changes.
7. Create the annotated tag, for example `git tag -a v1.0.0 -m "MotionLab v1.0.0"`.
8. Push the release commit and tag after human approval.
9. Create a GitHub Release from the tag and paste the prepared notes from `docs/releases/`.
10. Verify the published archive, live deployment, README media, links, and downloadable artifacts.

Do not commit, tag, push, or publish automatically during implementation. Those actions require a human-reviewed release decision.

## Compatibility note

Application semantic versions are independent from the `.motionlab` project schema version. A product MAJOR release should be considered when project compatibility intentionally breaks; compatible application releases may continue reading and writing project format version 1.
