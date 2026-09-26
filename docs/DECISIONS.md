# Decisions

Each entry records a choice that the PRD, prototype or brief left open, or where we deliberately departed from them. **Status** is either *owner* (decided with the product owner) or *assumed* (the safest reversible assumption, open to review). Code cites these IDs.

## Project and delivery

**D-001 · No git repository.** *Owner.* The folder is not a git repository and must not be initialised or committed by tooling. The docs carry continuity instead.

**D-002 · Vercel: prepare only.** *Owner.* The app is ready for Vercel (static build, no secrets, `.env.example`) but has not been deployed. Deploy only on request.

**D-003 · Brand assets come from `Doc/mh_ksk_logo.png`; the original is never modified.** *Assumed.* `scripts/generate-icons.mjs` crops the emblem and mark and erases the small wordmark fragment that intruded into the emblem crop. It writes `public/branding/*`, `src/app/icon.png`, `apple-icon.png` and `favicon.ico` (with a custom ICO encoder). The real emblem replaces the prototype's placeholder check-mark tile in the header and on login.

**D-004 · `Doc/swiftchat.png` is missing.** *Owner.* The brief referenced it, but it is not in `Doc/`. We proceeded without it: the SwiftChat DS markdown and the prototype provide everything visual. If it turns up, compare it against `docs/DESIGN_SYSTEM.md`.

**D-005 · Stack.** *Assumed.* Next.js 16.3.6 (App Router, Turbopack), React 19.2.8, TypeScript 5.9, ESLint 9, Vitest 5, Playwright 1.63 with axe-core. No UI, state, date, animation or schema libraries, which keeps the bundle small for low-end Android WebViews.

**D-006 · Client-first and static.** *Assumed.* Every route is a static shell and data work happens in the browser through services. IDs go in query strings (`?s=` session key). No Server Actions or route handlers in v1. The demo therefore runs offline and deploys as static files.

**D-007 · Layering with swappable repositories.** *Assumed.* UI → services → repository interfaces → mock implementation (now) or API implementation (later). ESLint enforces the boundaries. `src/repositories/api/*` are typed stubs that document their endpoints.

**D-008 · The demo layer is opt-in by build flag.** *Assumed.* `NEXT_PUBLIC_DEMO_MODE=true` bundles the demo panel, presets and simulations. With `false`, the code is compiled out (checked by `npm run check:demo`). `.env.development` and `.env.production` set it to `true` because this deployment is the stakeholder demo.

## Security-sensitive simulations

**D-009 · Face matching is simulated; the camera is real (superseded in part by D-048).** *Brief requirement.* Since the responsive update, registration and the daily check use the real front camera and a prototype on-device movement check (D-048). **Matching still never happens**: `MockFaceMatchService` returns the demo outcome, `FaceEnrolment.simulated` is the literal `true`, and no image is stored. Neither the copy nor the docs call any of it biometric security. A production build must replace the matcher and the movement check with a certified provider, plus consent and retention rules set by the state.

*Also simulated:* login has no password or OTP (`login.second_factor` supports only `none`, PRD open question 1). The server is a browser-side mock. Location is simulated unless the demo panel selects "Real GPS", which only measures distance to the mock institute. No credentials or secrets exist anywhere in the client.

## Design

