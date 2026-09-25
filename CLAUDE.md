@AGENTS.md

# KSK Attendance MiniApp (Maharashtra)

A mobile-first attendance MiniApp for **ITI craft instructors and principals in Maharashtra**, opened inside the **SwiftChat Android WebView**. Instructors mark student attendance once per batch (or per half-day / period, by configuration). Principals see the whole institute, mark staff, and correct same-day mistakes with a reason and an audit trail. This build runs entirely on **mock data** behind repository interfaces, with a floating **demo panel** for stakeholder demos. Real APIs plug in later without UI changes.

## Sources of truth (in this order)

1. `Doc/PRD.pdf`: product rules, configuration registry, invariants.
2. `prototype/Prototype.html`: the approved clickable prototype. It is authoritative for layout, copy and flow.
3. `Doc/swiftchat-design-system.md`: SwiftChat DS. It is authoritative for tokens and components. Use light mode only.
4. `Doc/mh_ksk_logo.png`: the brand logo. **Never modify the original.** Derived icons come from `npm run icons`.

`Doc/swiftchat.png` was referenced by the brief but is missing (see `docs/DECISIONS.md` D-004).

Deeper docs are in `docs/`: PRODUCT_CONTEXT, ARCHITECTURE, DESIGN_SYSTEM, CONFIGURATION, DATA_MODEL, DEMO_GUIDE, TESTING, DECISIONS.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000 (demo mode via .env.development)
npm run lint         # ESLint 9 flat config, including the architecture boundaries below
npm run typecheck    # tsc --noEmit
npm test             # Vitest: unit + integration (tests/unit, tests/integration)
npm run e2e          # Playwright: builds, serves on :3200, Pixel 5 at 360px, Asia/Kolkata
npm run build        # production build (all routes static)
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

## Mock data and simulation

- `src/data/mock/*` holds deterministic master data (Govt ITI Pune, code **27410**: 5 trades, 17 batches, 417 students; a second institute in Nashik), plus 45 days of generated history. `seeds.ts` builds today's story relative to the current date.
- The mock DB (`src/repositories/mock/database.ts`) lives in localStorage namespace `ksk:v1`. It **reseeds automatically when the calendar day changes** and on schema bumps.
- Location, face, permissions, network, sync failure and speed come from a `SimulationSource`. Face verification and enrolment are **simulation only**: no camera stream, no image, no biometric match. Never describe them as secure biometrics in UI or docs.
- `src/repositories/api/*` are typed stubs that throw `NotImplementedError` and document the endpoints each method will call.

## Configuration

`AppConfiguration` (`src/config/types.ts`) is resolved in layers: product defaults → Maharashtra state floor (`src/config/states/maharashtra.ts`) → district/institute layers (only keys the state lists in `overridableKeys`) → demo overrides (persona patch, then demo-panel changes; demo builds only). `validate.ts` rejects invalid combinations. Every option and its user-visible effect is described in `docs/CONFIGURATION.md`.

## Demo layer

`src/demo/*` holds the demo state (`ksk-demo:v1`), the demo clock (fixed 10:15 IST by default), the simulation source, personas, 7 presets and the floating panel. It is loaded only when `NEXT_PUBLIC_DEMO_MODE === 'true'`, through inline env comparisons, so a demo-off build tree-shakes it (verified by `npm run check:demo`). Presets can be opened by URL: `/?preset=open|batch|timetable|es|principal|first_time|offline`. `window.__kskDemo` exposes the controller for E2E tests. See `docs/DEMO_GUIDE.md`.

## Testing expectations

- Put domain rules and config resolution under unit tests (`tests/unit`). Put service flows, including lock, offline sync, correction and staff rules, under integration tests against the mock container (`tests/integration`).
- E2E (`tests/e2e`) covers the 10 key flows. The shared fixture fails a test on **any console error or React warning**.
- Before finishing a change, run `npm run check`. If the UI changed, also run `npm run e2e` and look at the screen at 320px and 360px.

## Deployment

The app is Vercel-ready and **prepare-only: do not deploy unless the user asks**. `npm run build` produces static pages and needs no secrets. `.env.production` sets `NEXT_PUBLIC_DEMO_MODE=true` for the stakeholder demo. Set it to `false` for a real rollout once the API repositories exist. `.env.example` documents the flag.

## Working agreements for this folder

- **No git.** The owner chose not to initialise a repository here. Do not run `git init` or commit.
- Do not deploy. Do not add secrets or credentials to client code.
- For small, reversible ambiguities, choose the safest option and record it in `docs/DECISIONS.md`. Ask before any change that would materially alter product behaviour.

## Skills and tools used to build this

- **Skills** (installed globally, not reinstalled): `workflow-authoring` for orchestrating reviews; the `impeccable`, `design-taste-frontend`, `huashu-design` and `web-design-guidelines` critique lenses (the prototype and DS stayed authoritative over them); `nextjs-best-practices` and `vercel-react-best-practices` as references.
- **Browser checks:** Playwright scripts (headless Chromium, Pixel 5 profile) for screenshots, prototype-vs-app comparison sheets, axe-core accessibility scans and overflow probes. No browser MCP was needed.
- **MCP:** a Vercel MCP connector was available but was **not used** (prepare-only). No other MCPs were used.
