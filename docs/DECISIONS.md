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

**D-009 · Face verification and enrolment are simulated.** *Brief requirement.* No camera stream is opened, no image is captured or stored, and no matching happens. A demo switch decides the outcome. `FaceEnrolment.simulated` is the literal `true`. The UI says "Demo simulation · no photo is taken", and neither the copy nor the docs call it biometric security. A production build must implement `FaceVerificationService` with a real liveness and matching provider, plus consent and retention rules set by the state.

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

**D-040 · Face screens say they are simulated.** *Brief requirement.* "Demo simulation · no photo is taken" appears on the enrolment intro, on each capture step and on the daily face step. `FaceVerificationService.simulated` drives the label, so a real provider removes it automatically.

**D-041 · The roster warns before the window closes.** *Assumed.* A daily roster under a time fence shows "Closes at 2:00 PM" in its meta line. In the last 10 minutes, the roster and review screens show "Attendance closes at … Submit now". This matters because a closed, unsubmitted batch can't be recovered (D-011).

**D-042 · Offline cards say what needs internet.** *Assumed.* While offline, open batches whose roster isn't on the phone show "Needs internet" instead of "Mark attendance". If a state disables offline marking (`offline.enabled: false`), opening any batch offline says "You're offline".

**D-043 · Staff saves protect the principal's work.** *Assumed.* The save sheet names who will be marked Absent (the save can't be undone today). A failed save keeps every choice. Rows that were self-marked in the meantime are reported ("3 saved · 1 already marked themselves"). Switching to Students with unsaved choices asks before discarding them.

**D-044 · Known accessibility follow-ups (not done in v1).** *Open.*
- Roster status pills are toggle buttons (`aria-pressed`) inside a labelled group, not a `radiogroup`. It works with TalkBack, but "only one can be chosen" isn't announced.
- On very short screens or at 200% text, the fixed summary and footer leave little room for the list. Everything stays reachable, but the list scrolls in a small window.
- Component sizes (36px controls, 52px input, 40px avatar) are literal values rather than tokens.

**D-033 · Sync also runs when the app opens.** *PRD extension.* Besides reconnect, "Sync now" and opening a batch (PRD §20.5), records left in the queue by an earlier visit are sent as soon as the app starts online.

## Demo

**D-017 · Frozen demo clock.** *Assumed.* The demo clock starts fixed at **10:15 IST today**, so every demo tells the same story: Shift 1 is open, Period 3 is "Now" and Shift 2 opens at 2:00 PM. The panel offers 7:30, 10:15, 11:30, 2:30 PM and "Real". With the demo off, the system clock is used.

**D-018 · The story is relative to today.** *Assumed.* The seed builds today's submissions, yesterday's correction and 45 days of deterministic history from the current date. The mock DB reseeds when the calendar day changes, so "today" in the demo always means today. Reset Demo wipes all three storage namespaces and reloads.

**D-036 · The demo pill reserves header space.** *Assumed.* On phones and tablets, headers leave 84px on the right (`--demo-reserve-inline`) and headerless screens 40px at the top, so the floating DEMO pill never covers the avatar, a title or a banner. Below 360px the pill is icon-only and the reserve drops to 48px. The reserve is 0 when the demo is off.

## Localisation

**D-027 · Marathi needs native review.** *Open.* `src/i18n/messages/mr.ts` is complete and typed against English (a missing key falls back to English and never renders blank). A native Marathi speaker from the department should review it before rollout, especially the terms हजेरी, बॅच, ट्रेड, सबमिट and the correction reasons.
