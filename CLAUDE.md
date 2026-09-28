@AGENTS.md

# KSK Attendance MiniApp (Maharashtra)

A mobile-first attendance MiniApp for **ITI craft instructors and principals in Maharashtra**, opened inside the **SwiftChat Android WebView**. Instructors mark student attendance once per batch (or per half-day / period, by configuration). Principals see the whole institute, mark staff, and correct same-day mistakes with a reason and an audit trail. This build runs entirely on **mock data** behind repository interfaces, with a floating **demo panel** for stakeholder demos. Real APIs plug in later without UI changes.

## Sources of truth (in this order)

1. `Doc/PRD.pdf`: product rules, configuration registry, invariants.
2. `prototype/Prototype.html`: the approved clickable prototype. It is authoritative for layout, copy and flow.
3. `Doc/swiftchat-design-system.md`: SwiftChat DS. It is authoritative for tokens and components. Use light mode only.
4. `Doc/mh_ksk_logo.png`: the brand logo. **Never modify the original.** Derived icons come from `npm run icons`.

`Doc/swiftchat.png` was referenced by the brief but is missing (see `docs/DECISIONS.md` D-004). Features the PRD doesn't have (Home announcements, per-batch refresh, the at-risk report) are extensions, recorded in D-053–D-055.

Deeper docs are in `docs/`: PRODUCT_CONTEXT, ARCHITECTURE, DESIGN_SYSTEM, CONFIGURATION, DATA_MODEL, DEMO_GUIDE, TESTING, DECISIONS.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000 (demo mode via .env.development); predev copies the MediaPipe wasm into public/vendor
npm run lint         # ESLint 9 flat config, including the architecture boundaries below
npm run typecheck    # tsc --noEmit
npm test             # Vitest: unit + integration (tests/unit, tests/integration)
npm run e2e          # Playwright: builds, serves on :3200, Pixel 5 at 360px, Asia/Kolkata
npm run build        # production build (all routes static); prebuild runs scripts/vendor-mediapipe.mjs
npm run check        # lint + typecheck + test + build
npm run check:demo   # builds with NEXT_PUBLIC_DEMO_MODE=false into .next-nodemo and greps that no demo code shipped
npm run icons        # regenerate public/branding/* and src/app/{icon,apple-icon}.png, favicon.ico from the logo
```

The Node range is `>=20.9 <27`. This is Next.js **16** with React 19.2. Read `node_modules/next/dist/docs/` before using an unfamiliar API (see AGENTS.md).

## Architecture rules (enforced by ESLint; see `eslint.config.mjs`)

```
UI (src/app, src/features, src/components, src/hooks)
  → services (src/services)          ← composition root: src/services/container.ts
    → repository interfaces (src/repositories/interfaces)
      → mock impl (src/repositories/mock) | API impl (src/repositories/api, stubs)