**D-010 · AA contrast overrides.** *Assumed.* The DS values for `text-secondary` (#7383A5, 3.8:1), `text-tertiary` (#828996, 3.5:1) and `text-warning` (#9A6500, 4.47:1 on warning-subtle) fall below WCAG AA at the 11–12px sizes the app uses. Screens are also read outdoors. They become #5A6684, #5F6673 and #8A5A00; tertiary passes on white, the grey page and the row tints. Selection-card text uses the AA success colour instead of #00BA34 on #ECFFE5 (2.5:1).

On the grey app surface (#ECECEC), ghost buttons and links use `text-brand-subdued` #345CCC, because brand #386AF6 is 3.9:1 there. Filled destructive buttons use #C0392B, because white on the DS #EB5757 is 3.5:1. `tests/unit/design/contrast.test.ts` and the E2E axe scans guard all of this.

**D-014 · No dropdowns on the roster.** *Assumed; brief requirement.* When half day or leave is enabled, the prototype's status popover is replaced by a full-width row of one-tap pills under the name. Follow-ups (which half, leave type, until date) appear inline. It is still one tap per student, the choices are visible, and there is no popover to dismiss.

**D-021 · Pill colour symmetry.** *Assumed.* The selected Present pill gets a visible green border, because the prototype's border equalled its fill and looked unlike Absent. Unselected staff pills keep their semantic text colours, matching the roster; the prototype greyed them, which was inconsistent.

**D-037 · Every button label is 600.** *Prototype.* The DS markdown lists Label styles (500) for secondary and ghost buttons. The prototype, and the DS component bundle it was built from, render all variants at 600, so the app follows the prototype.

**D-038 · Present/Absent is one paired control.** *Prototype.* The two pills sit 4px apart and have no letter-spacing, as in the prototype. DS governance normally keeps 4px for optical nudges; here the pair reads as a single control and the name column gets its width back.

**D-031 · Roster rows follow the prototype's density.** *Assumed.* The father's name is one line with an ellipsis, so rows stay about 68px and a 30-student batch scans quickly. The full name appears on the review, record and correction screens.

**D-034 · The principal is greeted by role.** *Prototype.* "Good morning, Principal" (instructors see their first name). The overview reads "4 of 17 batches submitted", and the note names the shift that opens later ("9 Shift 2 batches open at 2:00 PM").

**D-035 · The brand name stays English in Marathi.** *Prototype.* The header reads "KSK Attendance" in both languages. Person, trade and institute names stay in Latin script (they are master data, not translated).

## Product rules

**D-011 · A principal marks students only while the window is open.** *Owner.* PRD §3 says a principal can mark "any batch". Here the principal can mark a batch that is **unsubmitted and whose window is open**. A closed, unsubmitted batch stays a visible gap ("Closed · not submitted"), because allowing it would amount to backdating (PRD §2.2). Config: `identity.principalCanMarkStudents`.

**D-012 · Marathi uses Latin digits.** *Owner.* Counts, dates and times show 0–9 in Marathi (locale `mr-IN-u-nu-latn`). Weekday and month names are Marathi. Config: `i18n.numerals: 'latin'` (`'locale'` restores Devanagari digits).

**D-013 · Employability Skills is a separate record per batch.** *Owner.* A subject instructor (ES) marks their own session for each batch. The session key carries the subject (`ele-s1u1.2026-09-25.daily.es`). This record does not lock or replace the trade instructor's daily record. The batch's reports use its own records; subject sessions are reported under the subject.

**D-015 · Location step behaviour.** *Assumed.* Geo-tagging (`tagging`) captures location silently. The user sees a location screen only if permission or GPS fails. Geo-fencing (`fencing`) is a visible gate with the distance shown when outside. The sequence fails fast: location first, then face. We show the first failure rather than the PRD §8.4 combined outcome, because one clear next step suits the users better. `verification.fencePassPrompt: 'confirm'` adds a "You're at {institute}" confirmation.

**D-016 · Hard time fence, no grace period.** *PRD §11.4.* A window is open while start ≤ now < end. The prototype's "closed at 8:15 AM" for an 8:00 period implied grace; the app says "closed at 8:00 AM".

**D-020 · Staff marks: the first mark wins.** *Assumed.* There is one record per person per day across self and principal marking. If the principal saves a batch of staff marks while someone self-marked in the meantime, that row is skipped and reported (`{ saved, skipped }`). Self-marked rows are locked in the principal's list.

**D-019 · Who appears in the staff list.** *Assumed.* All teaching staff (instructors, group instructors) and the principal, shown as "(you)". Office staff are excluded until the state asks for non-teaching attendance.

**D-022 · Eligibility threshold 75%.** *Assumed.* The PRD names no value. Students below `reports.eligibilityThresholdPct` (default 75) are flagged in the student percentage report. Half day counts as 0.5 and OJT as present.

**D-023 · PDF is the browser print view.** *Assumed.* "Print / Save as PDF" opens a print-styled view (`reports.pdfDownload`). Server-generated PDFs are a production concern, and SwiftChat's WebView may not support `window.print`. The demo shows an honest toast when printing is unavailable.

**D-024 · Options implemented as a single value.** *Assumed.* `login.second_factor` accepts only `'none'` and `staff.capture_trigger` only `'explicit_tap'` (the PRD's recommended default). `offline.eod_trigger_time` is informational, because end-of-day jobs are server-side.

**D-028 · Verification scope: once per session per day.** *Assumed.* A pass is stored per (user, session key, today), so reopening the same class later that day doesn't re-verify. Self-attendance has its own pass. A configuration change in the demo clears all passes.

**D-029 · The `batch` mapping model.** *PRD extension.* `mapping.model: 'batch'` is an explicit per-instructor batch allow-list: PRD §7.3's hard mapping without a timetable. It powers "Batch mapped" and Employability Skills.

**D-032 · The Submitted screen reflects the real sync state.** *Assumed.* It reads "Attendance submitted" once the record is locked and while it is being sent (the banner shows the send). When the record cannot be sent (offline, a failed attempt, or sync paused), it reads "Saved on this phone" with the reason.

**D-039 · Correction reasons are stored as codes.** *Assumed.* A quick reason (late, marked by mistake, on institute duty) is stored as `reasonCode` beside the text, so the audit log and printed register show it in the reader's language. Typed reasons are stored and shown as typed.

**D-040 · Face screens say what is real and what is simulated.** *Brief requirement.* With the device camera: "Prototype · photos are not saved · face matching is simulated" on the registration intro (long form), each capture step and the daily face step. With the demo's simulated camera: "Demo simulation · no camera or photo is used". `FaceMatchService.simulated` and `FaceCaptureService.source()` drive the labels, so a real provider removes them automatically.

**D-041 · The roster warns before the window closes.** *Assumed.* A daily roster under a time fence shows "Closes at 2:00 PM" in its meta line. In the last 10 minutes, the roster and review screens show "Attendance closes at … Submit now". This matters because a closed, unsubmitted batch can't be recovered (D-011).

**D-042 · Offline cards say what needs internet.** *Assumed.* While offline, open batches whose roster isn't on the phone show "Needs internet" instead of "Mark attendance". If a state disables offline marking (`offline.enabled: false`), opening any batch offline says "You're offline".

**D-043 · Staff saves protect the principal's work.** *Assumed.* The save sheet names who will be marked Absent (the save can't be undone today). A failed save keeps every choice. Rows that were self-marked in the meantime are reported ("3 saved · 1 already marked themselves"). Switching to Students with unsaved choices asks before discarding them.

**D-044 · Known accessibility follow-ups (not done in v1).** *Open.*
- Roster status pills are toggle buttons (`aria-pressed`) inside a labelled group, not a `radiogroup`. It works with TalkBack, but "only one can be chosen" isn't announced.
- On very short screens or at 200% text, the fixed summary and footer leave little room for the list. Everything stays reachable, but the list scrolls in a small window.
- Component sizes (36px controls, 52px input, 40px avatar) are literal values rather than tokens.

**D-033 · Sync also runs when the app opens.** *PRD extension.* Besides reconnect, "Sync now" and opening a batch (PRD §20.5), records left in the queue by an earlier visit are sent as soon as the app starts online.

## Responsive layout and navigation

**D-045 · Mobile-first, not a fixed mobile viewport.** *Owner (UX update brief).*
- Phones keep the approved 320–412px design. From the DS medium breakpoint (600px) the app fills the viewport: full-width header and bars, with content in a readable column. The columns are form 480, reading 800 (the roster stays a row list, never a table) and wide 1008, inside DS margins of 16, 36 and 64px.
- Single-question screens become a centred card. Problem and confirmation screens inside the app keep the header, with their action directly under the message (`inlineFooter`). Primary actions are 280px and centred from 600px (DS standalone button). Two-column grids use the DS gutter (20 / 36 / 36px).
- `main` is the only scroller, and none of its children may shrink. A flex item with `overflow: hidden` used to get squeezed and clip its own rows: long absent lists on Review and report tables couldn't be scrolled to the end. That was a defect in the earlier build too, now fixed and covered by `regressions.spec.ts`.
- Grids have two columns at most, where both halves stay easy to read. The DS allows 4-up cards on desktop; the brief forbids dense grids.
- *Alternatives:* a centred phone column (the old behaviour, rejected by the brief), or full 12-column layouts (too dense for instructors).

**D-046 · Profile lives in the header avatar; one AppHeader; three destinations for everyone.** *Owner (UX update brief); the principal tab set is assumed.*
- Profile is removed from every navigation. The avatar at the top right of every signed-in screen opens the profile menu, the single entry point: a bottom sheet on phones, an anchored menu on wider screens. It holds identity, language, face registration, offline data, help and logout.
- The old Profile page's designation, employment type and access rows were dropped to keep the menu short. `/profile` redirects to `/home`; Offline data keeps its routes.
- Immersive single-task steps (camera, permission primers, results) keep no chrome, as in the prototype.
- **Principal navigation stays Home · Attendance · Reports**, with the existing Students / Staff switch inside Attendance. The brief's four tabs would need "Student attendance" and "Staff attendance", which don't fit 80px tabs at 320px in either language; shortened to "Students" and "Staff" they lose meaning. Keeping the same three destinations for every role is also simpler. The principal home still has direct actions for both.
- From 600px the destinations move into the header as a compact row. There is never a sidebar or rail: the brief rules them out, although the DS column table allows one.

## Demo

**D-017 · Frozen demo clock.** *Assumed.* The demo clock starts fixed at **10:15 IST today**, so every demo tells the same story: Shift 1 is open, Period 3 is "Now" and Shift 2 opens at 2:00 PM. The panel offers 7:30, 10:15, 11:30, 2:30 PM and "Real". With the demo off, the system clock is used.

**D-018 · The story is relative to today.** *Assumed.* The seed builds today's submissions, yesterday's correction and 45 days of deterministic history from the current date. The mock DB reseeds when the calendar day changes, so "today" in the demo always means today. Reset Demo wipes all three storage namespaces and reloads.

**D-036 · The demo trigger reserves header space on phones only.** *Assumed.* Below 600px, headers leave 84px on the right (`--demo-reserve-inline`) and headerless screens 40px at the top, so the floating **Demo** trigger never covers the avatar, a title or a banner. Below 360px it is icon-only and the reserve drops to 48px. From 600px the trigger sits bottom right outside the content column and nothing is reserved (D-047). The reserve is 0 when the demo is off.

**D-047 · Demo controls float on every size; presenters log in with one tap per step.** *Owner (UX update brief).*
- A collapsed **Demo** trigger on every screen: top right on phones (D-036), bottom right from 600px. There, scrollers get 72px of extra bottom room in demo builds (`--demo-reserve-block-end`), so the last row can always scroll clear of it.
- Phones open a modal bottom sheet (≤ 90% height). From 600px it is a 380px **non-modal** drawer on the right. It starts below the app header, so the avatar and navigation stay usable, and it overlays the app without reflowing it, so the presenter can keep using the app.
- Esc closes it (unless a sheet or menu is open on top), and every way of closing returns focus to the trigger. The panel's content mounts only while open, so nothing of it is in the page (or read by a screen reader) while collapsed. The permanent desktop sidebar is gone.
- In Advanced, location is two controls: **Location source** (Simulated / This device), and the simulated outcome only while simulating. Segmented controls can never overflow their row.
- Order: **Quick presets** (most prominent), **Quick login** (every persona), then **Advanced** (collapsed: all configuration and simulation controls, plus "Skip login screens").
- **Autofill:** the product defines a `LoginAssistSource` seam; only the demo supplies one. The login steps show a dashed "Use demo login · <person>" button that fills that one field on a tap and returns focus to it, so Enter continues. It never fills without a tap, never submits, and never skips a confirmation. Credentials come from `src/demo/personas.ts` and follow the last-picked persona. *Alternatives:* prefilled query strings (`?code=`, `?tid=` still work) or a credentials card on the login page (rejected by the brief).
- Presets keep the presenter's **camera choice** and speed: those describe the machine, not the story.

**D-048 · Real camera, prototype movement check, simulated matching.** *Owner (UX update brief).*
- Three seams: `FaceCaptureService` (`CameraFaceCaptureService`: getUserMedia, front camera), `LivenessService` (`BasicClientLivenessService`: MediaPipe BlazeFace on the device) and `FaceMatchService` (`MockFaceMatchService`).
- Registration takes three real frames (straight, left, right) as in-memory JPEGs; the daily check takes one. Nothing image-like is persisted or sent.
- Thresholds were measured on BlazeFace: yaw ratio ≤ 0.10 is straight, ≥ 0.18 (about 16°) is a "slight" turn, and there is a return to centre between turns. Reaching the other side counts as passing centre, because slow phones skip frames. The first measured threshold (0.22) proved too strict through a real video pipeline.
- Feedback order: "Face detected", then "Hold still" (8 steady frames), then "Good". A turn so far that the eyes crowd together asks "Turn back a little". Guidance changes only after holding for 2 frames, so it doesn't flicker at a threshold.
- Framing is judged against what the person sees: a landscape webcam shown in the portrait oval is checked inside the visible crop.
- The mirroring convention was verified: unmirrored frames, where a positive ratio means a turn to the person's own left. A steady opposite turn for 1.5 s at the first turn is accepted as a mirrored camera, so no one gets stuck.
- Fallback: timed guided captures when detection can't start (no WebGL, assets missing, more than 12 s) or fails mid-way. **After two failed movement checks on a screen, the next attempt takes the photos on a countdown**, so nobody is stuck. On the daily check, failed checks also count towards `faceRetryLimit`.
- Timeouts end in the dominant reason, each with its own screen: too dark, several faces, face not seen, wrong distance, not inside the oval, or head turn not seen. A preview that never starts, or a camera taken by another app mid-check, is "The camera didn't start", not a face problem.
- Blink detection is omitted: BlazeFace has no eyelid data, and FaceLandmarker would add about 3.5 MB and 3× the per-frame cost on low-end phones.
- A WebView that refuses to play the preview without a gesture shows **"Tap to start the camera"**. A detector that arrives after the start-up limit is closed at once. A photo that finishes encoding after the screen closed is dropped.
- A Permissions API "denied" (camera or location) is only a hint: the app still tries, and the real refusal shows "Camera access is blocked" / "Location access is off". After one successful open, the camera primer isn't shown again in the app session.
- **Known limitation (left open):** someone who mixes up left and right, turning right when asked to turn left and holding it for 1.5 s, is treated as having a mirrored camera and is then asked to turn the other way. The check still completes, but the second and third photos are stored in each other's slot (the "left" photo is actually the right turn). Nothing uses the photos while matching is simulated. A real matcher should label each photo by the direction actually seen rather than by the step.
- **Not production liveness:** a photo or video held to the camera can pass. Matching is simulated.
- *Alternatives:* FaceLandmarker for blink and yaw (heavier), the Shape Detection API (not available by default on Android), or keeping the simulation only (rejected: the brief requires the real camera).

**D-049 · MediaPipe Tasks Vision pinned to 0.10.35, served from this origin.** *Assumed.* Versions 1.0.x post usage metrics to `odml.pa.googleapis.com` with no opt-out. 0.10.35 has the same API and outputs, and makes no external request (verified).
- The wasm runtime is copied from `node_modules` into `public/vendor/mediapipe/0.10.35/` before dev and build (`scripts/vendor-mediapipe.mjs`, which refuses any other installed version). The model is committed in `public/models/`. Both are cached immutably.
- The CPU delegate is used. The runtime's console output is silenced (it prints TensorFlow Lite notices through `console.error`).
- Cost: about 3.5 MB gzipped, downloaded only when a face screen first opens, then cached. A CSP, if added, must allow `'wasm-unsafe-eval'`.

**D-050 · Location results say whether they are real.** *Brief requirement.* `DevicePosition.source` and `CapturedLocation.source` are `'device'` or `'simulated'`, stored with the pass for audit and never shown to instructors.

**D-051 · Unsaved staff marks guard every way out.** *Assumed.* The principal's staff screen already hid the bottom nav while marks were unsaved. From 600px the header navigation is always visible, so `ScreenLayout.guardNavigation` routes header nav, bottom nav and the profile menu (Offline data, face registration, Logout) through the same "Discard n changes?" sheet as the Students/Staff switch. The roster likewise saves its draft when left within the 300 ms debounce.

## Localisation

**D-027 · Marathi needs native review.** *Open.* `src/i18n/messages/mr.ts` is complete and typed against English (a missing key falls back to English and never renders blank). A native Marathi speaker from the department should review it before rollout, especially the terms हजेरी, बॅच, ट्रेड, सबमिट and the correction reasons.
