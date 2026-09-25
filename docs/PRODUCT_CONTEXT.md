# Product context

## What this is

KSK Attendance is one attendance product for Industrial Training Institutes (ITIs). Each state gets its own deployment, and every difference between states is a **configuration value, not a code change** (PRD §1). This repository is the **Maharashtra** instance. It runs as a MiniApp inside the **SwiftChat** Android app, which shows it in a WebView.

The PRD's design principle drives the whole codebase: *every component ships built; configuration decides which components appear, in what order and under what constraints. A disabled feature is absent from the flow, not greyed out.* (PRD §1.2)

## Who uses it

| Role | What they do here | Can correct a submitted mark? |
|---|---|---|
| **Instructor** (regular, contractual or guest) | Marks attendance for the batches the state's mapping rules give them. Marks their own attendance. Views their reports. | No |
| **Group instructor** | Same as an instructor, plus a read-only overview of their whole trade. | No |
| **Principal / admin** | Sees the whole institute. Marks staff attendance. Corrects today's student marks, with a reason; every correction is audited. Can mark a batch that is still unsubmitted while its window is open. Institute reports. | Yes: same day, with a reason, logged |

The primary user is the instructor who opens the app every shift. Plan for these conditions: a low-end Android phone, bright workshops, often one-handed use, 20–35 students per batch, intermittent connectivity, and varied digital literacy. **Target: mark a 30-student batch in well under a minute** (PRD §2.1).

Students do not use this product.

## Goals (PRD §2.1)

1. One codebase, many state instances.
2. Configuration over code.
3. Marking is fast: everyone starts as Present (the Maharashtra default) and the instructor taps only the absentees.
4. Data is trustworthy. Where the state asks for it, location (geo-fence) and face are checked before the list opens.
5. Corrections are possible but accountable: principal only, same day only, reason required, append-only log.

Non-goals: student views, payroll/HR/leave management, timetable authoring, OJT declaration (that is an ERP action whose result this app consumes), and **backdating of any kind for any role**.

## Maharashtra configuration in one paragraph

Mapping is **open**: any instructor can mark any trade and batch in their institute. Verification is **geo-fencing (500 m) plus face**. Marking happens **once a day per batch** and **everyone starts Present**; the status set is Present and Absent. **Time fencing** is on, with shift windows 07:00–14:00 and 14:00–20:00, and institutes may override the windows. **Staff attendance** is on (self-marking plus principal marking). All eight report blocks and the day, week, month and custom ranges are enabled. **Offline marking** of downloaded batches is on, with auto-sync. The UI is available in **English and Marathi**, with Latin digits in Marathi. The full list is in [CONFIGURATION.md](CONFIGURATION.md).

The demo can switch to the other models the PRD defines (trade-mapped, batch-mapped, timetable/period-wise, Employability Skills across trades, twice-daily, blank or absent defaults, half day, leave, OJT). Stakeholders can then see how another state would behave without a code change. See [DEMO_GUIDE.md](DEMO_GUIDE.md).

## Core journeys

1. **Login:** institute code → "Is this your institute?" → Trainer ID → "Is this you?" (name, designation, trade, employment type). On a first login with face verification on, the app first asks the user to set up their face (simulated).
2. **Mark students:** choose the class. The configuration decides how: trade picker (open), assigned batches (batch/ES), today's timetable (timetable), or trade switcher (trade-mapped). The user verifies presence on a full-screen step (location, then face). Then they mark with one tap per student (default Present, tap Absent), review the summary, submit, and the record locks.
3. **My attendance:** the instructor marks their own attendance with the same verification step.
4. **Principal:** an institute overview (batches submitted, staff marked, what needs attention), batch records, same-day corrections with a mandatory reason, staff marking and institute reports.
5. **Offline:** the instructor downloads batches while online, marks them offline, and the records lock locally and sync automatically later. The app always shows its sync state.
6. **Reports:** mobile cards, never tables, over day, week, month or custom ranges. Print or save as PDF uses the browser's print view.

## Integrity rules that no configuration can relax (PRD §5.3, §12, §18, §20)

- A marking session is submitted **once**, then locked for everyone.
- **No backdating or forward-dating.** Only today can be marked or corrected.
- Only the **principal** corrects, only **today's** records, and only with a **reason**. The original record is never overwritten; corrections are an append-only log.
- The **time fence** is hard, with no grace period. Once a window closes, an unsubmitted batch stays a visible gap.
- **Verification happens before the list** is shown, and submission checks it again.
- Staff get **one mark per person per day** across both paths. The first mark wins, and self-marking takes precedence in the principal's list.
- **OJT** comes only from ERP declarations. It is never chosen or corrected in this app.
- A record that is **not yet synced cannot be corrected**.

## What is simulated in this build

This build uses **mock data and simulations only**. Nothing is sent to a server, and no real credentials exist.

- **Login** looks up mock institutes and staff. There is no password or OTP (PRD open question 1: `login.second_factor` supports only `none`).
- **Face verification and face enrolment are simulations.** The app opens no camera stream, takes no photo and performs no biometric matching. A switch decides the outcome. The UI labels it "Demo simulation · no photo is taken". **It must not be presented as secure biometric verification.**
- **Location** is simulated by default (inside, outside, denied, or no GPS). The demo panel can switch to the device's real GPS, which is used only to compute distance from the mock institute.
- **Server sync** is a simulated gateway that can be told to fail once.

What "production" still needs is in [ARCHITECTURE.md § Going live](ARCHITECTURE.md#going-live-what-replaces-the-mocks).

## Sources

- `Doc/PRD.pdf` is the product specification. Its section numbers are cited throughout the code as `PRD §n`.
- `prototype/Prototype.html` is the approved clickable prototype and is authoritative for layout, copy and flow.
- `Doc/swiftchat-design-system.md` is the SwiftChat Design System.
- `Doc/mh_ksk_logo.png` is the Maharashtra Kaushalya Samruddhi Kendra logo.
