# Demo guide

This build is a stakeholder demo. It uses mock data, a frozen clock, simulated location and a **real camera** with a prototype face check (face *matching* is simulated), all controlled from a floating **Demo** panel. Nothing leaves the browser: no photo is saved or sent.

## Starting

```bash
npm install
npm run dev            # http://localhost:3000
# or the production build
npm run build && npm start
```

It works on a phone, a tablet and a laptop or projector. The app is mobile-first but uses the whole screen on wider devices: a full-width header with the navigation, and content in a readable column (D-045).

The demo controls are **collapsed by default on every screen size**: a small yellow **Demo** trigger.
- **Phones:** top right (the header leaves room for it). It opens a bottom sheet (up to 90% of the screen, scrolling inside).
- **Tablets and laptops:** bottom right. It opens a drawer on the right that floats over the app. The app stays visible and usable, so you can change a setting and watch the screen react. **Esc** or **×** closes it.

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

Presets sign straight in and keep the presenter's camera choice (below).

## Quick login and demo credentials

**Quick login** (in the panel, under the presets) lists every demo person: Open, Trade-mapped, Batch-mapped, Timetable and Employability Skills instructors, the Group instructor and the Principal. Choosing one signs out and opens the **real login screens**; nothing is typed for you.

On each login step a small, dashed yellow **Use demo login** button shows whose credentials it holds (e.g. *Vikas Shinde · Timetable instructor*). Tap it to fill the field, then press **Continue** (or Enter): the audience still sees the institute code → *Is this your institute?* → Trainer ID → *Is this you?* sequence. The credentials come from the demo personas (`src/demo/personas.ts`) and always match the person you picked last (preset, quick login or skip login). Production builds don't have the button.

| Person | Institute code | Trainer ID |
|---|---|---|
| Rajesh Patil · Open instructor | 27410 | TR-10432 |
| Sanjay More · Trade-mapped | 27410 | TR-10455 |
| Sunita Jadhav · Batch-mapped | 27410 | TR-10518 |
| Vikas Shinde · Timetable | 27410 | TR-10377 |
| Meera Kulkarni · Employability Skills | 27410 | TR-11024 |
| Yogesh Dalvi · Group instructor | 27410 | TR-10390 |
| Dr. Anil Deshmukh · Principal | 27410 | PR-2741 |

To skip the login screens altogether: **Advanced → Skip login screens → On**, then use Quick login.

## Panel controls (Advanced)

Everything below the presets and quick login is under **Advanced**, collapsed by default.

| Section | Controls |
|---|---|
| Login | Skip login screens: Off / On |
| Verification | Location: Off / Geo tagging / Geo fencing. **Location source: Simulated / This device (GPS)**. While simulated, Where is the phone: Inside / Outside / Denied / No GPS. Face verification: On/Off. Face registered: Yes/No. **Camera: This device / Simulated.** With this device: **Face detection: On-device / Guided only**. With Simulated: Registration: Works / Dark / 2 faces / Fails. **Face match (simulated): Matches / No match.** Permissions: Allowed / Ask first (location, and the simulated camera; a real camera asks the browser) |
| Marking | Frequency: Once / Twice / Periods. Default: Present / Absent / Blank. Half day (+ Ask which half), Leave, OJT (from ERP) |
| Time | Time fencing On/Off. Demo clock |
| Staff attendance | Staff attendance, Self attendance, Principal marks staff |
| Network & language | Network: Online / Offline / Pending sync. Next sync: Works / Fails. Language: English / मराठी |

Any configuration change starts a new session: verification passes are cleared and every screen re-renders from the new journey. **Disabled features disappear** from the flow; they are never greyed out.

## Demo scripts

### 1. Mark a batch in under a minute (Open instructor)
1. Preset **Open instructor** → Home shows "Choose trade and batch" and "My attendance · Not marked".
2. Choose trade and batch → **Electrician** → **Shift 1 · Unit 2**.
3. Verification runs on a full screen: *Checking your location…* → *Location verified* → *Look at the camera* (the **live front camera**, with *Hold still* once a face is found) → *Identity verified*. The note under it says it's a prototype: photos aren't saved and matching is simulated.
4. The roster opens with everyone **Present**. Tap **Absent** on two students; the tiles update (31 · 29 · 2) and the rows tint red.
5. **Review & Submit** → the absent list → **Submit attendance** → confirm in the sheet → *Attendance submitted*.
6. Back on Home, the batch is under *Submitted today*. Open it again: it is **locked** ("can only be corrected by the principal today").

### 2. Location and face problems
1. In the panel (Advanced): *Where is the phone* → **Outside** → open any open batch → *You're outside your institute · You are 1.24 km away* → **Check again**.
2. **Denied** → *Location access is off*; **No GPS** → *Location is turned off*.
3. *Face match (simulated)* → **No match** → *We couldn't verify your face* → Try again.
4. Block the camera in the browser (site settings) → *Camera access is blocked · Allow camera access for KSK Attendance in your browser or phone settings, then try again* → allow it → **Try again**. With *Camera: Simulated*, the same screen appears when the demo refuses the camera.
5. *Location* → **Off** and *Face verification* → **Off**: the verification screen disappears entirely and batches open straight to the list.

