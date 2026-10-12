import { newId } from '../utils/id'
import { buildPresetLibrary } from './presets'
import type { EncounterState } from '../types'

// Bring a persisted encounter blob up to the current schema. Idempotent and
// version-agnostic — safe to run on any older save. Historical shapes:
//
//   v0: hard-coded `thresholds: number[]` + `builtIn` injury tables +
//       `combatant.firedThresholds`.
//   v1: first-class `triggers` with a boolean `oncePerTurn`.
//   v2: (dedupe cadences — no persisted-shape change)
//   v3: `scenes` / `statblocks` prep library.
//   v4: `tempHP`, `deathSaves`, `concentration`, timed conditions.
//   v5: positional `currentTurnIndex` → `currentCombatantId`, so re-sorting
//       the list can never move the turn marker onto a different combatant.
//
// Existing behaviour is preserved: each old threshold becomes one trigger
// pointed at the table it used to fire, and `oncePerTurn` maps to
// `dedupe: 'perTurn'`. Kept dependency-free so it can be unit tested without
// loading the zustand store.
export function migratePersisted(persisted: unknown): EncounterState {
  const s = (persisted ?? {}) as Record<string, unknown>

  // v0 → triggers
  if (!Array.isArray(s.triggers)) {
    const tables = Array.isArray(s.tables) ? (s.tables as Record<string, unknown>[]) : []
    const thresholds = Array.isArray(s.thresholds) ? (s.thresholds as number[]) : [25, 50]
    const findTable = (builtIn: string, label: number) =>
      tables.find((t) => t.builtIn === builtIn) ??
      tables.find((t) =>
        String(t.name ?? '').toLowerCase().includes(`injury ${label}`)
      ) ??
      tables[0]
    s.triggers = [...thresholds]
      .sort((a, b) => a - b)
      .map((t) => {
        const tbl = t >= 50 ? findTable('injury50', 50) : findTable('injury25', 25)
        return {
          id: newId(),
          name: t >= 50 ? 'Grievous Wound (50%)' : `Injury (${t}%)`,
          enabled: true,
          scope: 'any',
          dedupe: 'perTurn',
          event: { kind: 'massiveDamage', percentOfMax: t },
          action: { kind: 'rollTable', tableId: (tbl?.id as string) ?? null, rolls: 1 },
        }
      })
  }
  delete s.thresholds

  // v1 `oncePerTurn` boolean → `dedupe` cadence, and backfill any missing dedupe.
  s.triggers = (s.triggers as Record<string, unknown>[]).map((t) => {
    const copy = { ...t }
    if (copy.dedupe == null) {
      copy.dedupe = copy.oncePerTurn === false ? 'always' : 'perTurn'
    }
    delete copy.oncePerTurn
    return copy
  })

  if (Array.isArray(s.tables)) {
    s.tables = (s.tables as Record<string, unknown>[]).map((t) => {
      const copy = { ...t }
      delete copy.builtIn
      return copy
    })
  }
  if (Array.isArray(s.combatants)) {
    s.combatants = (s.combatants as Record<string, unknown>[]).map((c) => {
      const copy = { ...c }
      delete copy.firedThresholds
      copy.firedTriggers = Array.isArray(c.firedTriggers) ? c.firedTriggers : []
      copy.firedTriggersRound = Array.isArray(c.firedTriggersRound)
        ? c.firedTriggersRound
        : []
      // v4: temp HP, death saves, concentration, and timed conditions.
      copy.tempHP = typeof c.tempHP === 'number' ? c.tempHP : 0
      copy.deathSaves =
        c.deathSaves && typeof c.deathSaves === 'object'
          ? c.deathSaves
          : { successes: 0, failures: 0 }
      copy.concentration = typeof c.concentration === 'string' ? c.concentration : null
      // Conditions became objects (id + rounds + saveEnds); upgrade old strings.
      copy.conditions = Array.isArray(c.conditions)
        ? c.conditions.map((x) =>
            typeof x === 'string' ? { id: x, rounds: null, saveEnds: false } : x
          )
        : []
      return copy
    })
  }
  s.triggerResults = []

  // v5: positional currentTurnIndex → currentCombatantId. Clamp the old index
  // to the list so a stale save can't point past the end.
  if (typeof s.currentCombatantId !== 'string') {
    const list = Array.isArray(s.combatants) ? s.combatants : []
    const idx = typeof s.currentTurnIndex === 'number' ? s.currentTurnIndex : 0
    const clamped = list.length
      ? Math.min(Math.max(0, idx), list.length - 1)
      : -1
    s.currentCombatantId =
      clamped >= 0 ? ((list[clamped] as Record<string, unknown>).id as string) ?? null : null
  }
  delete s.currentTurnIndex

  // Prep library (scenes + statblocks) is new in v3 — seed example content for
  // encounters that predate it so users still see how it works.
  if (!Array.isArray(s.scenes) || !Array.isArray(s.statblocks)) {
    const lib = buildPresetLibrary()
    if (!Array.isArray(s.scenes)) s.scenes = lib.scenes
    if (!Array.isArray(s.statblocks)) s.statblocks = lib.statblocks
  }

  return s as unknown as EncounterState
}
