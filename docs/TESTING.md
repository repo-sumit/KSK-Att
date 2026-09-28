# Testing

```bash
npm test            # Vitest: unit + integration (~2 s, 425+ tests)
npm run e2e         # Playwright: builds, serves on :3200, runs every spec (39 tests)
npm run check       # lint + typecheck + test + build
npm run check:demo  # proves a demo-off build contains no demo code
```

## Layers

| Layer | Where | What it proves |
|---|---|---|
| **Domain unit** | `tests/unit/domain` | Access resolution for every mapping model (`access.test.ts`); windows, slots and the hard fence (`schedule.test.ts`); marking defaults, completeness, submit/correction/staff rules, the effective-marks fold (`marking-rules.test.ts`); announcement targeting (institute, trade, batch, named; never across institutes; the principal reads all), the show window, banner order, English fallback, and demo notices covering every kind in both languages (`announcement.test.ts`) |
| **Config unit** | `tests/unit/config` | Layer merging, the `overridableKeys` policy, normalisation, validation rules (including the at-risk threshold and trend ranges), journey derivation (disabled means absent): Home · Reports for instructors and Attendance only for the institute board, Reports kept for Offline data, report sections by role with no daily register, the new report keys, announcements on/off |
| **Reports unit** | `tests/unit/reports` | Leaderboard ranking: 1…n highest first, stable ties, unmarked students last and unranked, lowest first keeps positions; month arithmetic for the trend (`leaderboard.test.ts`) |
| **i18n unit** | `tests/unit/i18n` | Marathi covers every English key with the same placeholders and no blanks; English fallback; plurals; Latin digits in Marathi; prototype time and range formats; PRD distance format |
| **Services unit** | `tests/unit/services` | The prototype face check's pure rules (`liveness-rules.test.ts`: light, one face, closer/back, oval, straight hold, left/right with return to centre, mirrored-camera calibration, noise tolerance, moving away isn't a turn, timeout diagnosis) and getUserMedia error mapping; the liveness service with a scripted detector, guided fallback, "Guided only" and cancel; the simulated matcher stores no image; camera routing (`face-services.test.ts`); "Use demo account": exactly five accounts in order, the panel's persona highlighted only, choosing prepares the story without signing in, the First-time story is kept, unknown ids change nothing, presets share the same preparation, every persona logs in through the real auth service, production has no assist (`demo-login.test.ts`) |
| **Design unit** | `tests/unit/design` | CSS Modules use tokens only: no raw colours, radii or font sizes, and no undefined custom property (`token-lint.test.ts`). Every text/background pair used meets WCAG AA (`contrast.test.ts`) |
| **Integration** | `tests/integration/services.test.ts` | The real services over the mock container with a `MemoryStore`, a `FixedClock` at 10:15 IST and simulation speed 0. Covers login scoping; submit-once lock and concurrent double submit; drafts; verification required; offline lock → sync on reconnect; sync on app start; failed sync → retry; not downloaded; offline disabled; principal correction (reason, same day, append-only, not synced); staff first-mark-wins; reports (at-risk grouping and threshold, open-mapping scope = the batches I teach, my attendance with a three-month trend, the ES instructor's subject sessions, the principal's institute summary and correction log); refreshing one pack and the pack on session cards; announcement targeting and the on/off switch; reset |
| **E2E** | `tests/e2e/*.spec.ts` | The production build in Chromium (Pixel 5, 360×760, `Asia/Kolkata`), driven through the UI plus `window.__kskDemo` for setup. Tests resize the viewport for tablet and desktop checks. Chromium runs with a fake camera (`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`); every spec except `camera.spec.ts` uses the demo's simulated camera |

## E2E coverage of the key flows

