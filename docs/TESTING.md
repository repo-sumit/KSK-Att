# Testing

```bash
npm test            # Vitest: unit + integration (~0.3 s, 294 tests)
npm run e2e         # Playwright: builds, serves on :3200, runs every spec
npm run check       # lint + typecheck + test + build
npm run check:demo  # proves a demo-off build contains no demo code
```

## Layers

| Layer | Where | What it proves |
|---|---|---|
| **Domain unit** | `tests/unit/domain` | Access resolution for every mapping model (`access.test.ts`); windows, slots and the hard fence (`schedule.test.ts`); marking defaults, completeness, submit/correction/staff rules, the effective-marks fold (`marking-rules.test.ts`) |
| **Config unit** | `tests/unit/config` | Layer merging, the `overridableKeys` policy, normalisation, every validation rule, journey derivation (disabled means absent) |
| **i18n unit** | `tests/unit/i18n` | Marathi covers every English key with the same placeholders and no blanks; English fallback; plurals; Latin digits in Marathi; prototype time and range formats; PRD distance format |
| **Design unit** | `tests/unit/design` | CSS Modules use tokens only: no raw colours, radii or font sizes, and no undefined custom property (`token-lint.test.ts`). Every text/background pair used meets WCAG AA (`contrast.test.ts`) |
| **Integration** | `tests/integration/services.test.ts` | The real services over the mock container with a `MemoryStore`, a `FixedClock` at 10:15 IST and simulation speed 0. Covers login scoping; submit-once lock and concurrent double submit; drafts; verification required; offline lock → sync on reconnect; sync on app start; failed sync → retry; not downloaded; offline disabled; principal correction (reason, same day, append-only, not synced); staff first-mark-wins; reports; reset |
| **E2E** | `tests/e2e/*.spec.ts` | The production build in Chromium (Pixel 5, 360×760, `Asia/Kolkata`), driven through the UI plus `window.__kskDemo` for setup |

## E2E coverage of the key flows

| # | Flow | Spec |
|---|---|---|
| 1 | Open instructor: trade → batch → verify → mark → review → submit → locked | `open-instructor.spec.ts` |
| 2 | Outside the geo-fence is blocked with the real distance | `open-instructor.spec.ts` |
| 3 | First-time user: login with both confirmations, simulated face registration, permission primer | `first-time.spec.ts` |
| 4 | Batch-mapped: only assigned classes; a future class explains when it opens | `mapping.spec.ts` |
| 5 | Timetable: today's periods, the current one actionable, closed ones not | `mapping.spec.ts` |
| 6 | Employability Skills: several trades, selected batches, separate ES record | `mapping.spec.ts` |
| 7 | Principal correction with a reason, recorded in the audit log | `principal.spec.ts` |
| 8 | Principal staff marking; self-verified rows locked | `principal.spec.ts` |
| 9 | Offline: downloaded roster → lock locally → sync when back online | `offline.spec.ts` |
| 10 | Marathi everywhere, Latin digits, no overflow at 320px; Reset Demo restores the story | `language-reset.spec.ts` |
| + | No horizontal overflow at 320/360/375/390/412/768; status pills fit with five statuses; axe WCAG 2 A/AA scans of instructor, principal, report, correction and offline screens | `responsive.spec.ts` |

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

When changing UI, run `npm run e2e` and look at the changed screens at 320px and 360px (DevTools device mode is enough).

## Writing new tests

- Test a rule in `src/domain` with a unit test, and test a service flow through `createMockContainer` in the integration suite. Build the setup with `setup()` / `signIn()` in `services.test.ts`.
- Use `FixedClock(instantAt('2026-09-25', 'HH:MM'))` for time-dependent behaviour; never depend on the real clock.
- E2E: prefer role and name locators (`getByRole('button', { name: 'Absent', exact: true })`). Copy is the contract, so if you change an English string, update the spec.
