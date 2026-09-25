# Demo guide

This build is a stakeholder demo. It uses mock data, a frozen clock and simulated location and face checks, all controlled from a floating **DEMO** panel. Nothing leaves the browser.

## Starting

```bash
npm install
npm run dev            # http://localhost:3000
# or the production build
npm run build && npm start
```

Open it on a phone (or in Chrome DevTools device mode at 360×760). On a laptop or projector (≥ 1024px) the demo panel docks on the right and the app sits in a phone-width column. On phones, tap the yellow **DEMO** pill (top-right) to open the panel as a bottom sheet.

**Jump straight to a story:** `/?preset=open`, `batch`, `timetable`, `es`, `principal`, `first_time` or `offline`.

**The demo clock** is frozen at **10:15 IST today** (D-017). Shift 1 is open, Period 3 is "Now", and Shift 2 opens at 2:00 PM. Change it under *Time → Demo clock* (7:30, 10:15, 11:30, 2:30 PM, Real).

**Every day is a fresh day.** The data is built relative to today and reseeds when the date changes (D-018). **Reset everything** (bottom of the panel) restores the full story at any time.

## Quick presets

| Preset | Who | What it shows |
|---|---|---|
| **Open instructor** | Rajesh Patil (TR-10432) | Any trade, any batch; geo-fence + face; everyone starts Present |
| **Batch mapped** | Sunita Jadhav (TR-10518) | Only her 2 assigned batches; the Shift 2 batch "Opens at 2:00 PM" |
| **Timetable** | Vikas Shinde (TR-10377) | Today's periods, time-fenced; Period 1 closed, Period 2 submitted, Period 3 **Now** |
| **Employability Skills** | Meera Kulkarni (TR-11024) | 5 batches in 4 trades; a separate ES record per batch |
| **Principal** | Dr. Anil Deshmukh (PR-2741) | Institute overview, batch records, corrections, staff marking, reports |
| **First-time user** | Rajesh Patil | Starts at login; face not set up; location and camera permissions asked first |
| **Offline** | Rajesh Patil | No network; downloaded batches still open; records wait to sync |

## Panel controls

| Section | Controls |
|---|---|
| Role & persona | Instructor (Open, Trade-mapped, Batch-mapped, Timetable, Employability Skills), Group instructor, Principal. Switching signs in as that person |
| Verification | Location: Off / Geo tagging / Geo fencing. Where is the phone: Inside / Outside / Denied / No GPS / Real GPS. Face verification: On/Off. Face registered: Yes/No. Face check: Matches / No match. Registration: Works / Dark / 2 faces / Fails. Permissions: Allowed / Ask first |
| Marking | Frequency: Once / Twice / Periods. Default: Present / Absent / Blank. Half day (+ Ask which half), Leave, OJT (from ERP) |
| Time | Time fencing On/Off. Demo clock |
| Staff attendance | Staff attendance, Self attendance, Principal marks staff |
| Network & language | Network: Online / Offline / Pending sync. Next sync: Works / Fails. Language: English / मराठी |

Any configuration change starts a new session: verification passes are cleared and every screen re-renders from the new journey. **Disabled features disappear** from the flow; they are never greyed out.

## Demo scripts

### 1. Mark a batch in under a minute (Open instructor)
1. Preset **Open instructor** → Home shows "Choose trade and batch" and "My attendance · Not marked".
2. Choose trade and batch → **Electrician** → **Shift 1 · Unit 2**.
3. Verification runs on a full screen: *Checking your location…* → *Location verified* → *Look at the camera* (simulated, no photo is taken) → *Identity verified*.
4. The roster opens with everyone **Present**. Tap **Absent** on two students; the tiles update (31 · 29 · 2) and the rows tint red.
5. **Review & Submit** → the absent list → **Submit attendance** → confirm in the sheet → *Attendance submitted*.
6. Back on Home, the batch is under *Submitted today*. Open it again: it is **locked** ("can only be corrected by the principal today").

