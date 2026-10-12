# CLAUDE.md

Guidance for working in this repository.

## What this is

**Turnkeeper** is a browser-only initiative tracker for tabletop RPG dungeon
masters. No backend, no accounts, no SRD data. Two views run in two windows of
the same browser:

- **DM panel** (`src/App.tsx`) — drives turns, HP, tables, settings.
- **Player view** (`src/PlayerView.tsx`) — read-only, popped onto a second
  monitor/TV. Players never see numeric HP, AC, passive perception, or notes.

The two windows share one store and stay in sync via `BroadcastChannel`. State
persists to `localStorage`.

## Stack

React 18 · TypeScript (strict) · Vite · Zustand (with `persist`) · Tailwind CSS.
No router (view is chosen by URL param), no test runner, no linter configured.

## Commands

```bash
npm run dev        # Vite dev server at localhost:5173 (base '/')
npm run build      # tsc -b && vite build  — THE gate that must stay green
npm run preview    # serve the production build
npm run typecheck  # tsc -b --noEmit
npm test           # vitest run — unit tests
npm run test:watch # vitest in watch mode
```

- **`npm run build` is the real check.** Run it after any change.
- **Tests** are colocated (`src/**/*.test.ts`) and run under vitest. Default
  environment is `node` — the tested core (dice, names, migrate, party,
  encounter, statblock) is pure by design; keep it that way. Store-level tests
  (`src/store.test.ts`) opt into `jsdom` with a `@vitest-environment` pragma
  because the persist middleware needs `localStorage`. When you add a pure
  helper, add a test next to it; prefer exercising the store through its
  actions in `store.test.ts`.
- `npm run typecheck` currently prints a non-fatal `TS6310` about
  `tsconfig.node.json` disabling emit. It is noise; `build` still succeeds.
  Don't "fix" it by chasing the warning unless build actually breaks.
- Deploy is automatic to GitHub Pages via `.github/workflows/deploy.yml`. The
  production `base` is `/turnkeeper/` (see `vite.config.ts`); dev base is `/`.

## Architecture

- **Single source of truth: `src/store.ts`** — one Zustand store holding the
  entire `EncounterState` plus all actions. Components subscribe with
  selectors (`useStore((s) => s.field)`); they do not hold domain state.
- **Persistence:** `persist` middleware with a `partialize` allow-list. Only
  the fields listed there survive a reload (transient UI like `lastTrigger`
  is intentionally excluded).
- **Cross-window sync:** at the bottom of `store.ts`. After every local change
  a `snapshot()` is broadcast; incoming snapshots are applied with a
  `receiving` guard to avoid echo loops. A `request`/`state` handshake lets a
  freshly opened popout pull current state.
- **View routing:** `src/main.tsx` renders `PlayerView` when
  `?view=player` or `#player` is present, else `App`.
- **Entry data:** `src/data/` holds the seed/default content
  (`defaultState.ts`, `conditions.ts`, `playerClasses.ts`).

### ⚠️ Adding a field to `EncounterState`

Persistence and cross-window sync are driven by two key arrays near the top of
`store.ts`:

- `PERSIST_KEYS` — written to `localStorage` (durable state).
- `SYNC_KEYS` — broadcast to the player window.

These two lists are **not** subset-of each other:
- `triggerResults` syncs but is **not** persisted (transient injury queue).
- `scenes` and `statblocks` (the prep library) **persist but do NOT sync** —
  they're DM-only, which also keeps monster stats off the player window
  entirely. A combatant's `statblockId` does sync, but the statblock content
  stays DM-side.

Add your new field to whichever apply. If you change the persisted *shape*,
bump `version` in the `persist` options and extend `migratePersisted` in
`src/data/migrate.ts` (kept light so it's unit-testable without loading the
store). Current schema is **v5** (v0 thresholds → triggers; v1 `oncePerTurn` →
`dedupe`; v3 seeds the `scenes`/`statblocks` library; v4 temp HP/death
saves/concentration/timed conditions; v5 `currentTurnIndex` →
`currentCombatantId`).

## Domain model (`src/types.ts`)

- `Combatant` — `pc` | `monster`, with HP/AC/PP/initiative, `conditions`
  (5e status ids), `strategyLabels` (stackable DM tags), `firedThresholds`.
- `RollTable` / `TableEntry` — DM-authored tables. `range` is a string like
  `"1-5"` or `"20"`, matched by `matchTableEntry` in `utils/dice.ts`.
  `builtIn?: 'injury25' | 'injury50'` marks the seeded injury tables.
- **Massive-damage triggers** are NOT a stored entity. They are computed in
  `applyDamage`: a single hit ≥ a `thresholds[]` percent of max HP sets
  `lastTrigger` (transient), which `InjuryToast` (DM) and `PlayerInjuryBanner`
  (player) render. `firedThresholds` makes each threshold fire at most once
  per combatant per turn; it is cleared on every turn change.

### Prep library & statblocks

