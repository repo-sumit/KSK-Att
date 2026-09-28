# Decisions

Each entry records a choice that the PRD, prototype or brief left open, or where we deliberately departed from them. **Status** is either *owner* (decided with the product owner) or *assumed* (the safest reversible assumption, open to review). Code cites these IDs.

## Project and delivery

**D-001 · Git belongs to the owner.** *Owner.* The owner has initialised a repository and makes the commits. Tooling does not commit or push unless asked.

**D-002 · Vercel: prepare only.** *Owner.* The app is ready for Vercel (static build, no secrets, `.env.example`) but has not been deployed. Deploy only on request.

**D-003 · Brand assets come from `Doc/mh_ksk_logo.png`; the original is never modified.** *Assumed.* `scripts/generate-icons.mjs` crops the emblem and mark and erases the small wordmark fragment that intruded into the emblem crop. It writes `public/branding/*`, `src/app/icon.png`, `apple-icon.png` and `favicon.ico` (with a custom ICO encoder). The real emblem replaces the prototype's placeholder check-mark tile in the header and on login.

**D-004 · `Doc/swiftchat.png` is missing.** *Owner.* The brief referenced it, but it is not in `Doc/`. We proceeded without it: the SwiftChat DS markdown and the prototype provide everything visual. If it turns up, compare it against `docs/DESIGN_SYSTEM.md`.

**D-005 · Stack.** *Assumed.* Next.js 16.3.6 (App Router, Turbopack), React 19.2.8, TypeScript 5.9, ESLint 9, Vitest 5, Playwright 1.63 with axe-core. No UI, state, date, animation or schema libraries, which keeps the bundle small for low-end Android WebViews.

**D-006 · Client-first and static.** *Assumed.* Every route is a static shell and data work happens in the browser through services. IDs go in query strings (`?s=` session key). No Server Actions or route handlers in v1. The demo therefore runs offline and deploys as static files.

**D-007 · Layering with swappable repositories.** *Assumed.* UI → services → repository interfaces → mock implementation (now) or API implementation (later). ESLint enforces the boundaries. `src/repositories/api/*` are typed stubs that document their endpoints.

**D-008 · The demo layer is on by default and off by build flag.** *Assumed; revised by D-067.* `NEXT_PUBLIC_DEMO_MODE` bundles the demo panel, presets and simulations unless a build sets it to `false`, when the code is compiled out (checked by `npm run check:demo`). The default lives in `next.config.ts` (`env`), because this deployment is the stakeholder demo and a Vercel build from git has no `.env` file (D-067).

## Security-sensitive simulations

**D-009 · Face matching is simulated; the camera is real (superseded in part by D-048).** *Brief requirement.* Since the responsive update, registration and the daily check use the real front camera and a prototype on-device movement check (D-048). **Matching still never happens**: `MockFaceMatchService` returns the demo outcome, `FaceEnrolment.simulated` is the literal `true`, and no image is stored. Neither the copy nor the docs call any of it biometric security. A production build must replace the matcher and the movement check with a certified provider, plus consent and retention rules set by the state.

*Also simulated:* login has no password or OTP (`login.second_factor` supports only `none`, PRD open question 1). The server is a browser-side mock. Location is simulated unless the demo panel selects "Real GPS", which only measures distance to the mock institute. No credentials or secrets exist anywhere in the client.

## Design