### 3. The mapping models (Batch mapped, Timetable, Employability Skills)
1. **Batch mapped**: only two cards; tap *Shift 2 · Unit 2* → *Attendance isn't open yet · opens at 2:00 PM*.
2. **Timetable**: periods in time order; *Not marked · closed at 8:00 AM*; Period 2 *Submitted 9:52 AM*; Period 3 **Now** → mark it ("Period 3 · Theory" on the roster).
3. **Employability Skills**: "Employability Skills · 5 batches in 4 trades", grouped by trade. Marking Electrician Shift 1 · Unit 1 here creates the ES record and doesn't touch Rajesh's daily record for the same batch.

### 4. Principal: overview, correction, staff
1. Preset **Principal** → "Good morning, Principal", *5 of 17 batches submitted*, *9 Shift 2 batches open at 2:00 PM*, *Needs attention*.
2. **Attendance → Electrician → Shift 1 · Unit 1** (submitted 9:48 AM by Rajesh Patil) → tap the pencil on **Rahul Kumar** (Absent).
3. Choose **Present**, pick the reason *Student arrived late* (or type one; a reason is required) → **Save correction**. The row shows *Corrected by principal*, and **Reports → Correction log** shows the entry with old → new, reason, who and when. The original record is untouched.
4. **Yesterday** tab on the same batch: read-only ("Attendance from previous days can't be corrected").
5. **Attendance → Staff**: self-verified staff are locked; mark the rest Present/Absent → **Save n changes**. With unsaved marks, leaving (Students, or any navigation) asks *Discard n changes?* first.

### 5. Offline marking and sync
1. Preset **Offline** → the banner reads *You're offline. Attendance will sync automatically.*
2. Open a downloaded batch (Electrician Shift 1 · Unit 2) → mark → submit → *Saved on this phone*.
3. Open **Fitter · Shift 1 · Unit 2**: *Student list downloaded on … New admissions may be missing.*
4. Open a batch that wasn't downloaded (Mechanic Diesel) → *This batch isn't downloaded*.
5. Panel → Network **Online** → *Syncing 1 attendance record…* → *All attendance synced*. For the failure path, set *Next sync* → **Fails** first; the banner offers **Try again**.
6. Tap the avatar (top right) → **Offline data**: downloaded batches and pending records, with *Sync now*.

### 6. Configuration changes, live
1. *Default* → **Blank**: nobody is pre-marked; Review & Submit stays inactive and says how many students remain.
2. *Half day* **On** + *Ask which half* **On**, *Leave* **On**: rows show a full-width pill row; Half day asks *First half / Second half*; Leave asks *Sick / Casual / Medical*.
3. *OJT* **On**: in Electrician Shift 1 · Unit 2, rolls 6 and 13 show a locked **OJT** chip ("On-the-job training · declared in the ERP").
4. *Frequency* → **Twice**: two cards per batch (Morning / After lunch), each locked separately.
5. *Staff attendance* **Off**: *My attendance* and the staff reports disappear.

### 7. Marathi
Tap the avatar (top right) → Language **मराठी** (or Advanced → Language in the panel). Every screen switches to Marathi in Mukta, with Latin digits (D-012). Names stay in Latin script. Switch back to English the same way.

### 8. First-time user
Preset **First-time user** → **Use demo login** (or type **27410**) → *Is this your institute?* → **Yes** → **Use demo login** (**TR-10432**) → *Is this you?* → **Yes** → *Set up face verification* → *Start* → *Camera required* → *Allow camera* (the browser asks) → the live camera takes **three photos**: *Look straight* → *Turn slightly left* → *Turn slightly right*, each appearing as a thumbnail → *Face registered successfully* → Home. The first attendance run then asks for location permission first.

On-device face detection guides each step: *Face not visible*, *Move closer*, *Keep your face in the oval*, *Only you in the frame*, *More light needed*, *Face detected*, *Hold still*, *Turn your head left*, *Turn back a little*, *Now turn the other way*, *Good*. If detection can't start on a device, after two failed attempts, or when you choose *Face detection: Guided only*, each photo is taken on a 3-2-1 countdown instead.

### 9. The same app on a laptop or projector
1. Open any preset at full window width. The header spans the screen: KSK brand, **Home · Attendance · Reports**, and the avatar top right. There is no side column and no phone frame.
2. Home shows *Student attendance* and *My attendance* side by side; the class list and the trade list use two columns.
3. Open a batch: the roster is the same row list (name, father's name, Present/Absent) in a readable centred column, with **Review & Submit** centred below. It is never a table.
4. Login and single-question steps appear as a centred card.
5. Open the Demo drawer, switch *Network → Offline*, and watch the banner appear with the drawer still open.

## Tips

- **If a screen seems stuck, it isn't.** Simulated delays run at normal speed (about 1–2 s). E2E tests run them at 5%.
- **The data looks wrong after a long demo:** use **Reset everything**.
- **No camera on this machine** (or it's in use): *Advanced → Camera → Simulated*. The face steps then play without a camera and say "Demo simulation · no camera or photo is used". Presets keep this choice.
- **Camera over the network:** browsers allow the camera only on HTTPS or `localhost`. Use the Vercel URL, or `localhost`, not a LAN IP over http.
- **What to say about face checks:** the camera and the movement check are real and run on the phone; **matching is simulated**, nothing is saved or sent, and it is **not** secure biometric verification (a photo or video held up to the camera can pass). Production needs a certified matching and liveness provider (D-048).
