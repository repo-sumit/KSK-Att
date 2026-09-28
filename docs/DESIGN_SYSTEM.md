# Design system

The source of truth is `Doc/swiftchat-design-system.md` (SwiftChat DS) together with the approved `prototype/Prototype.html`. This document explains how the codebase applies them and lists every deliberate deviation. **Do not add new colours, fonts, radii or type sizes. Use the tokens.**

## Files

| File | Role |
|---|---|
| `src/styles/tokens.css` | DS primitives (primary blue, neutrals, secondary palette) → semantic tokens (background, text, icon, interactive, border, status, selection card), plus spacing, radius, dividers, touch sizes, layering and motion |
| `src/styles/typography.css` | DS text styles as `--type-*` (the `font` shorthand) and `--ls-*` (letter spacing). Marathi twins under `:root:lang(mr)` |
| `src/styles/globals.css` | Reset, focus ring, `.visually-hidden`, keyframes, reduced motion, print rules |
| `src/components/ui/*` | The kit: every screen is built from these |
| `src/components/shell/*` | `ScreenLayout` (frame, gutters, card mode), `AppNav` (bottom nav on phones, header nav from 600px), `ToolSlot` (the header's empty slot for tooling outside the product), `InlineBackBar`, connectivity banner, session gate |
| `src/features/shell/AppHeader.tsx` | The one header of every signed-in screen (brand · navigation · avatar) |

Two **DS package extensions** cover the prototype's 12px/600 and 11px/600 text: `--type-label-small-strong` and `--type-caption-strong`, each with a Mukta twin. Other additions to the DS set are `--color-chat-input-background` (the DS chat input white, so fields stay white on the grey page), `--color-surface-pressed` (visible press feedback on white rows and cards) and `--color-interactive-destructive-fill` (the AA filled destructive red).

Apply a full DS text style like this:

```css
.title {
  font: var(--type-title-small);
  letter-spacing: var(--ls-title-small);
}
```

`tests/unit/design/token-lint.test.ts` fails the build on raw colours, radii or font sizes in any CSS Module. `tests/unit/design/contrast.test.ts` checks the WCAG ratio of every text/background pair the app uses.

## Foundations

- **Fonts:** Montserrat for English and Latin script, Mukta for Marathi/Devanagari, both loaded through `next/font` (`src/app/layout.tsx`). With `<html lang="mr">`, every `--type-*` switches to Mukta with taller line heights (so matras never clip) and zero letter spacing. Master data (student, staff and trade names, IDs) is wrapped in `<Latin>` (`lang="en"`), which restores the Latin style for that subtree.
- **Surfaces:** a grey app background (`--color-background-surface`, #ECECEC) with white raised cards (`--color-background-surface-raised`). Roster, record and staff lists run white and edge to edge, as in the prototype.
- **Spacing:** base-8 (`--space-8 … --space-96`). `--space-2` and `--space-4` are optical nudges only. The page margin is 16px.
- **Radius:** cards `--radius-lg` (12px), as the prototype chose; buttons, inputs, pills and chips `--radius-full`; tiles `--radius-md`.
- **Touch:** every interactive element is ≥ 44×44px (`--touch-target-min`). The primary CTA is 56px (`--cta-height`). Roster rows are at least 64px.
- **Light mode only** (`color-scheme: light`). SwiftChat's MiniApp surface is light.
- **Motion:** 80–200ms with no decorative animation (D-060). Each CSS module defines the keyframes it uses (CSS Modules scope animation names per file; a keyframe in `globals.css` would never match): `ksk-reveal` (a `Disclosure` panel grows open), `ksk-fade-in` (a status text that just changed, the toast), `ksk-pop` (the result icon settles), and `ksk-spin` (spinners, and the refresh icon while refreshing). `prefers-reduced-motion` collapses every animation and transition to its end state.

## Status language

Status is always **icon + text + colour**, never colour alone:

| Status | Icon | Tone | Selected pill | Row tint |
|---|---|---|---|---|
| Present | check | success | success-subtle fill, green border | none (it is the default) |
| Absent | x | error | error-subtle fill, error border | error-subtle |
| Half day | half | warning | warning-subtle fill | warning-subtle |
| Leave | calendar | info | info-subtle fill | info-subtle |
| OJT | briefcase | brand | shown only as a chip; never selectable | hero-banner |
| Not marked | circle | warning | n/a | left warning bar when the user tries to submit |

The registry is in `src/domain/status.ts` (`STATUS_REGISTRY`) and the styling in `src/components/ui/status-style.ts`.

## Kit

| Component | Notes |
|---|---|
| `Button` | Variants: primary, secondary (outline), ghost, destructive, inverse. Sizes: lg 56, md 44, sm 36 (sm is for inline use only). `inactive` + `onInactivePress` keeps the button focusable and explains why it can't be used yet. `loading` shows a spinner and the busy label, keeps focus (`aria-disabled` + `aria-busy`, not `disabled`) and ignores taps |
| `IconButton` | 44px circle; always carries a `label` |
| `Input` | 52px pill with a linked `<label>`; the error has `role="alert"` and is tied to the field with `aria-describedby` |
| `Segmented` | `radiogroup` with arrow-key support; the small size keeps its look but its tap area reaches 44px |
| `StatusPill` | One-tap status buttons (`aria-pressed`). The icon appears only when pressed. `stretch` shares the row width |
| `StatusChip`, `Badge` | Read-only status or labels |
| `ChoicePill`, `SelectionCard` | Follow-up choices (half, leave type) and correction choices |
| `StatTiles` | Three-up totals with tabular numerals. Surfaces: `hero` (tinted on white), `raised` (tinted on grey), `plain` (white tiles, tone in the text only: the staff view) |
| `Card`, `PressableCard`, `ListRow`/`List`, `DetailRows`, `Section` | Content structure |
| `Disclosure` | An expandable row: the whole row is a button (`aria-expanded`) with a turning chevron; the panel mounts only while open, so it can load its own data (report batches → leaderboard, at-risk groups) |
| `Banner` | `bar` (sync/offline strip, no tracking so it fits on one line), `card` (stale roster, pending sync, audit notes) and `strip` (the compact record status line); optional action button |
| `BottomSheet` | A native `<dialog>` (focus trap and Esc for free). It opens with focus on its title, never on an action, because confirmation sheets confirm something irreversible. `closeLabel` makes a reading sheet (the announcements list): the title row with a ✕ stays pinned while the list scrolls, and there is no grabber (no swipe). Anchored to the bottom edge at every size (DS), 560px wide and centred from 600px (6/8, 6/12 columns) |
| `Toast` | Polite live region above the dock |
| `BottomNav` | The journey's tabs: Home · Reports for instructors, Home · Attendance · Reports for the principal (D-052). Phones only; hidden from 600px, where the same destinations sit in the header. Profile is never a tab |
| `List grid` | `List` with `grid`: one grouped card on phones; from 640px of content, separate cards in two columns (the trade list) |
| `Skeleton` | `blocks` (plain cards), `rows` (row-shaped placeholders in one card, `leading` dot / tile / none to match the rows: roster, record, review, staff, reports, offline data) or `summary` (a headline figure, two facts and a short trend: My attendance, Institute attendance). Announces its label once (D-059) |
| `Avatar`, `IconWell`/`IconTile`, `ProgressBar`, `EmptyState`, `Spinner` | Supporting pieces. `IconWell settle` gives the result icon its small settle |
| `icons/` | 48 stroke icons extracted from the prototype (`paths.ts`) and rendered by `Icon` |

`ScreenLayout` gives every screen the same frame: header → connectivity banner → optional fixed top region (roster summary) → **the only scroller** → dock (toast, footer CTA, bottom nav). Because only the main area scrolls, the summary and CTA can never cover a student row. This is the prototype's "sticky" behaviour without `position: sticky`.

### Shell components added for wider screens and the profile menu

| Component | Phones (< 600px) | 600px and up |
|---|---|---|
| `AppHeader` | One 60px bar. Tab roots: KSK emblem, "KSK Attendance", institute; task screens: back/close + screen title. Avatar top right, always the right-most control. Demo builds: the trigger sits left of the brand on tab roots and just before the avatar, icon-only, on task screens (D-057) | 64px full-width bar aligned to the wide column: brand · the journey's tabs · avatar (the demo trigger at the start of the row). Task screens add a context row (back + title) aligned to the screen's column |
| `HeaderNav` | Hidden | Pills with icon + label (labels only below 768px); current page: brand-subtle fill, brand-subdued text, semibold; hover tint for mouse users only |
| `ProfileMenu` | Bottom sheet (DS sheet: radius xl top, grabber) | 340px menu anchored under the avatar, right edges aligned, radius lg, no scrim |
| Camera view | Portrait frame 288px (registration) / 248px (daily check), capped by screen height | Up to 480px (registration) / 320px (daily), never full-screen; instructions stay next to the frame |
| Use demo account (demo) | A dashed warning-tone box under the field, clearly presenter tooling rather than part of the form. The account list grows in place. Once an account is picked, it becomes one line: "Demo account: … · Change" | Same |
| Announcement strip | One card under the greeting: category badge (icon + word + colour: Important amber, Holiday green, OJT blue, Info grey), event date, title, "N more announcements"; the full list opens in a `BottomSheet` | Same, in the wide column |
| Batch data strip | The foot of a downloaded batch's card: "Updated 7:45 AM" (amber with an alert icon when a refresh is needed) and a quiet "Refresh data" | Same |

## Responsive behaviour

**Mobile-first is not a fixed mobile viewport (D-045).** Phones (320–599px) are the primary design and are unchanged. From the DS medium breakpoint the app fills the viewport, and content keeps a readable column. Nothing new appears on bigger screens: the same hierarchy, with more breathing room.

| DS grid | Width | Columns | Page margin | Gutter |
|---|---|---|---|---|
| Small | 320–599 | 4 | 16 | 20 |
| Medium | 600–1135 | 8 | 36 | 36 |
| Large | 1136+ | 12 | 64 | 36 |

Tokens: `--grid-*-margin` and `--page-margin` (the current breakpoint's margin); content columns `--container-form` 480, `--container-reading` 800, `--container-wide` 1008 (12 columns at 1136 minus margins), `--container-footer` 280 (DS standalone button), `--container-dialog` 560, `--container-camera` 480.

- **Frame:** header, banner, top region and footer are full-bleed bars; their content aligns to the screen's column through `--gutter-*` (see ARCHITECTURE → Screen frame). Scrollbars stay visible for mouse users from 600px.
- **Columns by screen:** form 480 (confirmations, correction, self attendance, verification); reading 800 (roster, review, record, staff, the Reports page and report view, offline data and download); wide 1008 (home, class and trade lists, the principal's Attendance board).
- **Card screens:** login steps, face intro, permission primers, result screens and stand-alone problem screens become a centred 480px card on the muted page, with the action right under the content. Problem screens inside a signed-in flow keep the app header and use `inlineFooter`, so their action also sits under the message.
- **Primary actions:** full width on phones (DS 4/4); 280px and centred from 600px (DS "standalone button", never stretched).
- **Two columns at most**, with the DS column gutter (`--page-gutter`: 20 / 36 / 36px), only where both halves stay easy to read (the brief overrides the DS 4-up card grid): home's trade overview + *My attendance*, class cards, the trade list, the principal's status cards. Reports stays one column, with each batch as a row.
- **The roster stays a row list** (name, father's name, Present/Absent) in the 800px column. Staff pills keep a 160px width instead of stretching.
- **Demo controls** take no layout space (D-047). The trigger sits in the header's tool slot, and floats only on headerless screens, the only time reserves apply (D-036, D-057).
- The target widths are 320, 360, 375, 390 and 412 for phones, and 768, 1024, 1280, 1440 and 1920 beyond. E2E checks that no width scrolls horizontally, that the pills fit the row at every phone width, and that wide screens aren't stuck at phone width or stretched (`desktop.spec.ts`).
- The roster row is a container (`container-type: inline-size`):
  - above 307px of row content, the name is on the left and Present/Absent on the right, as in the prototype;
  - at 307px or below, the pair moves under the name, full width;
  - with four or more statuses (half day, leave), the pills take a full row under the name, and at 320px or less of row content they become a 2 × 2 grid.

## Deviations from the DS and prototype (all recorded in DECISIONS.md)

- **AA contrast overrides (D-010).** `text-secondary` #5A6684, `text-tertiary` #5F6673 and `text-warning` #8A5A00 replace the DS values, which fall below 4.5:1 on white, the grey page or warning-subtle. Selection-card text uses the success text colour. On the grey page, ghost buttons use brand-subdued; filled destructive buttons use #C0392B.
- **No dropdowns on the roster (D-014).** With extra statuses the prototype used a popover. We use a full-width row of one-tap pills.
- **Every button label is 600 (D-037), and Present/Absent sit 4px apart (D-038)**, as in the prototype.
- **Selected Present pill has a visible green border (D-021).** The prototype's border matched its fill, which made it asymmetric with Absent.
- **Unselected staff pills keep their semantic colours (D-021).** This is consistent with the roster; the prototype greyed them.
- **Brand mark.** The prototype's placeholder check-mark tile is replaced by the real KSK emblem (D-003).
- **No fake phone frame or status bar.** The real device supplies them. Wider screens no longer show a phone column at all (D-045).
- **Top navigation instead of a DS side nav on wide screens (D-046).** The DS column table allows a 2/8 or 3/12 sidebar; the brief rules out a sidebar or rail for this deliberately simple product, so the primary destinations move into the header.
- **Two columns at most on wide screens (D-045).** The DS suggests 4-up card grids on desktop; the brief forbids dense grids for instructors.
