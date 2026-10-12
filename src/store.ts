import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  ActiveCondition,
  Combatant,
  CombatantType,
  EncounterState,
  EncounterTemplate,
  RollTable,
  RosterEntry,
  Scene,
  Statblock,
  Trigger,
  TriggerResult,
  TriggerRoll,
  TriggerScope,
} from './types'
import { buildDefaultEncounter } from './data/defaultState'
import { expandRoster } from './data/encounter'
import { migratePersisted } from './data/migrate'
import { newId } from './utils/id'
import { nextName } from './utils/names'
import { rollExpression, matchTableEntry } from './utils/dice'

// ---------- Trigger engine helpers ----------

const scopeMatches = (scope: TriggerScope, type: CombatantType): boolean =>
  scope === 'any' || scope === type

// Decrement timed conditions by one round and drop any that expire. Untimed
// (rounds === null) conditions are untouched.
const tickConditions = (conds: ActiveCondition[]): ActiveCondition[] =>
  conds
    .map((x) => (x.rounds == null ? x : { ...x, rounds: x.rounds - 1 }))
    .filter((x) => x.rounds == null || x.rounds > 0)

// Has this trigger NOT yet fired for this combatant within its dedupe window?
const triggerEligible = (t: Trigger, c: Combatant): boolean => {
  if (t.dedupe === 'perTurn') return !c.firedTriggers.includes(t.id)
  if (t.dedupe === 'perRound') return !c.firedTriggersRound.includes(t.id)
  return true // 'always'
}

// Build a pending TriggerResult for a fired trigger. Rolls are NOT performed
// here — the DM (or a player) rolls via the toast, matching the existing
// "players roll the die physically" flow.
function buildResult(
  trigger: Trigger,
  combatant: Combatant | null,
  tables: RollTable[],
  ctx: { damage?: number; pct?: number }
): TriggerResult {
  const action = trigger.action
  let tableId: string | null = null
  let tableName: string | null = null
  let dice: string | null = null
  let rollsRequested = 0
  let notifyText: string | undefined
  if (action.kind === 'rollTable') {
    tableId = action.tableId
    const table = tables.find((t) => t.id === action.tableId)
    tableName = table?.name ?? null
    dice = table?.dice ?? null
    rollsRequested = Math.max(1, action.rolls)
  } else {
    notifyText = action.text
  }
  return {
    id: newId(),
    triggerId: trigger.id,
    triggerName: trigger.name,
    eventKind: trigger.event.kind,
    combatantId: combatant?.id ?? null,
    combatantName: combatant?.name ?? '',
    damage: ctx.damage,
    pct: ctx.pct,
    percentThreshold:
      trigger.event.kind === 'massiveDamage' ? trigger.event.percentOfMax : undefined,
    tableId,
    tableName,
    dice,
    rollsRequested,
    rolls: [],
    notifyText,
  }
}

type Actions = {
  addCombatant: (c: Partial<Combatant>) => void
  addCombatants: (list: Partial<Combatant>[]) => void
  duplicateCombatant: (id: string) => void
  updateCombatant: (id: string, patch: Partial<Combatant>) => void
  removeCombatant: (id: string) => void
  applyDamage: (id: string, amount: number) => void
  applyHeal: (id: string, amount: number) => void
  recordDeathSave: (id: string, kind: 'successes' | 'failures', value: number) => void
  nextTurn: () => void
  previousTurn: () => void
  toggleCondition: (id: string, conditionId: string) => void
  setCondition: (
    id: string,
    conditionId: string,
    patch: Partial<Pick<ActiveCondition, 'rounds' | 'saveEnds'>>
  ) => void
  addStrategyLabel: (name: string) => void
  removeStrategyLabel: (name: string) => void
  setStrategyStack: (id: string, name: string, n: number) => void
  setTimerSeconds: (seconds: number) => void
  setTimerRunning: (running: boolean) => void
  tickTimer: () => void
  resetTimer: () => void
  replaceState: (state: Partial<EncounterState>) => void
  resetEncounter: () => void
  clearFiredTriggers: () => void
  addTable: (t: Omit<RollTable, 'id'>) => string
  duplicateTable: (id: string) => string | null
  updateTable: (id: string, patch: Partial<RollTable>) => void
  removeTable: (id: string) => void
  addTrigger: (t: Omit<Trigger, 'id'>) => string
  updateTrigger: (id: string, patch: Partial<Trigger>) => void
  removeTrigger: (id: string) => void
  rollTriggerResult: (resultId: string) => void
  dismissTriggerResult: (resultId: string) => void
  clearTriggerResults: () => void
  // Prep library
  addScene: () => string
  updateScene: (id: string, patch: Partial<Scene>) => void
  removeScene: (id: string) => void
  importScene: (raw: unknown) => void
  loadEncounter: (sceneId: string, encounterId: string) => void
  saveCurrentAsEncounter: (sceneId: string, name: string) => void
  addStatblocks: (statblocks: Statblock[]) => void
  updateStatblock: (id: string, patch: Partial<Statblock>) => void
  removeStatblock: (id: string) => void
}

