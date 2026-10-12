# Turnkeeper

A two-panel, browser-only initiative tracker for tabletop RPG dungeon masters.
One laptop, two windows: the DM drives from the primary window and a read-only
player view is popped out onto a second monitor or TV.

No backend, no accounts, no SRD data. The DM types in the combatants they care
about, the players see what they should see, and the two views stay in sync
via `BroadcastChannel` in the same browser.

> Inspired by the layout of [Kobold+](https://koboldplus.club/), but stripped
> of SRD content and extended with per-turn timers, configurable massive-damage
> triggers, and DM-authored roll tables.

---

## Features

### Initiative and turn flow
- Add combatants (PC or monster/NPC) with the stats that matter at the table:
  name, max HP, current HP, AC, passive perception, initiative.
- Auto-sorted turn order; `Prev` / `Next` cycle turns and bump the round
  counter when wrapping.
- Current turn is highlighted on both the DM and the player panels.

### Per-turn countdown timer
- Configurable seconds-per-turn (default 60).
- Pause, resume, reset.
- At ≤10 seconds the timer flashes red.
- When it hits zero it auto-advances to the next combatant and pauses there.
- The player view shows a giant countdown number alongside an animated SVG
  hourglass that drains from the top bulb into the bottom bulb, so players at
  the far end of the table can see how much time they have left at a glance.

### HP bookkeeping
- Separate `Damage` and `Heal` inputs on each combatant card.
- HP bar and a status word (`Healthy`, `Hurt`, `Bloodied`, `Dire`, `Dying`,
  `Dead`). Players see only the status word, never numeric HP.

### Triggers (rules that roll tables)
- A **trigger** is a DM-authored rule — *"when EVENT happens → roll a table"* —
  managed in the Settings tab. Each trigger has an event, a scope (all / PCs /
  monsters), and an action (roll a table N times, or show a note).
- **Events:** a single hit dealing ≥ *X* % of max HP, a combatant dropping to
  **0 HP**, or a new **combatant being added** (e.g. roll a reinforcements
  table).
- **The injury rule, written clearly:** the 25 % / 50 % distinction is *not*
  two tables. It is **one injury table** with two triggers — ≥ 25 % rolls it
  **once**, ≥ 50 % rolls the **same table twice**. When several massive-damage
  triggers match one hit, only the highest fires.
- **Cadence:** each trigger fires *every time*, *once per turn*, or *once per
  round* per combatant — the last for an effect that should only happen once
  this round. Turn/round counters reset automatically on turn/round change
  ("Reset fired triggers" in Settings / the Encounter menu clears them manually).
- When a trigger fires, a toast prompts the DM. Players can roll the die
  physically, or a `Roll` button rolls in-app (twice for a 50 % injury).
  Injury reveals flash on the player view; combatant-added notes stay DM-only.

### DM-authored roll tables
- An **Injury Table** is seeded with editable starter entries.
- Add new tables (treasure, complications, reinforcements, whatever). Each table
  has a name, a dice expression, and a list of `range → text` entries; entries
  reorder with ▲/▼.
- **Duplicate** any table to spin a variant, and **delete** any table.
- Import / export individual tables as JSON. Point any trigger at any table.

### Prep library — Scenes, Encounters & Statblocks
- A **Library** (📚 in the header, or `L`) organises prep as **Scene → Encounter**
  — e.g. *Wishing Well* → *Goblin Ambush* / *Griffin Attack*. Ships with an
  example scene so new users can see how it works.
- Each roster line has a **quantity** that expands on load (Goblin ×4 → Goblin
  1–4) and an **initiative mode**: roll each, roll as a group (one shared roll),
  static, or keep it manual for live entry. Rolls are `1d20 + modifier`.
- **Load ▶** replaces the live fight with the encounter (rolling initiative as
  configured); **Save current fight here** captures the board back into a scene.
- **Export / import** whole scenes as JSON (bundling their statblocks).
- **Statblocks:** import [Fantasy Statblocks](https://plugins.javalent.com/statblocks/readme/code-block)
  YAML **or** 5etools / 5e.tools bestiary JSON (paste or upload) — a single
  monster, a JSON array, a bestiary `{ "monster": [ … ] }` file, or YAML
  multi-docs. 5etools array/object fields and `{@tag}` markup are converted to
  readable text automatically. Link one to a roster line or combatant; hover the
  **📜 statblock** chip for a quick line or click / expand for the full 5e-styled
  block. Statblocks are DM-only and never sync to the player view.

### Conditions and strategy labels
- Standard 5e conditions (including Exhaustion 1–6), **each with an icon** for
  quick recognition. Click **+ Add** under a combatant's Conditions to open a
  picker of the full list (icon + name) and toggle as many as you like; chosen
  conditions show as chips with an **×** to clear them, on both the DM and
  player views.
- DM-defined stackable **strategy labels** (e.g. `Surrounded 1`, `Surrounded 2`,
  `Surrounded 3`) that are visible on both the DM and player views. Purely
  informational — they do not apply mechanics automatically.

### Player-view visibility controls
- Per-combatant `Show name to players` toggle. When off, players see `???`
  instead of the real name.
- Players never see numeric HP, AC, passive perception, or DM notes — only
  the HP status word, conditions, strategy labels, and initiative order.

### Dice roller
- Preset dice buttons (`d4` – `d100` and `2d6`) plus a freeform expression
  field (`2d6+3`, `1d20-1`, `3d4+2d6+1`).
- Rolling history (last 30) with per-die results and modifier breakdown.

### Light & dark themes
- A parchment "Player's Handbook" **light** theme and a warm near-black **dark**
  theme, toggled with the **🌙 Dark / ☀️ Light** button in the header. The choice
  is remembered per window and the player popout follows the DM's toggle live.
- On desktop, the **Hide panel / Show panel** header button collapses the right
  panel (dice / tables / settings) so the initiative list gets the full width.
- The visual language (tokens, typography, both palettes) is documented in
  [`DESIGN.md`](DESIGN.md).

### Encounter persistence
- State auto-saves to `localStorage` on every change. Refreshing either window
  resumes exactly where you left off.
- `Encounter ▾` menu exports the entire encounter as JSON and imports one
  back. Good for prepping fights ahead of time.

---

## Getting started

```bash
git clone git@github.com:stephenbreen/turnkeeper.git
cd turnkeeper
npm install
npm run dev
# open http://localhost:5173/
```

Once the DM window is up, click **Player View ↗** in the header. A popup opens
at `?view=player` — drag it to your second monitor or TV and leave it there
for the session.

### Scripts

| Script             | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `npm run dev`      | Vite dev server with HMR                       |
| `npm run build`    | Typecheck + production build into `dist/`      |
| `npm run preview`  | Serve the built bundle locally                 |
| `npm run typecheck`| Just `tsc --noEmit`                            |

---

## Architecture

The goal was a no-server, zero-auth app that runs on one laptop and keeps two
windows in lockstep. Everything below falls out of that constraint.

### 1. Stack

- **Vite + React 18 + TypeScript** — fast dev loop, no SSR, no routing library.
- **Tailwind CSS** — all styling is utility-classes, no design system
  dependency.
- **Zustand** with the `persist` middleware — single global store, actions live
  next to state, automatic `localStorage` mirroring.
- **BroadcastChannel** — browser-native cross-window messaging, no polyfill.

Total runtime dependencies: `react`, `react-dom`, `zustand`. That's it.

### 2. Two views, one bundle

The app ships as a single HTML/JS bundle served by Vite. `src/main.tsx`
inspects the URL at boot:

```ts
const isPlayerView =
  new URLSearchParams(location.search).get('view') === 'player' ||
  location.hash === '#player'
```

If `view=player`, it mounts `<PlayerView />`. Otherwise it mounts `<App />`
(the DM panel). The DM's **Player View ↗** button opens a new window at
`?view=player`, which the OS / browser lets you drag to a second monitor.

Keeping it one bundle means one dev server, one deploy target, and one source
of truth for the store definition.

### 3. State: single Zustand store

`src/store.ts` defines one store that owns the entire encounter:

```
EncounterState = {
  combatants: Combatant[]
  currentTurnIndex, round
  timerSeconds, timerRemaining, timerRunning
  triggers: Trigger[]               // rules: "when EVENT → roll a table"
  strategyLabelNames: string[]      // e.g. ['Surrounded']
  tables: RollTable[]
  triggerResults: TriggerResult[]   // pending toasts (synced, not persisted)
  scenes: Scene[]                   // prep library (DM-only, not synced)
  statblocks: Statblock[]           // prep library (DM-only, not synced)
}
```

All mutations go through named actions (`applyDamage`, `nextTurn`,
`toggleCondition`, …) colocated with the state. Components subscribe with
selectors (`useStore(s => s.combatants)`) so re-renders are surgical.

`triggerResults` — the pending toasts — is broadcast but **not** persisted,
so the DM never reopens into a stale injury prompt. The player window
receives it too, but `PlayerInjuryBanner` only renders injury-type reveals;
DM-facing events (combatant added, plain notifications) are filtered out.

### 4. Persistence: Zustand's `persist` middleware

Every state change is mirrored into `localStorage` under
`turnkeeper-encounter`. The `partialize` allow-list (`PERSIST_KEYS` in
`store.ts`) deliberately keeps `triggerResults` out, so the DM never
reopens into a stale toast.

On startup, Zustand rehydrates synchronously from `localStorage`, so the UI
renders the last known state before anything else touches the network.

### 5. Cross-window sync: `BroadcastChannel`

A module-level block at the bottom of `src/store.ts` wires up a channel
called `turnkeeper-sync` and subscribes to the store.

**Broadcast path (DM → player):**

```
DM action  →  zustand set()  →  subscribe() fires  →  snapshot the data
                                                  →  postMessage on channel
                                                  →  player's onmessage
                                                  →  useStore.setState(snapshot)
                                                  →  player UI re-renders
```

Three subtleties worth knowing about:

1. **Who owns the clock.** Only the DM window mounts `<Timer />`, which holds
   the `setInterval` that ticks `timerRemaining` down each second. The player
   window just displays whatever it receives. One clock, no drift, no "whose
   `setInterval` wins" race.
2. **No echo loop.** When the player receives a message and calls
   `setState`, a `receiving` flag is set first so the player's own subscribe
   callback doesn't immediately re-broadcast what it just got.
3. **Late joiners.** When a new window (e.g. the popup) opens, it posts
   `{ type: 'request' }` 100 ms after load. Any other window responds with its
   current snapshot. Combined with `localStorage` rehydration, this means the
   player view always catches up — even if it opens mid-combat.

The hourglass animates smoothly between integer-second ticks via CSS
transitions on the SVG `<rect>` `y` and `height` attributes (1 s linear), so
the sand drain looks continuous despite the state updating once per second.

### 6. Trigger flow

When the DM clicks `Damage` with an amount `d` on a combatant with `maxHP m`:

1. `applyDamage(id, d)` computes `pct = d / m * 100`.
2. It gathers every enabled, in-scope massive-damage trigger whose threshold
   `t` satisfies `pct ≥ t` and whose dedupe window allows it, then fires
   **only the highest** — a 60% hit fires the 50% trigger, not the 25% one.
3. The combatant's HP is reduced and the trigger's id is recorded in
   `firedTriggers` / `firedTriggersRound` (per its `always` / `perTurn` /
   `perRound` cadence) so it cannot re-fire inside that window. Windows
   reset automatically on turn / round change.
4. A `TriggerResult` is queued, which renders `<InjuryToast />` on the DM
   panel; `hpReachedZero` and concentration events queue the same way.
5. The toast's `Roll` button evaluates the trigger's table dice expression
   (`rollExpression`) and looks up the matching range entry — twice for a
   50% grievous wound, showing every individual roll. Rolled results also
   flash on the player view.
6. `Encounter ▾ → Reset injury triggers` clears both fired-trigger arrays
   for every combatant — useful after a long rest.

### 7. File layout

```
src/
├── main.tsx              URL router → App or PlayerView
├── App.tsx               DM shell (header + split panel)
├── PlayerView.tsx        Read-only player popout
├── store.ts              Zustand store + persist + BroadcastChannel sync
├── theme.ts              Light/dark theme per window (localStorage + storage event)
├── types.ts              Combatant, Trigger, RollTable, Statblock, EncounterState
├── data/
│   ├── conditions.ts     Standard 5e conditions list
│   ├── defaultState.ts   Starter tables + triggers + empty encounter
│   ├── encounter.ts      Roster → combatant expansion + initiative modes
│   ├── migrate.ts        Bring old persisted saves up to the current schema
│   ├── party.ts          Reusable PC roster import/export
│   ├── playerClasses.ts  PC class icons
│   └── presets.ts        Example scene + statblocks seeded on first run
├── utils/
│   ├── dice.ts           rollExpression + matchTableEntry
│   ├── hpStatus.ts       HP → word status + colour class
│   ├── id.ts             Opaque ids for combatants / entries / tables
│   ├── names.ts          Duplicate / bulk-add name collision helpers
│   └── statblock.ts      Javalent YAML + 5etools JSON → normalised statblock
└── components/
    ├── Timer.tsx                  DM-side countdown with pause / reset
    ├── Hourglass.tsx              SVG hourglass used on player view
    ├── InitiativeList.tsx         Renders the ordered list of cards
    ├── CombatantCard.tsx          Expandable card: damage, heal, conditions, …
    ├── AddCombatantModal.tsx      Add a PC / monster (with bulk quantity)
    ├── DiceRoller.tsx             Preset buttons + freeform expression
    ├── TablesPanel.tsx            List + editor for roll tables
    ├── SettingsPanel.tsx          Triggers + strategy label management
    ├── LibraryModal.tsx           Scenes, encounters, rosters & statblocks
    ├── StatblockView.tsx          Classic 5e-styled statblock renderer
    ├── InjuryToast.tsx            DM toast when a trigger fires
    ├── PlayerInjuryBanner.tsx     Player-side injury reveal
    ├── EncounterMenu.tsx          New / Reset triggers / Import / Export / party
    └── HelpModal.tsx              Keyboard shortcuts + walkthrough
```

### 8. Explicit non-goals (for v1)

- **Multi-device / hosted play.** BroadcastChannel is same-origin,
  same-browser only. Two devices would need a tiny Node/WebSocket server.
- **Per-player views.** The popout is a single shared player screen, not one
  view per player.
- **Built-in monster library.** Intentional — import your own statblocks
  (Javalent YAML or 5etools JSON) or type in the combatants you care about.
- **Undo.** Save / export encounter JSON instead.

---

## License

MIT — see [LICENSE](LICENSE).