domain (src/domain) and config (src/config) are pure TypeScript: no React, Next, services or storage.
```

- The UI **never** imports `@/data/*`, `@/repositories/mock|api` or `@/demo/*`. It reads data only through `useServices()` / `useQuery()`.
- The UI **never branches on a role or a person**. `journey.isPrincipal` is lint-forbidden in UI code. Screens read capabilities from `useJourney()` (`src/config/journey.ts` is the only place that decides what exists). A disabled feature is *absent*, not hidden.
- Integrity rules (submit once, no backdating, principal-only same-day corrections with a reason, time fence, verification before the list, one staff mark per day) live in `src/domain/rules.ts`. Services and repositories enforce them. Hiding a button is never the only guard.
- Corrections are append-only. The original submission is never modified. `effectiveMarks()` folds corrections over it.
- All dates and times are IST (`src/lib/time.ts`). Inject `Clock`; never call `new Date()` in domain code.
- CSS Modules only. Every colour, radius, type size and spacing value is a token from `src/styles/tokens.css` / `typography.css` (a unit test lints this). No UI libraries.
- Files over 300 lines trigger a lint warning. Split them.

## SwiftChat Design System rule

Use SwiftChat semantic tokens and the kit in `src/components/ui`. Montserrat is the English font and Mukta the Marathi font (`:lang(mr)` switches the type variables). Status is always icon + text + colour. Touch targets are ≥ 44px and primary CTAs are 56px. The only deviations from the DS and prototype are documented in `docs/DECISIONS.md` (for example, the AA contrast overrides in D-010). Do not restyle beyond them.

## Responsive rule: mobile-first is not a fixed mobile viewport

- Phones (320–599px) are the primary design. From 600px the app fills the viewport, and content keeps a readable column on the DS grid (margins 16/36/64). Choose each screen's column with `ScreenLayout width="form" | "reading" | "wide"` (480/800/1008), and use `card` for single-question screens. Never reintroduce a phone-width frame.
- Wider screens get **no new features**: the same hierarchy, at most two columns, the roster always a row list (never a table), primary actions 280px and centred.
- **One header:** `AppHeader` (`src/features/shell`) on every signed-in screen: brand left, avatar top right (always the right-most control). Primary navigation is `journey.navTabs`: **Home · Reports** for instructors (Home owns today's classes) and **Home · Attendance · Reports** for the principal. It is the bottom nav on phones and a header row from 600px, never a sidebar. Class-marking task screens take their `area`/back target from `useAttendanceRoot()`. **Profile is not a destination:** the avatar opens `ProfileMenu`, the only profile entry point. Offline data lives under Reports (`/reports/offline`). See `docs/DESIGN_SYSTEM.md` → Responsive behaviour and D-045/D-046/D-052/D-056.

## Mock data and simulation

- `src/data/mock/*` holds deterministic master data (Govt ITI Pune, code **27410**: 5 trades, 17 batches, 417 students; a second institute in Nashik), history generated at read time for past working days (including the ES instructor's sessions), and six announcements. `seeds.ts` builds today's story relative to the current date.
- The mock DB (`src/repositories/mock/database.ts`) lives in localStorage namespace `ksk:v1`. It **reseeds automatically when the calendar day changes** and on schema bumps.
- Location, face-match outcome, camera choice, permissions, network, sync failure and speed come from a `SimulationSource`. Services wait a simulated network time (`simulatedDelay`, scaled by speed, 0 in tests) so loading states are real (D-059).
- **Face (D-048):** three seams.
  - `FaceCaptureService` opens the **real front camera** (getUserMedia). The demo can switch to a simulated one.
  - `LivenessService` is a **prototype movement check** with MediaPipe BlazeFace on the device, falling back to guided countdown captures.
  - `FaceMatchService` is **simulated** (`MockFaceMatchService`): it never compares faces.
  - Photos are in-memory only: never stored, never sent. Never describe any of this as secure biometrics or liveness detection in UI or docs. MediaPipe is pinned to 0.10.35 (1.x phones home, D-049).
- Location results carry `source: 'device' | 'simulated'`.
- `src/repositories/api/*` are typed stubs that throw `NotImplementedError` and document the endpoints each method will call.

## Configuration

`AppConfiguration` (`src/config/types.ts`) is resolved in layers: product defaults → Maharashtra state floor (`src/config/states/maharashtra.ts`) → district/institute layers (only keys the state lists in `overridableKeys`) → demo overrides (persona patch, then demo-panel changes; demo builds only). `validate.ts` rejects invalid combinations. Every option and its user-visible effect is described in `docs/CONFIGURATION.md`.

## Demo layer

`src/demo/*` holds the demo state (`ksk-demo:v1`), the demo clock (fixed 10:15 IST by default), the simulation source, personas, 7 presets and the panel. The panel is a collapsed **Demo** trigger portaled into the header's tool slot (`src/components/shell/ToolSlot.tsx`; it floats only on headerless screens and sets `html[data-demo-float]`, D-057). It opens a bottom sheet on phones and a non-modal drawer on the left from 600px, and never takes layout space. It is ordered Quick presets → Quick login → Advanced (collapsed). **Use demo account** on the login screens (five accounts) arrives only through the `LoginAssistSource` seam (`services.loginAssist`, null in production). Picking an account prepares its preset and fills the field; nothing is filled or submitted without a tap (D-058). The demo layer is loaded only when `NEXT_PUBLIC_DEMO_MODE === 'true'`, through inline env comparisons, so a demo-off build tree-shakes it (verified by `npm run check:demo`). Presets can be opened by URL: `/?preset=open|batch|timetable|es|principal|first_time|offline`. `window.__kskDemo` exposes the controller for E2E tests. See `docs/DEMO_GUIDE.md`.

## Testing expectations

- Put domain rules and config resolution under unit tests (`tests/unit`). Put service flows, including lock, offline sync, correction and staff rules, under integration tests against the mock container (`tests/integration`).
- E2E (`tests/e2e`) covers the 10 key flows, plus Home (`home.spec.ts`), Reports and Offline data (`reports.spec.ts`), wide-screen layout (`desktop.spec.ts`), "Use demo account" (`login-assist.spec.ts`), the real camera on Chromium's fake device (`camera.spec.ts`) and regressions found in review (`regressions.spec.ts`). The shared fixture fails a test on **any console error or React warning**, and runs on the demo's simulated camera.
- Before finishing a change, run `npm run check`. If the UI changed, also run `npm run e2e` and look at the screen at 320px, 360px and one desktop width (1280px).

## Deployment

The app is Vercel-ready and **prepare-only: do not deploy unless the user asks**. `npm run build` produces static pages and needs no secrets. `.env.production` sets `NEXT_PUBLIC_DEMO_MODE=true` for the stakeholder demo. Set it to `false` for a real rollout once the API repositories exist. `.env.example` documents the flag.

## Working agreements for this folder

- **Git is the owner's.** Do not commit or push unless asked.
- Do not deploy. Do not add secrets or credentials to client code.
- For small, reversible ambiguities, choose the safest option and record it in `docs/DECISIONS.md`. Ask before any change that would materially alter product behaviour.

## Skills and tools used to build this

- **Skills** (installed globally, not reinstalled): `workflow-authoring` for orchestrating reviews; the `impeccable`, `design-taste-frontend`, `huashu-design` and `web-design-guidelines` critique lenses (the prototype and DS stayed authoritative over them); `nextjs-best-practices` and `vercel-react-best-practices` as references.
- **Browser checks:** Playwright scripts (headless Chromium, Pixel 5 profile) for screenshots at every QA size (320×568 to 1920×1080), prototype-vs-app comparison sheets, axe-core accessibility scans, overflow probes, and Chromium's fake camera for the face flows. No browser MCP was needed.
- **Research and review workflows** (multi-agent): the DS grid and navigation specs, MediaPipe evaluation (size, API, telemetry, delegates, thresholds), the E2E dependency map, Next 16 headers and WebView camera/geolocation requirements; then a five-lens review (acceptance, phone visuals, wide visuals, code, camera honesty), each lens adversarially verified.
- **MCP:** a Vercel MCP connector was available but was **not used** (prepare-only). No other MCPs were used.