export type Store = EncounterState & Actions

// Durable fields written to localStorage.
const PERSIST_KEYS = [
  'combatants',
  'currentTurnIndex',
  'round',
  'timerSeconds',
  'timerRemaining',
  'timerRunning',
  'triggers',
  'strategyLabelNames',
  'tables',
  'scenes',
  'statblocks',
] as const

// Fields broadcast to the player window. Note: `scenes` and `statblocks` are
// DM-only prep material and are deliberately NOT synced (keeps monster stats off
// the player screen entirely); `triggerResults` is synced but not persisted.
const SYNC_KEYS = [
  'combatants',
  'currentTurnIndex',
  'round',
  'timerSeconds',
  'timerRemaining',
  'timerRunning',
  'triggers',
  'strategyLabelNames',
  'tables',
  'triggerResults',
] as const

function pick<K extends keyof EncounterState>(
  state: EncounterState,
  keys: readonly K[]
): Pick<EncounterState, K> {
  const out = {} as Pick<EncounterState, K>
  for (const k of keys) out[k] = state[k]
  return out
}

const sortByInit = (combatants: Combatant[]) =>
  [...combatants].sort((a, b) => b.initiative - a.initiative)

// Build a full Combatant from a partial, filling every field with a sane
// default and a fresh id. Shared by addCombatant and the bulk addCombatants
// (party import) so imported combatants always match the current shape.
function buildCombatant(c: Partial<Combatant>): Combatant {
  return {
    id: newId(),
    name: c.name ?? 'Unnamed',
    type: c.type ?? 'monster',
    maxHP: c.maxHP ?? 10,
    currentHP: c.currentHP ?? c.maxHP ?? 10,
    tempHP: 0,
    AC: c.AC ?? 10,
    passivePerception: c.passivePerception ?? 10,
    initiative: c.initiative ?? 10,
    deathSaves: { successes: 0, failures: 0 },
    concentration: null,
    conditions: [],
    strategyLabels: {},
    notes: c.notes ?? '',
    nameVisibleToPlayers: c.nameVisibleToPlayers ?? c.type === 'pc',
    isDead: false,
    firedTriggers: [],
    firedTriggersRound: [],
    playerClass: c.playerClass,
    statblockId: c.statblockId,
  }
}