- **Scene → Encounter → roster.** `scenes: Scene[]` is DM prep, separate from the
  live `combatants`. A `RosterEntry` has a `quantity` and an `InitiativeMode`
  (`roll-each` / `roll-group` / `static` / `manual`). `loadEncounter` calls
  `expandRoster` (`src/data/encounter.ts`) to turn a roster into live combatants,
  rolling initiative, then **replaces** the current combatants.
- Nested scene edits go through a single `updateScene(id, patch)` — the UI
  (`LibraryModal.tsx`) computes new `encounters` / `roster` arrays and passes
  them in, keeping the store surface small.
- **Statblocks** are parsed by `src/utils/statblock.ts` (`parseStatblocks`, uses
  **`js-yaml`**) which **auto-detects two schemas**: Fantasy Statblocks (Javalent)
  YAML/JSON *and* 5etools/5e.tools bestiary JSON. `normalizeStatblock` coerces
  5etools array/object fields (ac/hp/speed/size/alignment/senses+passive),
  `entries[]`, `spellcasting`, and strips `{@tag ...}` markup to plain text; it's
  tolerant of partial data. `statblockAC/HP/InitMod` derive numbers for combatant
  prefill. Rendered by `StatblockView.tsx`. Add new formats here, not in the UI.
- Preset content lives in `src/data/presets.ts` (`buildPresetLibrary`), seeded by
  both `buildDefaultEncounter` and the v3 migration.

### Terminology caution

The word **"conditions"** in this codebase means **5e status effects**
(`src/data/conditions.ts`: blinded, prone, …). Do not overload it. If you add
an event/rule system that fires table rolls, name it something else
(e.g. **triggers** / **trigger rules**) to avoid colliding with this.

## Theming (light + dark)

Read **`DESIGN.md`** before any visual change — it's the token reference and
design brief.

- The PHB parchment palette is mapped onto the **`slate`** (neutrals) and
  **`indigo`** (accent) scales via **CSS variables** (`:root` = light,
  `.dark` = dark, in `src/index.css`; wired in `tailwind.config.js`). Toggling
  `.dark` on `<html>` flips the whole app — **don't** add per-component `dark:`
  variants for color.
- `slate` numbers are semantic and *inverted*: **low = ink/text, high =
  surfaces** (so `bg-slate-950` is the page, `text-slate-100` is body ink) — and
  they stay that way in both themes.
- Theme is a per-window pref in `localStorage['turnkeeper-theme']`
  (`src/theme.ts`), applied pre-paint in `main.tsx`, toggled by
  `ThemeToggle`, and synced to the player window via the `storage` event. It is
  **not** in the encounter store.
- New color must be a token (existing scale or a new `--var` added to *both*
  `:root` and `.dark`) — never raw hex in a component — and must be checked for
  contrast in both themes (the statblock's light-red-on-parchment was the bug
  this system fixes; use `--sb-heading` for statblock accents).

## Conventions

- **Styling:** Tailwind utilities inline. Shared component classes
  (`.btn`, `.btn-primary`, `.btn-danger`, `.input`) live in `src/index.css`
  under `@layer components`. Match the parchment/leather/burgundy theme — no
  default-blue buttons. See DESIGN.md for tokens.
- **IDs:** always `newId()` from `src/utils/id.ts`. Never `Date.now()`/index.
- **Dice:** parse/evaluate only through `utils/dice.ts` (`rollExpression`,
  `matchTableEntry`). It supports `2d6+3`, `3d4+2d6+1`, `d20-1`, etc.
- **Immutability:** all store updates return new arrays/objects; combatants are
  re-sorted by initiative (`sortByInit`) on add/update.
- **Modals/keyboard:** global shortcuts live in `App.tsx`'s `keydown` handler
  and are suppressed while typing in inputs or while a modal is open. Each
  modal owns its own Esc handling.

## Gotchas

- **`currentCombatantId` is an id, not a position.** The turn marker is
  immune to re-sorting: adding reinforcements or editing a combatant's
  initiative mid-combat may reorder the list, but it can no longer slide the
  marker onto a different combatant. `removeCombatant` hands the turn to the
  next combatant in order when the active one is removed. null means combat
  hasn't started; the first combatant added (or the top of a loaded
  encounter's order) becomes current.
- **Player view is read-only** but shares the same store instance via sync —
  never add write actions reachable from `PlayerView`.
- **`alert`/`confirm`/`prompt`** are used for quick dialogs (e.g. table
  create/delete). Fine for now, but don't add them in flows that the player
  popout could hit.
- **Any popover/dropdown inside the initiative list must use a portal.** The
  list is an `overflow-y-auto` container, so an `absolute` menu is clipped.
  Render it via `createPortal` to `document.body`, position it from the button's
  `getBoundingClientRect`, and close on outside-click / `Esc` / scroll. (The
  conditions picker sidesteps this by being a centered **modal** —
  `ConditionsModal` in `CombatantCard.tsx`, `position: fixed` so overflow can't
  clip it — but keep the portal rule in mind for anchored menus.)
- The right panel collapse (desktop) is App-local state persisted to
  `localStorage['turnkeeper-sidepanel']` — separate from the encounter store.
- No tests exist. Verify changes by running the app (`npm run dev`) and, for
  sync/persistence work, opening the player view (`?view=player`) in a second
  window.
