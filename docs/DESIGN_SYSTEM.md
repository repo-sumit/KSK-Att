# Design system

The source of truth is `Doc/swiftchat-design-system.md` (SwiftChat DS) together with the approved `prototype/Prototype.html`. This document explains how the codebase applies them and lists every deliberate deviation. **Do not add new colours, fonts, radii or type sizes. Use the tokens.**

## Files

| File | Role |
|---|---|
| `src/styles/tokens.css` | DS primitives (primary blue, neutrals, secondary palette) → semantic tokens (background, text, icon, interactive, border, status, selection card), plus spacing, radius, dividers, touch sizes, layering and motion |
| `src/styles/typography.css` | DS text styles as `--type-*` (the `font` shorthand) and `--ls-*` (letter spacing). Marathi twins under `:root:lang(mr)` |
| `src/styles/globals.css` | Reset, focus ring, `.visually-hidden`, keyframes, reduced motion, print rules |
| `src/components/ui/*` | The kit: every screen is built from these |
| `src/components/shell/*` | `ScreenLayout`, headers, connectivity banner, bottom nav, session gate |

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
- **Motion:** 80–200ms with no decorative animation. `prefers-reduced-motion` disables animation.

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
| `Button` | Variants: primary, secondary (outline), ghost, destructive, inverse. Sizes: lg 56, md 44, sm 36 (sm is for inline use only). `inactive` + `onInactivePress` keeps the button focusable and explains why it can't be used yet |
| `IconButton` | 44px circle; always carries a `label` |
| `Input` | 52px pill with a linked `<label>`; the error has `role="alert"` and is tied to the field with `aria-describedby` |
| `Segmented` | `radiogroup` with arrow-key support; the small size keeps its look but its tap area reaches 44px |
| `StatusPill` | One-tap status buttons (`aria-pressed`). The icon appears only when pressed. `stretch` shares the row width |
| `StatusChip`, `Badge` | Read-only status or labels |
| `ChoicePill`, `SelectionCard` | Follow-up choices (half, leave type) and correction choices |
| `StatTiles` | Three-up totals with tabular numerals. Surfaces: `hero` (tinted on white), `raised` (tinted on grey), `plain` (white tiles, tone in the text only: the staff view) |
| `Card`, `PressableCard`, `ListRow`/`List`, `DetailRows`, `Section` | Content structure |
| `Banner` | `bar` (sync/offline strip, no tracking so it fits on one line), `card` (stale roster, pending sync, audit notes) and `strip` (the compact record status line); optional action button |
| `BottomSheet` | A native `<dialog>` (focus trap and Esc for free). It opens with focus on its title, never on an action, because every sheet confirms something irreversible |
| `Toast` | Polite live region above the dock |
| `BottomNav` | 4 tabs; the Reports tab disappears when no report block is enabled |
| `Avatar`, `IconWell`/`IconTile`, `ProgressBar`, `Skeleton`, `EmptyState`, `Spinner` | Supporting pieces |
| `icons/` | 48 stroke icons extracted from the prototype (`paths.ts`) and rendered by `Icon` |

`ScreenLayout` gives every screen the same frame: header → connectivity banner → optional fixed top region (roster summary) → **the only scroller** → dock (toast, footer CTA, bottom nav). Because only the main area scrolls, the summary and CTA can never cover a student row. This is the prototype's "sticky" behaviour without `position: sticky`.

## Responsive behaviour

- The app column is at most 412px wide and centred. Wider screens show it as a framed column (the demo panel docks beside it at ≥ 1024px).
- The target widths are 320, 360, 375, 390 and 412, plus 768. E2E checks that no width scrolls horizontally, and that the status pills fit the row at every phone width.
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
- **No fake phone frame or status bar.** The real device supplies them.