### 2. Location and face problems
1. In the panel: *Where is the phone* → **Outside** → open any open batch → *You're outside your institute · You are 1.24 km away* → **Check again**.
2. **Denied** → *Location access is off*; **No GPS** → *Location is turned off*.
3. *Face check* → **No match** → *We couldn't verify your face* → Try again.
4. *Location* → **Off** and *Face verification* → **Off**: the verification screen disappears entirely and batches open straight to the list.

### 3. The mapping models (Batch mapped, Timetable, Employability Skills)
1. **Batch mapped**: only two cards; tap *Shift 2 · Unit 2* → *Attendance isn't open yet · opens at 2:00 PM*.
2. **Timetable**: periods in time order; *Not marked · closed at 8:00 AM*; Period 2 *Submitted 9:52 AM*; Period 3 **Now** → mark it ("Period 3 · Theory" on the roster).
3. **Employability Skills**: "Employability Skills · 5 batches in 4 trades", grouped by trade. Marking Electrician Shift 1 · Unit 1 here creates the ES record and doesn't touch Rajesh's daily record for the same batch.

### 4. Principal: overview, correction, staff
1. Preset **Principal** → "Good morning, Principal", *5 of 17 batches submitted*, *9 Shift 2 batches open at 2:00 PM*, *Needs attention*.
2. **Attendance → Electrician → Shift 1 · Unit 1** (submitted 9:48 AM by Rajesh Patil) → tap the pencil on **Rahul Kumar** (Absent).
3. Choose **Present**, pick the reason *Student arrived late* (or type one; a reason is required) → **Save correction**. The row shows *Corrected by principal*, and **Reports → Correction log** shows the entry with old → new, reason, who and when. The original record is untouched.
4. **Yesterday** tab on the same batch: read-only ("Attendance from previous days can't be corrected").
5. **Attendance → Staff**: self-verified staff are locked; mark the rest Present/Absent → **Save n changes**.

### 5. Offline marking and sync
1. Preset **Offline** → the banner reads *You're offline. Attendance will sync automatically.*
2. Open a downloaded batch (Electrician Shift 1 · Unit 2) → mark → submit → *Saved on this phone*.
3. Open **Fitter · Shift 1 · Unit 2**: *Student list downloaded on … New admissions may be missing.*
4. Open a batch that wasn't downloaded (Mechanic Diesel) → *This batch isn't downloaded*.
5. Panel → Network **Online** → *Syncing 1 attendance record…* → *All attendance synced*. For the failure path, set *Next sync* → **Fails** first; the banner offers **Try again**.
6. Profile → **Offline data** lists downloaded batches and pending records, with *Sync now*.

### 6. Configuration changes, live
1. *Default* → **Blank**: nobody is pre-marked; Review & Submit stays inactive and says how many students remain.
2. *Half day* **On** + *Ask which half* **On**, *Leave* **On**: rows show a full-width pill row; Half day asks *First half / Second half*; Leave asks *Sick / Casual / Medical*.
3. *OJT* **On**: in Electrician Shift 1 · Unit 2, rolls 6 and 13 show a locked **OJT** chip ("On-the-job training · declared in the ERP").
4. *Frequency* → **Twice**: two cards per batch (Morning / After lunch), each locked separately.
5. *Staff attendance* **Off**: *My attendance* and the staff reports disappear.

### 7. Marathi
Panel → Language **मराठी** (or Profile → Language). Every screen switches to Marathi in Mukta, with Latin digits (D-012). Names stay in Latin script. Switch back to English the same way.

### 8. First-time user
Preset **First-time user** → institute code **27410** → *Is this your institute?* → **Yes** → Trainer ID **TR-10432** → *Is this you?* → **Yes** → *Set up face verification* (simulated) → *Start* → *Allow camera* → 3 simulated captures → Home. The first attendance run then asks for location permission first.

## Tips

- **If a screen seems stuck, it isn't.** Simulated delays run at normal speed (about 1–2 s). E2E tests run them at 5%.
- **The data looks wrong after a long demo:** use **Reset everything**.
- **Wrong device width:** the app is designed for 320–412px; wider screens show a centred column.
- **Face "verification" is a simulation.** Say so if asked: no camera is used and nothing is stored. A production build needs a real liveness and matching provider (D-009).