**D-010 · AA contrast overrides.** *Assumed.* The DS values for `text-secondary` (#7383A5, 3.8:1), `text-tertiary` (#828996, 3.5:1) and `text-warning` (#9A6500, 4.47:1 on warning-subtle) fall below WCAG AA at the 11–12px sizes the app uses. Screens are also read outdoors. They become #5A6684, #5F6673 and #8A5A00; tertiary passes on white, the grey page and the row tints. Selection-card text uses the AA success colour instead of #00BA34 on #ECFFE5 (2.5:1).

On the grey app surface (#ECECEC), ghost buttons and links use `text-brand-subdued` #345CCC, because brand #386AF6 is 3.9:1 there. Filled destructive buttons use #C0392B, because white on the DS #EB5757 is 3.5:1. `tests/unit/design/contrast.test.ts` and the E2E axe scans guard all of this.

**D-014 · No dropdowns on the roster.** *Superseded by D-062 (owner).* The roster used one-tap pills: Present/Absent beside the name and, with half day or leave on, a full-width row of pills under it. The owner replaced them with one status select per student, so the row stays compact whatever a state enables. The inline follow-ups (which half, leave type, until date) are kept.

**D-062 · One status control per person: the phone's own picker.** *Owner (UX update brief, round 2); the presentation was chosen by the owner.*
- `AttendanceStatusSelect` (`src/components/ui/AttendanceStatusSelect.tsx`) replaces the pill group on every roster row that marks attendance: students (`StudentRow`) and staff (`StaffScreen`, principal marking). `StatusPill` is deleted.
- **What it is:** a native `<select>` drawn as a status pill: status icon, label, chevron, and the status colour in its text and border. It is a fixed width (9.5em, so it grows with the phone's text size), right-aligned, so every row's control reads down one column. On a phone it opens the phone's own list; on a desktop, the browser's menu under the control. *Why native:* the owner picked it over a custom sheet or menu, because it is familiar, large, accessible (name "Attendance for {name}") and behaves the same in every WebView.
- **Options come only from configuration** (`journey.marking.selectable`): Present + Absent in Maharashtra; with every status on, Present, Absent, Half day and Leave. OJT is never a hand-picked option (`instructorSelectable: false`).
- **Locked values** (`LockedStatus`): OJT declared in the ERP, and staff marks already saved (self-verified or by the principal). They are the same pill, filled with the tone and with a lock instead of the chevron, and they are not a control. The reason ("set by the ERP, can't be changed here") is spoken, and the row says it visibly.
- **States:** the roster's starting status is drawn calm (grey border) so the changes stand out; others carry their tone border, on a row tinted as before. Blank start: a "Choose" placeholder. After Review is pressed with gaps, a warning edge appears, `aria-invalid` is set, and focus moves to the first unmarked control.
- **Follow-ups stay under the row:** which half (when `halfDayHalves`), leave type and until date. The correction screen keeps its single-question radio cards: it is one question on its own screen, not a row list.
- *PRD §9.1:* one-tap marking. This is now two taps for a change from the default (open, pick). The owner accepted that for a compact row that scales to any status set.


**D-021 · Pill colour symmetry.** *Superseded by D-062.* *Assumed.* The selected Present pill gets a visible green border, because the prototype's border equalled its fill and looked unlike Absent. Unselected staff pills keep their semantic text colours, matching the roster; the prototype greyed them, which was inconsistent.

**D-037 · Every button label is 600.** *Prototype.* The DS markdown lists Label styles (500) for secondary and ghost buttons. The prototype, and the DS component bundle it was built from, render all variants at 600, so the app follows the prototype.

**D-038 · Present/Absent is one paired control.** *Superseded by D-062.* *Prototype.* The two pills sit 4px apart and have no letter-spacing, as in the prototype. DS governance normally keeps 4px for optical nudges; here the pair reads as a single control and the name column gets its width back.

**D-031 · Roster rows follow the prototype's density.** *Assumed.* The father's name is one line with an ellipsis, so rows stay about 68px and a 30-student batch scans quickly. The full name appears on the review, record and correction screens.

**D-034 · The principal is greeted by role.** *Prototype.* "Good morning, Principal" (instructors see their first name). The overview reads "4 of 17 batches submitted", and the note names the shift that opens later ("9 Shift 2 batches open at 2:00 PM").

**D-035 · The brand name stays English in Marathi.** *Prototype.* The header reads "KSK Attendance" in both languages. Person, trade and institute names stay in Latin script (they are master data, not translated).

**D-059 · Loading states are realistic.** *Assumed.*
- The mock services wait a simulated network time (`simulatedDelay`, scaled by the demo speed; 0 in unit and integration tests, 5% in E2E). Reports take 250–350 ms per section, refreshing one batch 900 ms, refreshing all 1200 ms, a download 600 ms + 200 ms per batch, a submit 500 ms and each login lookup 450 ms.
- Each wait says what is happening: "Checking institute…", "Checking Trainer ID…", "Signing in…", "Refreshing student data…", "Submitting attendance…", "Syncing attendance…", "Preparing camera…", "Downloading student data…".
- Lists load as `Skeleton variant="rows"` (placeholders shaped like the rows to come) on the roster, record, review, staff, reports and offline data screens. Each login step prefetches the next route, so moving on never shows an empty screen.
- *Why:* instant mocks hid the states a real network will show, and a named wait reads better than a bare spinner.
- *PRD:* silent.

**D-060 · Motion marks a change, never decorates.** *Assumed.*
- **Keyframes live in the CSS module that uses them.** CSS Modules (Turbopack's lightningcss) scope animation names per file, so a keyframe defined in `globals.css` never matched a module's `animation:` (in review, nothing moved, including the older spinners and skeleton shimmer). `globals.css` keeps only the reduced-motion rule. `tests/e2e/regressions.spec.ts` checks that animations run and that a panel's animation name resolves to a real keyframes rule.
- New keyframes at `--motion-base` (200 ms):
  - `ksk-reveal`: a `Disclosure` panel grows open;
  - `ksk-fade-in`: a status text that just changed ("Updated just now") and the toast settle in;
  - `ksk-pop`: the result screen's icon (`IconWell settle`).
- The refresh icon spins (`ksk-spin`) while a refresh runs. The login account list grows open with a `grid-template-rows` transition.
- The existing `prefers-reduced-motion` rule collapses every animation and transition to its end state.
- *Why:* people should notice that something changed, with no bounce and no confetti. This stays within the DS's 80–200 ms.
- *PRD:* silent.

## Product rules

**D-011 · A principal marks students only while the window is open.** *Owner.* PRD §3 says a principal can mark "any batch". Here the principal can mark a batch that is **unsubmitted and whose window is open**. A closed, unsubmitted batch stays a visible gap ("Closed · not submitted"), because allowing it would amount to backdating (PRD §2.2). Config: `identity.principalCanMarkStudents`.

**D-012 · Marathi uses Latin digits.** *Owner.* Counts, dates and times show 0–9 in Marathi (locale `mr-IN-u-nu-latn`). Weekday and month names are Marathi. Config: `i18n.numerals: 'latin'` (`'locale'` restores Devanagari digits).

**D-013 · Employability Skills is a separate record per batch.** *Owner.* A subject instructor (ES) marks their own session for each batch. The session key carries the subject (`ele-s1u1.2026-09-25.daily.es`). This record does not lock or replace the trade instructor's daily record. The batch's reports use its own records; subject sessions are reported under the subject.

**D-015 · Location step behaviour.** *Assumed.* Geo-tagging (`tagging`) captures location silently. The user sees a location screen only if permission or GPS fails. Geo-fencing (`fencing`) is a visible gate with the distance shown when outside. The sequence fails fast: location first, then face. We show the first failure rather than the PRD §8.4 combined outcome, because one clear next step suits the users better. `verification.fencePassPrompt: 'confirm'` adds a "You're at {institute}" confirmation.

**D-016 · Hard time fence, no grace period.** *PRD §11.4.* A window is open while start ≤ now < end. The prototype's "closed at 8:15 AM" for an 8:00 period implied grace; the app says "closed at 8:00 AM".

**D-020 · Staff marks: the first mark wins.** *Assumed.* There is one record per person per day across self and principal marking. If the principal saves a batch of staff marks while someone self-marked in the meantime, that row is skipped and reported (`{ saved, skipped }`). Self-marked rows are locked in the principal's list.

**D-019 · Who appears in the staff list.** *Assumed.* All teaching staff (instructors, group instructors) and the principal, shown as "(you)". Office staff are excluded until the state asks for non-teaching attendance.

**D-022 · The at-risk benchmark: 75%, configurable.** *Assumed.* PRD §19.2 names the percentage exam eligibility turns on, but no threshold. `reports.eligibilityThresholdPct` (default 75; `validate.ts` accepts 1–100) is the at-risk benchmark (D-053). Students below it (with at least `reports.atRiskMinDays` marked days, on the unrounded figure) are listed under At-risk students and flagged "At risk" in a batch's leaderboard. A batch average below it shows amber, with "below 75%" spoken for screen readers; the per-batch count lives only under At-risk students. `ReportService.atRisk` also accepts an explicit `threshold`. Half day counts as 0.5 and OJT as present.

**D-023 · PDF is the browser print view, on detail reports only.** *Assumed.* "Print / Save as PDF" (`reports.pdfDownload`) appears only on the two detail reports at `/reports/view` (Staff attendance and Correction log), which keep the range switch. The Reports page itself is an on-screen overview of this month (D-053). The print view carries the institute, the range, the generation time and a principal's signature line. Server-generated PDFs are a production concern, and SwiftChat's WebView may not support `window.print`. When printing is unavailable, the app shows an honest toast.

**D-024 · Options implemented as a single value.** *Assumed.* `login.second_factor` accepts only `'none'` and `staff.capture_trigger` only `'explicit_tap'` (the PRD's recommended default). `offline.eod_trigger_time` is informational, because end-of-day jobs are server-side.

**D-028 · Verification scope: once per session per day.** *Assumed.* A pass is stored per (user, session key, today), so reopening the same class later that day doesn't re-verify. Self-attendance has its own pass. A configuration change in the demo clears all passes.

**D-029 · The `batch` mapping model.** *PRD extension.* `mapping.model: 'batch'` is an explicit per-instructor batch allow-list: PRD §7.3's hard mapping without a timetable. It powers "Batch mapped" and Employability Skills.

**D-032 · The Submitted screen reflects the real sync state.** *Assumed.* It reads "Attendance submitted" once the record is locked and while it is being sent (the banner shows the send). When the record cannot be sent (offline, a failed attempt, or sync paused), it reads "Saved on this phone" with the reason.

**D-039 · Correction reasons are stored as codes.** *Assumed.* A quick reason (late, marked by mistake, on institute duty) is stored as `reasonCode` beside the text, so the correction screens and the Correction log (on screen and printed) show it in the reader's language. Typed reasons are stored and shown as typed.

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

**D-046 · Profile lives in the header avatar; one AppHeader.** *Owner (UX update brief); the principal tab set is assumed.*
- Profile is removed from every navigation. The avatar at the top right of every signed-in screen opens the profile menu, the single entry point: a bottom sheet on phones, an anchored menu on wider screens. It holds identity, language, face registration, help and logout.
- The old Profile page's designation, employment type and access rows were dropped to keep the menu short. `/profile` redirects to `/home`. Offline data moved under Reports (D-056).
- Signed-in result, problem and permission screens and every face-registration step keep the app header (`AppHeader plain`: brand, avatar, navigation; the screen keeps its own heading), so the avatar really is on every signed-in screen (brief §12). The one exception is the live camera capture, a full-screen view by design (D-048). Before sign-in (login steps) there is no avatar to show.
- **Principal navigation stays Home · Attendance · Reports**, with the existing Students / Staff switch inside Attendance. The brief's four tabs would need "Student attendance" and "Staff attendance", which don't fit 80px tabs at 320px in either language; shortened to "Students" and "Staff" they lose meaning. The principal home still has direct actions for both. Instructors have Home · Reports (D-052).
- From 600px the destinations move into the header as a compact row. There is never a sidebar or rail: the brief rules them out, although the DS column table allows one.

**D-052 · Home owns today's work; instructors have Home · Reports.** *Owner (UX update brief).*
- `deriveJourney` adds the Attendance tab only when `access.selection === 'institute'`, which is the principal's institute board with its Students / Staff switch. It adds Reports when a report block is enabled for the role, or when offline data is on (instructors, D-056). So instructors get Home · Reports and the principal Home · Attendance · Reports.
- Home lists today's classes in the shape the mapping model sets. Under open mapping, the trade list sits on Home itself ("Today's attendance · Choose a trade, then a batch"), with no "Choose trade and batch" card before it. The "View reports" link is gone: past attendance lives in Reports.
- `/attendance` redirects to Home when the tab is absent (`AttendanceTabScreen`), so old links keep working. Task screens (trade, gateway, roster, review, record) take their `area` and back target from `useAttendanceRoot()` (`src/features/attendance/useAttendanceRoot.ts`): the Attendance tab where it exists, otherwise Home.
- *Why:* for an instructor, the Attendance tab repeated Home. Now today's work has one place (Home) and history has one place (Reports).
- *PRD:* silent on navigation and on Home's layout. §7 defines only how a class is chosen.

## Home, reports and offline data

**D-053 · Reports is one page: my month, and my batches over a rolling window.** *Owner (UX update brief); the details are assumed.*
- `ReportsScreen` renders one section per block in `journey.reports.blocks`. **My attendance** covers this calendar month to date (`ReportService.thisMonth`, as the brief asks). **Batches, leaderboards, at-risk and the institute figure** cover the last `reports.windowDays` days (default 30, `recentWindow`), so the first days of a month are not thin; the section subtitles say "last 30 days".
- **Counting:** a student's day counts once however many sessions it had (twice daily, periods): present sessions ÷ that day's sessions. A batch or institute average is over student-days. A student is flagged at risk only on the unrounded figure and only with at least `reports.atRiskMinDays` marked days (default 5; one absence is not a pattern). A figure below the threshold never rounds up to it (74.6% shows as 74%, not "75% ⚠").
- **Instructor sections:**
  - **My attendance** (`my_attendance`): this month's %, days present and absent, and a trend over `reports.trendMonths` months (default 3).
  - **My batches** (`my_batches`): each batch's average, grouped under its trade as on Home (no repeated tile or at-risk count on the rows: that lives in At-risk students). A row expands (`src/components/ui/Disclosure.tsx`) into a leaderboard of its students, ranked 1…n, and sorted Highest first or Lowest first (starting from `reports.leaderboardSort`), with at-risk students flagged. Ties keep a stable order (more days present, then name). Students with no marks come last, unranked. A "Hide students" button at the end of the list closes it and returns to the row.
  - **At-risk students** (`student_percentage`, relabelled): only students below `reports.eligibilityThresholdPct` (D-022), grouped by batch, with a batch filter; one batch with none says "No students at risk in this batch". A new filter shows a placeholder (never the previous filter's groups), a single group opens by itself, and the result count is announced to screen readers.
- **Principal sections:** Institute attendance (`institute_summary`: %, students, batches, staff presence); Batch attendance (`trade_batch`: every batch grouped by trade, with the same leaderboard); At-risk students across the institute; and **More reports**, which links to Staff attendance and Correction log. These two are the only detail reports left at `/reports/view` (range switch and print, D-023).
- `daily_register` is removed: its type, service, screen and strings.
- **Scope** (`batchesInScope`): under open mapping, "mapped" now means the instructor's home batches (`StaffMember.batchIds`), not the whole institute. With `instructorScope: 'both'` it adds the batches they marked this month, and a group instructor adds their trade. The principal sees every batch.
- **Services:** `myAttendance`, `batchOverview`, `batchStudents`, `atRisk({ threshold?, batchId? })`, `instituteSummary`, `build` (detail blocks only) and `batchesInScope`.
- **New keys:** `reports.leaderboardSort` (`'high_first'`), `reports.trendMonths` (3; 0 hides the trend), `reports.windowDays` (30) and `reports.atRiskMinDays` (5). `validate.ts` rejects a threshold outside 1–100 (`threshold_range`), a trend outside 0–12 (`trend_months`), a window outside 7–120 days (`report_window`) and a minimum outside 1–window (`at_risk_min_days`).
- **Known behaviour:** My attendance ("this month") is thin in the first days of a month and stays truthful about it; it reads "No attendance recorded this month yet" until the month's first record, and the trend still shows earlier months. The batch figures don't have this problem (rolling window).
- *Why:* the old list of report types and ranges made instructors choose before they saw anything. One page answers "how are my students and I doing?" at a glance. Ranges and print stay where the principal needs a document.
- *PRD §19:* the sections are §19.2's blocks. The daily register is one of them, "switchable per state": Maharashtra switches it off, and the code no longer carries it, so a state that wants it needs it rebuilt. §19.1 gives an open-mapping instructor the batches they actually marked; the default `both` adds their home batches. §19.3–19.4's date ranges and PDF now apply only to the detail reports. The PRD has no at-risk list or threshold: that is an extension.

**D-063 · At-risk students have no batch filter.** *Owner (UX update brief, round 2).* The list is already grouped by batch (each group expands to its students), so the dropdown added a step without adding information. `ReportService.atRisk` keeps its `batchId` option for the API.

**D-054 · Announcements on Home.** *Owner (UX update brief). Extension: the PRD has no notices.*
- **Domain** (`src/domain/announcement.ts`):
  - fields: category (info / important / holiday / ojt), priority (high / normal), source (state / institute / principal), audience (institute / trade / batch / staff), `showFrom`–`showUntil` (inclusive), optional `eventFrom`–`eventTo`, and bilingual `LocalizedText` (English is required and is the fallback);
  - `isForReader` does the targeting, and never crosses institutes;
  - `compareAnnouncements` orders high priority first, then important > holiday > OJT > info, then newest.
- **Service:** `AnnouncementService.forUser(ctx)` returns the notices showing today for this reader. `readerFor` decides the reader's reach: under open mapping, trade and batch notices follow the person's home batches and trades, not every batch they could mark; the principal reads everything posted for the institute.
- **Repository:** `AnnouncementRepository`. The mock is `MockAnnouncementRepository`, with six notices built relative to today (`src/data/mock/announcements.ts`). The API stub is `ApiAnnouncementRepository` (`GET /institutes/{id}/announcements?active=true`).
- **UI** (`src/features/announcements/*`): one compact strip under the greeting on both Homes, with the most important notice and "N more announcements". A tap opens the full list in a bottom sheet. Category colours are Important amber, Holiday green, OJT blue and Info grey, always with the icon and the word.
- **Config:** `announcements.enabled` is off in the product defaults and on for Maharashtra. Off: the strip is absent and the service returns nothing.
- Notices are information only. An OJT notice marks nobody OJT: that status still comes from the ERP declaration. The demo's OJT notice has a matching declaration in `seeds.ts`.
- *Why:* instructors hear about holidays, OJT periods and timing changes in the place where they mark attendance.
- *PRD:* silent (no notices anywhere).

**D-055 · Refresh one downloaded batch.** *Owner (UX update brief). Extension of PRD §20.3.*
- `BatchPackService.refreshBatch(ctx, batchId)` pulls one roster through `MasterDataRepository.getBatchRoster` (API stub: `GET /institutes/{id}/batches/{batchId}/roster`; the API build stores it in the pack) and re-stamps its `downloadedAt`. It works only online (`offline`), for a user with offline on and the batch in scope (`no_access`), and for a batch already on the phone (`not_downloaded`). Drafts and records waiting to sync are never touched. Simulated time: about 0.9 s for one batch, at most 1.5 s for many.
- `SessionCard.pack` carries `{ downloadedAt, stale }`. `PackRow` gains `pendingSync`: that batch's records waiting to sync.
- **The strip** (`src/features/offline/BatchDataRow.tsx` + `useBatchRefresh.ts`): one "Updated 7:45 AM · Refresh data" strip per downloaded batch on Home and trade cards. It sits on the batch's next session still to come (else its first), is shown to markers only, and only when offline is on. A stale pack reads "Updated 22 Sep · refresh needed".
- A tap shows "Refreshing student data…", then "Updated just now" for a minute (`JUST_NOW_MS`), then the refresh time. It is a timer, not computed from the clock: the demo clock is fixed, so a computed "just now" would never age. Offline, a toast says "Connect to the internet to refresh". While busy the button keeps focus (`aria-disabled`) and shows only its spinning icon, so the status reads on one line. With `offline.manualRefresh` off the strip still says when the list was downloaded, without the button.
- *PRD §20.3:* the manual refresh "pulls current data for every pack" from the offline section. That stays (D-056). One batch is an addition, so a roster change the instructor knows about doesn't wait for every pack.

**D-056 · Offline data lives under Reports.** *Owner (UX update brief).*
- **Routes:** `/reports/offline` and `/reports/offline/download` (`src/features/offline/*`). `next.config.ts` redirects `/profile/offline` and `/profile/offline/download` to them. The profile-menu row is gone.
- Reports has an "Offline data" section (instructors, while offline is on): how many batches are on the phone, the sync state, and how many need a refresh. With reports off but offline on, the Reports tab stays for it (D-052).
- **The screen** (revised in D-065):
  - sync first: the Sync pending card (D-064) while records wait, otherwise "All attendance synced", and the end-of-day rule under it;
  - the records waiting to sync;
  - each downloaded batch with when it was updated, a status (Ready offline / Refresh needed / N waiting to sync) and its own refresh; batches that need the instructor come first (waiting to sync, then refresh needed), and a stale row carries the warning edge. A refresh-all is announced once (its toast), not by every row;
  - the list's action group: "Refresh all data" (busy: "Refreshing all data…") and "Download more batches".
- A user without offline (the principal) who opens an old link is sent to Reports or Home, and the service refuses changes for them too.
- *Why:* "is my data on this phone, and has it been sent?" is a status question that belongs beside the reports, not in profile settings. The profile menu also stays short.
- *PRD §20:* speaks of "the offline section" without placing it.

**D-064 · Sync pending on Home.** *Owner (UX update brief, round 2).*
- `SyncPendingCard` (`src/features/offline/SyncPendingCard.tsx`) shows only while attendance waits on this phone (students' or staff marks), and for a moment after it syncs, to say so. It is never shown on a phone that is all synced. It is on both Homes, first after the greeting (work before notices), and on Offline data.
- **States:** waiting ("Sync pending · N attendance records waiting", with why: offline, "Auto-sync failed at 10:42 AM", or "Saved safely on this phone") · syncing (the button shows "Syncing…") · couldn't sync after a Sync now ("Couldn't sync · Tried at … · check your internet", Try again) · "All attendance synced" (success, then it goes away). The soft warning surface, and Sync now is the one primary action. Offline it is inactive, and a press says "Connect to the internet to sync".
- **Service:** `SyncStatus.lastFailure {at, trigger: 'auto' | 'manual'}` is kept until an attempt succeeds. `syncNow('auto')` is used by the automatic triggers (reconnect, app start, record queued, opening a batch) and `syncNow()` by a tap. The clock is injected.
- **One sync message per screen:** Home and Offline data pass `banner="offline"` to `ScreenLayout`, so the bar under the header only says "offline" there. Other screens keep the full connectivity bar.
- **Demo:** Network → Pending sync now stages the brief's story: a record waiting after a failed automatic attempt; Sync now then works (unless Next sync: Fails).
- *PRD §20.5:* sync states and Sync now; the card is where Home shows them.

**D-065 · Offline data: one action group under the list.** *Owner (UX update brief, round 2).* The downloaded batches are one divided card, and its last part is the action group, the same width as the list: "Refresh all data" (outlined) and "Download more batches" (text), stacked on phones and side by side from about 520px of card. The stale banner and its second Refresh button are gone: a stale row says "Refresh needed", carries the warning edge and has its own refresh, and Reports' Offline entry still counts them. With nothing downloaded, the empty state offers "Download batches".

**D-068 · Shared pieces from the round-2 consistency pass.** *Assumed.*
- **`StatusLine`** (`src/components/ui/StatusLine.tsx`): one icon + coloured text style for short states (Ready offline, Refresh needed, N waiting to sync, N students at risk, At risk, Registered, Not marked). One size: label-small-strong, a 16px icon, 4px apart. It replaced seven hand-made copies with three fonts and icon sizes 14, 16 and 20.
- **`Card divided`**: the list card (rows edge to edge, one divider between) used by the Reports batch and at-risk lists and the Offline batches. It replaced three copies of the same CSS.
- **The header avatar** is the shared `Avatar` inside a plain button.
- **"Submitted today"** on Home uses `Section variant="label"`, like every other group label, and its rows have the card shadow.
- **At-risk:**
  - the rows drop the extra tile (the "My batches" rows above have none), and "N students at risk" is a warning `StatusLine`;
  - "no one at risk" is a success `Banner`, like "All attendance synced".
- **Profile menu:** Help no longer shows a navigation chevron (it opens a message, not a screen).
- **Duplicate CSS rules removed:** `.rowTitle`, `.chevron`, `.recent`.
- **Kept deliberately:** the principal Home's "View student attendance" and "Mark staff attendance" buttons (they are in the approved prototype), and Review's footer "Go back" (the confirm pattern).

## Demo

**D-017 · Frozen demo clock.** *Assumed.* The demo clock starts fixed at **10:15 IST today**, so every demo tells the same story: Shift 1 is open, Period 3 is "Now" and Shift 2 opens at 2:00 PM. The panel offers 7:30, 10:15, 11:30, 2:30 PM and "Real". With the demo off, the system clock is used.

**D-018 · The story is relative to today.** *Assumed.* The seed builds today's submissions, yesterday's correction and deterministic history for every past working day (generated at read time, never stored) from the current date. The mock DB reseeds when the calendar day changes, so "today" in the demo always means today. Reset Demo wipes all three storage namespaces and reloads.

**D-061 · The Employability Skills instructor has history.** *Assumed.* `SUBJECT_HISTORY` (`src/data/mock/history.ts`) generates each subject instructor's daily session for each of their batches on past working days: ids `hist-es~<batch>-<date>`, marked by the subject instructor in the late morning, with marks drawn from each student's own attendance propensity. Reports for a subject instructor count only their subject's sessions (D-013), so without this the ES persona's Reports were empty. *PRD:* not applicable (mock data).

**D-036 · Layout reserves room for the demo trigger only while it floats.** *Assumed.* In the app header the trigger is an ordinary header item (D-057), so nothing is reserved. On screens without the header it floats and sets `html[data-demo-float]`, the only time the reserves in `tokens.css` apply. Otherwise they are 0, and always 0 with the demo off.
- **Phones:** headerless screens get 40px of extra top padding (`--demo-reserve-block`). `--demo-reserve-inline` (84px; 48px below 360px, where the pill is icon-only) is kept only so a floating first-row banner ends before the pill.
- **From 600px:** scrollers get 72px of extra bottom room (`--demo-reserve-block-end`), so the last row can scroll clear of the bottom-right pill. Card screens don't need it, because the pill sits outside the card.

**D-047 · Demo controls stay collapsed on every size; presenters pick a demo account at login.** *Owner (UX update brief).*
- A collapsed **Demo** trigger on every screen: in the app header's tool slot (D-057), floating only on screens without the header (top right on phones, bottom right from 600px; reserves in D-036).
- Phones open a modal bottom sheet (≤ 90% height). From 600px it is a 380px **non-modal** drawer on the **right**, below the app header, on the trigger's side (D-066). The avatar and navigation stay usable, and it overlays the app without reflowing it, so the presenter can keep using the app.
- Esc closes it (unless a sheet or menu is open on top), and every way of closing returns focus to the trigger. The panel's content mounts only while open, so nothing of it is in the page (or read by a screen reader) while collapsed. The permanent desktop sidebar is gone.
- In Advanced, location is two controls: **Location source** (Simulated / This device), and the simulated outcome only while simulating. Segmented controls can never overflow their row.
- Order: **Quick presets** (most prominent), **Quick login** (every persona), then **Advanced** (collapsed: all configuration and simulation controls, plus "Skip login screens").
- **Autofill:** the product defines a `LoginAssistSource` seam; only the demo supplies one. The login steps show **Use demo account** (D-058). A field is filled only when the presenter picks an account. It never submits and never skips a confirmation. *Alternatives:* prefilled query strings (`?code=`, `?tid=` still work) or a credentials card on the login page (rejected by the brief).
- Presets keep the presenter's **camera choice**, face-detection mode and speed: those describe the machine, not the story.

**D-057 · The demo trigger sits in the app header.** *Owner (UX update brief); its place was moved by D-066.*
- `AppHeader` always renders an empty tool slot (`HeaderToolSlot`, `src/components/shell/ToolSlot.tsx`): a `display: contents` span, so the header lays out as if it weren't there. `DemoRoot` portals the trigger into it.
- **Where it sits:** immediately left of the avatar on every screen and width (D-066).
- Screens without the app header (login, camera, results, permission cards) have no slot. There the trigger floats (top right on phones, bottom right from 600px) and sets `html[data-demo-float]` (D-036).
- The wide drawer opens on the right, below the whole header: `DemoRoot` measures it, so on task screens it starts under the back + title row. Phones keep the bottom sheet.
- *Why:* a pill floating over the header had to reserve space on every screen, and at some widths it still crowded the avatar or a title. In the slot it is a normal header item. The product never puts anything in the slot and never depends on it.
- *PRD:* not applicable (presenter tooling).

**D-066 · Demo sits immediately left of the avatar.** *Owner (UX update brief, round 2).*
- `AppHeader`'s trailing group is `[tool slot][avatar]` (`.end`), so the trigger sits right beside the avatar everywhere:
  - tab roots `brand … [Demo][avatar]`;
  - phone task screens `[← title] … [Demo][avatar]`;
  - from 600px `brand · navigation … [Demo][avatar]`.
- The avatar stays the right-most control.
- The trigger stays the collapsed yellow "Demo" pill, visibly temporary tooling. It is icon-only where the room is needed: phone task screens, below 360px, and 600–899px (the principal's three destinations). On 360–399px tab roots it is labelled, slightly tighter.
- The wide drawer moved to the right, on the trigger's side.
- *Why:* the owner wanted one consistent place for the tooling, next to the other personal control, rather than at the far left of the brand.

**D-067 · The deployed build keeps the demo.** *Owner (UX update brief, round 2).* The repository's `.gitignore` excludes `.env.production`, so a Vercel build from git had no `NEXT_PUBLIC_DEMO_MODE` and compiled the demo out: no Demo button and no "Use demo account" on the deployed site. `next.config.ts` now defaults the flag to `true` (`env`), and only an explicit `false` strips it. That is the Vercel project setting for a real rollout, and what `npm run check:demo` uses to prove the strip. This was verified by building a copy of the project with no `.env` files: the Demo trigger and "Use demo account" are present.

**D-058 · "Use demo account" on the login screens.** *Owner (UX update brief).*
- `LoginAssistPicker` sits under the field on the Institute code and Trainer ID steps. It expands to five accounts: Open, Batch-mapped, Timetable, Employability Skills and Principal (`DEMO_ACCOUNTS`, `src/demo/adapters.ts`).
- **Choosing an account** runs that persona's preset preparation (`prepareScenario` in `src/demo/controller.ts`: persona, configuration, simulation, the 10:15 clock, face enrolment, cleared passes) without signing in or navigating. It then fills the Institute code and focuses it, so Enter continues. `boot.ts` connects the preparation step once the container exists.
- **Trainer ID step:** it arrives prefilled from the chosen account, with "Demo account: … · Change". Typing a different value forgets the pick.
- **First-time preset:** protected. Picking its own account (Open) keeps the first-time story: face not registered, permissions not yet asked.
- **Quick login:** the persona picked in the panel is highlighted in the list but never filled.
- Every step and both confirmations are still shown, and nothing is submitted for the user.
- **Production:** `services.loginAssist` is null, so nothing renders. `scripts/check-demo-stripped.mjs` fails the demo-off build if "Use demo account", "Quick login", "Skip login screens" or the other demo needles reach it.
- *Why:* one explicit pick at the first step sets up the whole story and carries into the second field. The old per-step button filled whichever persona had been picked last in the panel, so the name on screen was not a choice made at login.
- *PRD:* not applicable. The production login (PRD §6) is unchanged.

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

**D-051 · Unsaved staff marks guard every way out.** *Assumed.* The principal's staff screen already hid the bottom nav while marks were unsaved. From 600px the header navigation is always visible, so `ScreenLayout.guardNavigation` routes header nav, bottom nav and the profile menu (face registration, Logout) through the same "Discard n changes?" sheet as the Students/Staff switch. The roster likewise saves its draft when left within the 300 ms debounce.

## Localisation

**D-027 · Marathi needs native review.** *Open.* `src/i18n/messages/mr.ts` is complete and typed against English (a missing key falls back to English and never renders blank). A native Marathi speaker from the department should review it before rollout, especially the terms हजेरी, बॅच, ट्रेड, सबमिट and the correction reasons.