// One-time handoff from the pre-rename storage key so an in-flight encounter
// survives the rebrand. Idempotent: only copies when the new key is absent.
try {
  const legacy = localStorage.getItem('the-breaking-encounter')
  if (legacy && !localStorage.getItem('turnkeeper-encounter')) {
    localStorage.setItem('turnkeeper-encounter', legacy)
  }
} catch {
  /* localStorage unavailable — start fresh */
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...buildDefaultEncounter(),

      addCombatant: (c) =>
        set((s) => {
          const newCombatant = buildCombatant(c)
          // Fire any "when a combatant is added" triggers (e.g. roll on a
          // random-encounter / reinforcements table).
          const results: TriggerResult[] = []
          for (const t of s.triggers) {
            if (
              t.enabled &&
              t.event.kind === 'combatantAdded' &&
              scopeMatches(t.scope, newCombatant.type)
            ) {
              results.push(buildResult(t, newCombatant, s.tables, {}))
            }
          }
          return {
            combatants: sortByInit([...s.combatants, newCombatant]),
            triggerResults: results.length
              ? [...s.triggerResults, ...results]
              : s.triggerResults,
          }
        }),

      // Append several combatants at once (e.g. importing a saved party).
      // Deliberately does NOT fire `combatantAdded` triggers — a bulk party
      // import shouldn't roll a reinforcements table once per player.
      addCombatants: (list) =>
        set((s) => ({
          combatants: sortByInit([...s.combatants, ...list.map(buildCombatant)]),
        })),

      // Duplicate a combatant as a fresh full-HP copy (a reinforcement): same
      // sheet, auto-incremented name, no carried-over combat state. Like
      // addCombatants, it does not fire combatantAdded triggers.
      duplicateCombatant: (id) =>
        set((s) => {
          const c = s.combatants.find((x) => x.id === id)
          if (!c) return {}
          const copy = buildCombatant({
            name: nextName(c.name, s.combatants.map((x) => x.name)),
            type: c.type,
            maxHP: c.maxHP,
            AC: c.AC,
            passivePerception: c.passivePerception,
            initiative: c.initiative,
            playerClass: c.playerClass,
            statblockId: c.statblockId,
            nameVisibleToPlayers: c.nameVisibleToPlayers,
            notes: c.notes,
          })
          return { combatants: sortByInit([...s.combatants, copy]) }
        }),

      updateCombatant: (id, patch) =>
        set((s) => ({
          combatants: sortByInit(
            s.combatants.map((c) => (c.id === id ? { ...c, ...patch } : c))
          ),
        })),

      removeCombatant: (id) =>
        set((s) => {
          const combatants = s.combatants.filter((c) => c.id !== id)
          const currentTurnIndex = Math.min(
            s.currentTurnIndex,
            Math.max(0, combatants.length - 1)
          )
          return { combatants, currentTurnIndex }
        }),

      applyDamage: (id, amount) => {
        if (amount <= 0) return
        const s = get()
        const c = s.combatants.find((x) => x.id === id)
        if (!c) return

        const prevHP = c.currentHP
        // Temp HP absorbs first; only the overflow reduces real HP. Massive-
        // damage % still uses the full hit (a big hit is a big hit).
        const absorbedByTemp = Math.min(c.tempHP, amount)
        const newTempHP = c.tempHP - absorbedByTemp
        const newHP = Math.max(0, prevHP - (amount - absorbedByTemp))
        const pct = (amount / Math.max(1, c.maxHP)) * 100

        const newResults: TriggerResult[] = []
        const firedTurn: string[] = []
        const firedRound: string[] = []
        const record = (t: Trigger) => {
          if (t.dedupe === 'perTurn') firedTurn.push(t.id)
          else if (t.dedupe === 'perRound') firedRound.push(t.id)
        }

        // Massive-damage triggers: gather every enabled, in-scope, not-yet-fired
        // threshold this hit clears, then fire ONLY the highest one. A 60% hit
        // fires the 50% trigger (roll twice), not the 25% trigger.
        const massive = s.triggers
          .filter(
            (t) =>
              t.enabled &&
              t.event.kind === 'massiveDamage' &&
              scopeMatches(t.scope, c.type) &&
              pct >= (t.event as { percentOfMax: number }).percentOfMax &&
              triggerEligible(t, c)
          )
          .sort(
            (a, b) =>
              (b.event as { percentOfMax: number }).percentOfMax -
              (a.event as { percentOfMax: number }).percentOfMax
          )
        if (massive.length > 0) {
          record(massive[0])
          newResults.push(buildResult(massive[0], c, s.tables, { damage: amount, pct }))
        }

        // HP-reached-zero triggers: fire when this hit drops the combatant from
        // above 0 to 0 or below.
        if (prevHP > 0 && newHP <= 0) {
          for (const t of s.triggers) {
            if (
              t.enabled &&
              t.event.kind === 'hpReachedZero' &&
              scopeMatches(t.scope, c.type) &&
              triggerEligible(t, c)
            ) {
              record(t)
              newResults.push(buildResult(t, c, s.tables, { damage: amount, pct }))
            }
          }
        }

        // Concentration: taking damage prompts a save; dropping to 0 loses it
        // automatically (no save).
        let concentrationCleared = false
        if (c.concentration) {
          const lost = newHP <= 0
          newResults.push({
            id: newId(),
            triggerId: 'concentration',
            triggerName: 'Concentration',
            eventKind: 'concentration',
            combatantId: c.id,
            combatantName: c.name,
            damage: amount,
            tableId: null,
            tableName: null,
            dice: null,
            rollsRequested: 0,
            rolls: [],
            notifyText: lost
              ? `${c.name} drops to 0 HP and loses concentration on ${c.concentration}.`
              : `${c.name} took ${amount} damage while concentrating on ${c.concentration} — Constitution save DC ${Math.max(
                  10,
                  Math.floor(amount / 2)
                )} or lose it.`,
          })
          concentrationCleared = lost
        }

        set({
          combatants: s.combatants.map((x) =>
            x.id === id
              ? {
                  ...x,
                  currentHP: newHP,
                  tempHP: newTempHP,
                  concentration: concentrationCleared ? null : x.concentration,
                  firedTriggers: firedTurn.length
                    ? [...x.firedTriggers, ...firedTurn]
                    : x.firedTriggers,
                  firedTriggersRound: firedRound.length
                    ? [...x.firedTriggersRound, ...firedRound]
                    : x.firedTriggersRound,
                }
              : x
          ),
          triggerResults: newResults.length
            ? [...s.triggerResults, ...newResults]
            : s.triggerResults,
        })
      },

      applyHeal: (id, amount) => {
        if (amount <= 0) return
        set((s) => ({
          combatants: s.combatants.map((c) => {
            if (c.id !== id) return c
            const currentHP = Math.min(c.maxHP, c.currentHP + amount)
            const revived = currentHP > 0
            return {
              ...c,
              currentHP,
              isDead: revived ? false : c.isDead,
              // Healing above 0 clears death saves.
              deathSaves: revived ? { successes: 0, failures: 0 } : c.deathSaves,
            }
          }),
        }))
      },

      // Set a death-save count (0–3). Three failures marks the PC dead.
      recordDeathSave: (id, kind, value) =>
        set((s) => ({
          combatants: s.combatants.map((c) => {
            if (c.id !== id) return c
            const deathSaves = { ...c.deathSaves, [kind]: Math.max(0, Math.min(3, value)) }
            return { ...c, deathSaves, isDead: deathSaves.failures >= 3 ? true : c.isDead }
          }),
        })),

      nextTurn: () =>
        set((s) => {
          if (s.combatants.length === 0) return s
          const next = (s.currentTurnIndex + 1) % s.combatants.length
          const round = next === 0 ? s.round + 1 : s.round
          const roundChanged = round !== s.round
          const startingId = s.combatants[next]?.id
          return {
            currentTurnIndex: next,
            round,
            timerRemaining: s.timerSeconds,
            timerRunning: false,
            // perTurn triggers clear on any turn change; perRound only when the
            // round number changes. Timed conditions tick down for the combatant
            // whose turn is starting.
            combatants: s.combatants.map((c) => ({
              ...c,
              firedTriggers: [],
              firedTriggersRound: roundChanged ? [] : c.firedTriggersRound,
              conditions: c.id === startingId ? tickConditions(c.conditions) : c.conditions,
            })),
          }
        }),

      previousTurn: () =>
        set((s) => {
          if (s.combatants.length === 0) return s
          const prev =
            s.currentTurnIndex === 0
              ? s.combatants.length - 1
              : s.currentTurnIndex - 1
          const round = s.currentTurnIndex === 0 ? Math.max(1, s.round - 1) : s.round
          const roundChanged = round !== s.round
          return {
            currentTurnIndex: prev,
            round,
            timerRemaining: s.timerSeconds,
            timerRunning: false,
            combatants: s.combatants.map((c) => ({
              ...c,
              firedTriggers: [],
              firedTriggersRound: roundChanged ? [] : c.firedTriggersRound,
            })),
          }
        }),

      toggleCondition: (id, conditionId) =>
        set((s) => ({
          combatants: s.combatants.map((c) =>
            c.id === id
              ? {
                  ...c,
                  conditions: c.conditions.some((x) => x.id === conditionId)
                    ? c.conditions.filter((x) => x.id !== conditionId)
                    : [...c.conditions, { id: conditionId, rounds: null, saveEnds: false }],
                }
              : c
          ),
        })),

      setCondition: (id, conditionId, patch) =>
        set((s) => ({
          combatants: s.combatants.map((c) =>
            c.id === id
              ? {
                  ...c,
                  conditions: c.conditions.map((x) =>
                    x.id === conditionId ? { ...x, ...patch } : x
                  ),
                }
              : c
          ),
        })),

      addStrategyLabel: (name) =>
        set((s) =>
          s.strategyLabelNames.includes(name)
            ? s
            : { strategyLabelNames: [...s.strategyLabelNames, name] }
        ),

      removeStrategyLabel: (name) =>
        set((s) => ({
          strategyLabelNames: s.strategyLabelNames.filter((n) => n !== name),
          combatants: s.combatants.map((c) => {
            const labels = { ...c.strategyLabels }
            delete labels[name]
            return { ...c, strategyLabels: labels }
          }),
        })),

      setStrategyStack: (id, name, n) =>
        set((s) => ({
          combatants: s.combatants.map((c) => {
            if (c.id !== id) return c
            const labels = { ...c.strategyLabels }
            if (n <= 0) delete labels[name]
            else labels[name] = n
            return { ...c, strategyLabels: labels }
          }),
        })),

      setTimerSeconds: (seconds) =>
        set((s) => ({
          timerSeconds: seconds,
          timerRemaining: s.timerRunning ? s.timerRemaining : seconds,
        })),

      setTimerRunning: (running) => set({ timerRunning: running }),

      tickTimer: () =>
        set((s) => {
          if (!s.timerRunning) return s
          const remaining = s.timerRemaining - 1
          if (remaining <= 0) {
            if (s.combatants.length === 0) {
              return { timerRemaining: s.timerSeconds, timerRunning: false }
            }
            const next = (s.currentTurnIndex + 1) % s.combatants.length
            const round = next === 0 ? s.round + 1 : s.round
            const roundChanged = round !== s.round
            const startingId = s.combatants[next]?.id
            return {
              currentTurnIndex: next,
              round,
              timerRemaining: s.timerSeconds,
              timerRunning: false,
              // perTurn triggers reset on turn change; perRound on round change;
              // timed conditions tick for the combatant whose turn starts.
              combatants: s.combatants.map((c) => ({
                ...c,
                firedTriggers: [],
                firedTriggersRound: roundChanged ? [] : c.firedTriggersRound,
                conditions: c.id === startingId ? tickConditions(c.conditions) : c.conditions,
              })),
            }
          }
          return { timerRemaining: remaining }
        }),

      resetTimer: () =>
        set((s) => ({ timerRemaining: s.timerSeconds, timerRunning: false })),

      replaceState: (partial) => set(partial as Store),

      resetEncounter: () =>
        set((s) => {
          const fresh = buildDefaultEncounter()
          return {
            ...fresh,
            tables: s.tables,
            triggers: s.triggers,
            strategyLabelNames: s.strategyLabelNames,
            scenes: s.scenes,
            statblocks: s.statblocks,
            timerSeconds: s.timerSeconds,
            timerRemaining: s.timerSeconds,
          }
        }),

      clearFiredTriggers: () =>
        set((s) => ({
          combatants: s.combatants.map((c) => ({
            ...c,
            firedTriggers: [],
            firedTriggersRound: [],
          })),
        })),

      addTable: (t) => {
        const id = newId()
        set((s) => ({ tables: [...s.tables, { ...t, id }] }))
        return id
      },

      duplicateTable: (id) => {
        const s = get()
        const src = s.tables.find((t) => t.id === id)
        if (!src) return null
        const copy: RollTable = {
          ...src,
          id: newId(),
          name: `${src.name} (copy)`,
          entries: src.entries.map((e) => ({ ...e, id: newId() })),
        }
        const idx = s.tables.findIndex((t) => t.id === id)
        const tables = [...s.tables]
        tables.splice(idx + 1, 0, copy)
        set({ tables })
        return copy.id
      },

      updateTable: (id, patch) =>
        set((s) => ({
          tables: s.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      removeTable: (id) =>
        set((s) => ({ tables: s.tables.filter((t) => t.id !== id) })),

      addTrigger: (t) => {
        const id = newId()
        set((s) => ({ triggers: [...s.triggers, { ...t, id }] }))
        return id
      },

      updateTrigger: (id, patch) =>
        set((s) => ({
          triggers: s.triggers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      removeTrigger: (id) =>
        set((s) => ({ triggers: s.triggers.filter((t) => t.id !== id) })),

      // Perform the rolls for a pending result (the toast's "Roll" button).
      // A 50% massive-damage result rolls its table twice; results show every
      // individual roll.
      rollTriggerResult: (resultId) =>
        set((s) => {
          const result = s.triggerResults.find((r) => r.id === resultId)
          if (!result || !result.tableId) return s
          const table = s.tables.find((t) => t.id === result.tableId)
          if (!table) return s
          const rolls: TriggerRoll[] = []
          const n = Math.max(1, result.rollsRequested || 1)
          for (let i = 0; i < n; i++) {
            const r = rollExpression(table.dice)
            if (!r) continue
            const entry = matchTableEntry(table.entries, r.total)
            rolls.push({ roll: r.total, text: entry?.text ?? null })
          }
          return {
            triggerResults: s.triggerResults.map((r) =>
              r.id === resultId ? { ...r, rolls } : r
            ),
          }
        }),

      dismissTriggerResult: (resultId) =>
        set((s) => ({
          triggerResults: s.triggerResults.filter((r) => r.id !== resultId),
        })),

      clearTriggerResults: () => set({ triggerResults: [] }),

      // ---------- Prep library ----------
      // Scenes hold a nested encounters → roster tree. Nested edits are done by
      // the UI computing new sub-arrays and passing them to updateScene, which
      // keeps the store surface small.

      addScene: () => {
        const id = newId()
        const scene: Scene = { id, name: 'New Scene', encounters: [] }
        set((s) => ({ scenes: [...s.scenes, scene] }))
        return id
      },

      updateScene: (id, patch) =>
        set((s) => ({
          scenes: s.scenes.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)),
        })),

      removeScene: (id) =>
        set((s) => ({ scenes: s.scenes.filter((sc) => sc.id !== id) })),

      importScene: (raw) =>
        set((s) => {
          const data = (raw ?? {}) as { scene?: Scene; statblocks?: Statblock[] } & Partial<Scene>
          const incoming = (data.scene ?? data) as Scene
          if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.encounters)) {
            return s
          }
          // Fresh scene id avoids collisions; keep nested/statblock ids so roster
          // → statblock links survive.
          const scene: Scene = { ...incoming, id: newId() }
          const incomingSbs = Array.isArray(data.statblocks) ? data.statblocks : []
          const known = new Set(s.statblocks.map((x) => x.id))
          const addSbs = incomingSbs.filter((x) => x && x.id && !known.has(x.id))
          return {
            scenes: [...s.scenes, scene],
            statblocks: [...s.statblocks, ...addSbs],
          }
        }),

      loadEncounter: (sceneId, encounterId) =>
        set((s) => {
          const scene = s.scenes.find((x) => x.id === sceneId)
          const enc = scene?.encounters.find((e) => e.id === encounterId)
          if (!enc) return s
          return {
            combatants: sortByInit(expandRoster(enc.roster)),
            currentTurnIndex: 0,
            round: 1,
            timerRemaining: s.timerSeconds,
            timerRunning: false,
            triggerResults: [],
          }
        }),

      saveCurrentAsEncounter: (sceneId, name) =>
        set((s) => {
          const roster: RosterEntry[] = s.combatants.map((c) => ({
            id: newId(),
            name: c.name,
            type: c.type,
            quantity: 1,
            maxHP: c.maxHP,
            AC: c.AC,
            passivePerception: c.passivePerception,
            initiativeMode: 'static',
            initiative: c.initiative,
            initiativeMod: 0,
            nameVisibleToPlayers: c.nameVisibleToPlayers,
            statblockId: c.statblockId,
            playerClass: c.playerClass,
          }))
          const encounter: EncounterTemplate = {
            id: newId(),
            name: name.trim() || 'Saved Encounter',
            roster,
          }
          return {
            scenes: s.scenes.map((sc) =>
              sc.id === sceneId
                ? { ...sc, encounters: [...sc.encounters, encounter] }
                : sc
            ),
          }
        }),

      addStatblocks: (statblocks) =>
        set((s) => ({ statblocks: [...s.statblocks, ...statblocks] })),

      updateStatblock: (id, patch) =>
        set((s) => ({
          statblocks: s.statblocks.map((sb) => (sb.id === id ? { ...sb, ...patch } : sb)),
        })),

      removeStatblock: (id) =>
        set((s) => ({ statblocks: s.statblocks.filter((sb) => sb.id !== id) })),
    }),
    {
      name: 'turnkeeper-encounter',
      version: 4,
      storage: createJSONStorage(() => localStorage),
      // Persist only the durable fields. Keep this list and SYNC_KEYS (below)
      // in step when adding state — see CLAUDE.md.
      partialize: (state) => pick(state, PERSIST_KEYS) as unknown as EncounterState,
      // Upgrade older saves (v0 thresholds, v1 oncePerTurn) to the current
      // trigger schema — see src/data/migrate.ts.
      migrate: (persisted, _version) => migratePersisted(persisted),
    }
  )
)

