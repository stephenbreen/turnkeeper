# Turnkeeper — Design System

A design brief and token reference for **Turnkeeper**, a two-window initiative
tracker for tabletop RPG dungeon masters. This document is the source of truth
for the visual language; keep it in step with `src/index.css`,
`tailwind.config.js`, and the components. It is intended to be usable by design
tooling (e.g. the Claude `frontend-design` skill) as a brief.

---

## 1. Identity

**Concept:** the DM's screen as an illuminated tome. The interface should feel
like a well-worn Player's Handbook — parchment, ink, leather, burgundy chapter
headings, and gold illumination — not a generic dashboard. Deliberately *not*
Inter/Roboto, purple gradients, or flat neutral cards.

**Principles**
1. **Table-first legibility.** The player window is read from across a table, on
   a TV. Type is large, status is a word, the active turn is unmistakable.
2. **DM sees numbers, players see words.** Numeric HP, AC, notes, and statblocks
   are DM-only. The player view shows status words, conditions, initiative, and
   the timer. Never leak DM data into the player window (this includes the
   synced store — see `SYNC_KEYS` in `store.ts`).
3. **Theme, don't restyle.** Color flows through tokens (below). Adding a screen
   should not add new raw hex. Both light and dark must stay legible.
4. **Diegetic where it helps, plain where it counts.** Parchment/leather set the
   mood; controls stay obvious and high-contrast.

---

## 2. Color system

### Mechanism

The parchment palette is mapped onto Tailwind's **`slate`** (neutrals) and
**`indigo`** (brand accent) scales via CSS variables. Toggling `.dark` on
`<html>` swaps the variable values, flipping the whole app with **no component
changes**. Variables are space-separated RGB triples so Tailwind's
`/<alpha-value>` (e.g. `bg-slate-900/60`) keeps working.

- Definitions: `:root` (light) and `.dark` (dark) in `src/index.css`.
- Scale → variable wiring: `tailwind.config.js`.
- Runtime: `src/theme.ts` (`applyTheme`, `useTheme`), applied pre-paint in
  `src/main.tsx`; toggle in `src/components/ThemeToggle.tsx`. The choice is a
  per-window preference in `localStorage['turnkeeper-theme']` and syncs to the
  player popout via the `storage` event.

### Semantic roles (the golden rule)

`slate` numbers are **inverted from Tailwind's convention** and are semantic:

| Token | Role | Light | Dark |
|---|---|---|---|
| `slate-950` | page background | `#f0e0b8` parchment | `#16130f` warm near-black |
| `slate-900` | cards / panels | `#e8d5a7` | `#221d17` |
| `slate-800` | chips / dividers / input fills | `#c9a665` | `#362f26` |
| `slate-700` | leather borders / neutral button | `#6b5239` | `#4e4436` |
| `slate-500` | faint text | `#8b7355` | `#877962` |
| `slate-400` | muted text | `#6b5239` | `#a5967c` |
| `slate-100` | primary ink (body/headings) | `#2a1810` | `#f0e6d2` |
| `slate-50` | light ink on dark buttons | `#fdf6e3` | `#fdf6e3` |

Brand accent (`indigo`):

| Token | Role | Light | Dark |
|---|---|---|---|
| `indigo-600` | primary action / statblock burgundy | `#7c1d1d` | `#962d2d` |
| `indigo-300` | active-turn text | `#a02828` burgundy | `#d69696` warm rose |
| `indigo-400` | active-card border | `#b8860b` gold | `#c8963c` gold |
| `indigo-900` | active accent block | `#e6c270` gold | `#785c28` dim gold |
| `indigo-950` | active translucent bg | `#fbe9b4` | `#3a2f1a` |

### Fixed brand colors (do not theme)

Leather + burgundy read on both themes, so buttons are constant (`.btn`,
`.btn-primary`, `.btn-danger` in `index.css`):

- Leather `#5c4033` (neutral button), Burgundy `#7c1d1d` (primary),
  Crimson `#a02828` (danger), Ink-cream `#fdf6e3` (button text).

### Functional (status) colors

These are **real Tailwind colors**, used as "dark chip" pairs (`bg-*-900` +
`text-*-200`) or saturated fills, and are legible on both themes. Keep them
semantic:

- **Monster/NPC:** red (`bg-red-900 text-red-200`).
- **PC:** emerald (`bg-emerald-900 text-emerald-200`).
- **Conditions:** purple (`bg-purple-900/60 text-purple-200`).
- **Strategy labels / injury / timer warning:** amber (and red at the extreme).
- **HP status ramp** (`utils/hpStatus.ts`): Healthy emerald → Hurt lime →
  Bloodied amber → Dire orange → Dying red → Dead slate.
- **Statblock accent** (`--sb-heading`): burgundy `#7c1d1d` (light) / gold
  `#d9a441` (dark) — used for the creature name, field labels, and section
  headings. Bold action/trait names use ink (`text-slate-100`), not a light red
  (the old low-contrast bug). Reference via
  `text-[color:rgb(var(--sb-heading))]`.

**Do:** reach for a semantic token first; add a new `--var` (light + dark) for a
genuinely new role. **Don't:** hardcode hex in components, or put light-on-light
/ dark-on-dark text (the statblock regression). New text on a `slate-900/950`
surface should use `slate-100/200/400`.

---

## 3. Typography

- **Family:** `Cormorant Garamond` (serif), falling back to Bookman/Georgia.
  One family throughout — the bookish voice is part of the brand. No Inter.
- **Scale:** Tailwind steps. Player view goes large (round `text-6xl`, timer
  `~7rem`, names `text-2xl`); DM view is denser (`text-sm`/`text-base`).
- **Labels:** small caps via `text-[10px] uppercase tracking-wide text-slate-400`.
- **Numerics:** `tabular-nums` for HP, timer, initiative.

---

## 4. Iconography & motion

- **Icons:** per-class adventurer glyphs + monster glyph (`CombatantIcon`);
  sparing emoji for chrome (⚔ brand, 📚 library, 📜 statblock, ⚠️ trigger
  toast, 🐉 lair action, ⚡ legendary, ☾/☀ theme).
- **Motion:** purposeful and rare. Announcement banner `injury-enter` +
  `injury-shake` (keyframes in `index.css`; historical names — the banner now
  carries lair actions and player-facing notes too); the draining
  `Hourglass`; `scale-[1.01]` on the active player row. Avoid decorative
  animation elsewhere.
- **Reduced motion:** `index.css` neutralizes all animation/transition under
  `prefers-reduced-motion: reduce` — every animated state has a static
  equivalent (red timer box, red banner, big number). Any new motion must
  keep that property: never make animation the *only* carrier of information.

---

## 5. Layout & components

- **Two windows:** DM (`App.tsx`) and player (`PlayerView.tsx`), routed by
  `?view=player`. DM is a dense two-pane (initiative + tabbed dice/tables/
  settings); player is a single centered column with a giant timer.
- **Cards:** `rounded-lg border bg-slate-900`; the active combatant gets an
  `indigo-400` border + `indigo-500/30` ring + tinted bg.
- **Chips:** `text-[10px] px-1.5 py-0.5 rounded` dark-chip pairs.
- **Buttons:** `.btn` / `.btn-primary` / `.btn-danger`; ~`h-8`, `rounded`.
- **Inputs:** `.input` — parchment fill + ink text in light, dark fill + cream
  text in dark (themed via `--input-*`).
- **Modals:** `fixed inset-0 bg-black/70`, centered panel
  `bg-slate-900 border border-slate-700 rounded-lg`, own `Esc` handler. Library
  is full-height; statblock/help are scrollable.
- **Statblock** (`StatblockView`): classic 5e block — name + meta, a
  `--sb-heading` rule, AC/HP/Speed lines, a six-column ability grid on a subtle
  `slate-800/50` fill, then trait/action sections. Framed with
  `border-[color:rgb(var(--sb-heading)/0.4)]`.

---

## 6. Extending

1. Prefer an existing token. If you need a new themed role, add
   `--foo` to **both** `:root` and `.dark` in `index.css` and reference it via an
   arbitrary value (`text-[color:rgb(var(--foo))]`) or the mapped scale.
2. Every new surface must be checked in **both** themes for contrast (aim ~4.5:1
   for body text). The quick test: text on `slate-900`/`slate-950` should be
   `slate-100/200`; accents should be `--sb-heading` or `indigo`, never a light
   pastel on parchment.
3. Keep player-facing surfaces large and word-based; keep DM data out of the
   player window and out of `SYNC_KEYS`.
4. Update this document when tokens or component patterns change.