| # | Flow | Spec |
|---|---|---|
| 1 | Open instructor: trade → batch → verify → mark → review → submit → locked | `open-instructor.spec.ts` |
| 2 | Outside the geo-fence is blocked with the real distance | `open-instructor.spec.ts` |
| 3 | First-time user: login with both confirmations, face registration (simulated camera), permission primer | `first-time.spec.ts` |
| 4 | Batch-mapped: only assigned classes; a future class explains when it opens | `mapping.spec.ts` |
| 5 | Timetable: today's periods, the current one actionable, closed ones not | `mapping.spec.ts` |
| 6 | Employability Skills: several trades, selected batches, separate ES record | `mapping.spec.ts` |
| 7 | Principal correction with a reason, recorded in the audit log | `principal.spec.ts` |
| 8 | Principal staff marking; self-verified rows locked | `principal.spec.ts` |
| 9 | Offline: downloaded roster → lock locally → sync when back online | `offline.spec.ts` |
| 10 | Marathi everywhere, Latin digits, no overflow at 320px; Reset Demo restores the story | `language-reset.spec.ts` |
| + | No horizontal overflow at 320/360/375/390/412/768/1024/1280/1440/1920; status pills fit with five statuses; axe WCAG 2 A/AA scans of instructor, principal, report, correction and offline screens, the open profile menu and the open demo panel | `responsive.spec.ts` |
| + | Home is today's work: notices strip and sheet (targeted per reader), trades on Home, no Attendance tab or "View reports" for instructors, `/attendance` → Home; refresh one batch from its card; the principal keeps Attendance and sees every notice | `home.spec.ts` |
| + | Reports: my attendance with trend, a batch's leaderboard sorted both ways with at-risk flags, at-risk students and the batch filter, Offline data reached from Reports; Offline data refreshes one batch, then all; the principal's institute, all batches by trade, detail reports | `reports.spec.ts` |
| + | Wide screens: full-width header, content neither phone-width nor stretched, one navigation in the header, no Profile link; the avatar is the right-most control and the demo trigger sits in the header (floating only on headerless screens); demo controls collapsed on every size, a drawer on the left that overlays without reflow (Esc returns focus); profile menu anchored on desktop, bottom sheet on phones; roster is a row list in an 800px column with a centred 280px action | `desktop.spec.ts` |
| + | "Use demo account": nothing filled until a pick, the panel's persona only highlighted, the Institute code filled and focused, the Trainer ID prefilled, "Change", typing forgets the pick, every confirmation still shown; quick login and "Skip login screens" | `login-assist.spec.ts` |
| + | Real camera (fake device): registration takes three photos from the live video and stores or sends none of them (storage, IndexedDB, network); the daily check starts on-device face detection; a blocked camera explains itself and recovers | `camera.spec.ts` |
| + | Review findings, kept fixed: long absent lists and the principal's 17-batch report list (with the last batch's leaderboard) scroll to their last row; the demo panel never scrolls sideways with Advanced open; "Use demo account" sits above the Continue bar at 320×568 and its list scrolls into view; every verification problem keeps the app header; motion really runs (CSS Modules keyframes resolve: the refresh icon spins, a report row's panel names a real keyframes rule) | `regressions.spec.ts` |

**Console must stay clean.** The shared fixture (`tests/e2e/fixtures.ts`) fails any test that logs a console error, a page error, or a React/Next warning. It also starts each test with simulations at 5% speed, so flows are fast but still pass through every state.

Helpers in `fixtures.ts`:

- `preset(page, id)` opens `/?preset=id` and waits for Home.
- `demo(page, "setConfig({...})")` calls the demo controller.
- `nav(page, 'Reports')` finds the bottom-nav link.
- `expectNoOverflow(page)` and `expectGroupsFit(page)` are the layout checks.

## Visual QA against the prototype

Visual fidelity was checked by screenshot, not by pixel diff (the prototype has a fake phone frame and status bar):

1. Capture the prototype screens with Playwright (`prototype/Prototype.html`, driving its own controls), and the app screens at 360px and 320px from the production build.
2. Compose side-by-side sheets (prototype left, app right), review them screen by screen, and fix the drift. Remaining differences are the deliberate ones listed in `DECISIONS.md`.
3. Run a multi-lens design critique (prototype fidelity, SwiftChat DS, impeccable, design-taste-frontend, huashu-design, accessibility, field UX, Marathi). The prototype and DS stayed authoritative over the lenses. The critique found 82 findings, about 38 distinct issues after de-duplication. Most are fixed; D-037 to D-044 record the design calls, and D-044 lists what was deliberately left open.

When changing UI, run `npm run e2e` and look at the changed screens at 320px, 360px and 1280px (DevTools device mode is enough).

### The detection path with a real face

Chromium's fake camera shows a test pattern with no face, so E2E proves only that detection starts and asks for a face. The full detection-driven registration (straight → left → right) was checked once by hand. Chromium was fed a synthetic head-turn video built from renders of a public-domain portrait, through `--use-file-for-fake-video-capture`. That media was kept in the session scratch folder and deleted; it is **not** in this repository and must not be added as a fixture.

That run confirmed three things:
- the frontal photo is taken after about 0.5 s;
- turns are accepted from the measured yaw ratios (about ±0.24 to ±0.30 at 22–30°);
- a person who turns the "wrong" way first is still accepted after the 1.5 s mirror calibration.

It also led to lowering the turn threshold from 0.22 to 0.18 (D-048). Re-check on a real phone before rollout.

## Writing new tests

- Test a rule in `src/domain` with a unit test, and test a service flow through `createMockContainer` in the integration suite. Build the setup with `setup()` / `signIn()` in `services.test.ts`.
- Use `FixedClock(instantAt('2026-09-25', 'HH:MM'))` for time-dependent behaviour; never depend on the real clock.
- E2E: prefer role and name locators (`getByRole('button', { name: 'Absent', exact: true })`). Copy is the contract, so if you change an English string, update the spec.