// ---------- Cross-window sync ----------
// DM panel and player popout run in separate windows of the same browser.
// We sync their state by broadcasting a snapshot after every store change
// and applying received snapshots locally. A `receiving` flag prevents loops.

type Snapshot = Pick<EncounterState, (typeof SYNC_KEYS)[number]>

function snapshot(s: EncounterState): Snapshot {
  return pick(s, SYNC_KEYS)
}

if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  const channel = new BroadcastChannel('turnkeeper-sync')
  let receiving = false
  let lastSerialized = JSON.stringify(snapshot(useStore.getState()))

  channel.onmessage = (event) => {
    const data = event.data
    if (!data || typeof data !== 'object') return
    if (data.type === 'state' && data.snapshot) {
      const incoming = JSON.stringify(data.snapshot)
      if (incoming === lastSerialized) return
      receiving = true
      lastSerialized = incoming
      useStore.setState(data.snapshot as Partial<Store>)
      receiving = false
    } else if (data.type === 'request') {
      channel.postMessage({
        type: 'state',
        snapshot: snapshot(useStore.getState()),
      })
    }
  }

  useStore.subscribe((state) => {
    if (receiving) return
    const snap = snapshot(state)
    const ser = JSON.stringify(snap)
    if (ser === lastSerialized) return
    lastSerialized = ser
    channel.postMessage({ type: 'state', snapshot: snap })
  })

  // Give popout windows a chance to announce themselves; either side calling
  // 'request' triggers the other to respond with its current snapshot.
  setTimeout(() => channel.postMessage({ type: 'request' }), 100)
}
