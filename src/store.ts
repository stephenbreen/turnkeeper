import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  ActiveCondition,
  Campaign,
  Combatant,
  CombatantType,
  EncounterState,
  EncounterTemplate,
  LairActionConfig,
  LogEntry,
  RollTable,
  RosterEntry,
  Session,
  SessionSnapshot,
  Statblock,
  Trigger,
  TriggerAction,
  TriggerResult,
  TriggerRoll,
  TriggerScope,
} from './types'
import { CONDITIONS } from './data/conditions'
import { buildDefaultEncounter } from './data/defaultState'
import { expandRoster } from './data/encounter'
import { migratePersisted } from './data/migrate'
import { newId } from './utils/id'
import { nextName } from './utils/names'
import { rollExpression, matchTableEntry } from './utils/dice'

// ---------- Event log ----------

// DM-only fight history, capped so localStorage can't grow unbounded. Old
// entries are dropped from the front; the export writes whatever remains.
const LOG_CAP = 1000

const logAdd = (
  s: EncounterState,
  ...entries: Omit<LogEntry, 'id' | 't'>[]
): LogEntry[] => {
  const stamped = entries.map((e) => ({ ...e, id: newId(), t: Date.now() }))
  const log = [...s.eventLog, ...stamped]
  return log.length > LOG_CAP ? log.slice(log.length - LOG_CAP) : log
}

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
// "players roll the die physically" flow. Non-roll actions render via
// notifyText so the toast can describe what to apply.
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
  } else if (action.kind === 'notify') {
    notifyText = action.text
  } else if (action.kind === 'applyCondition') {
    const name = CONDITIONS.find((c) => c.id === action.conditionId)?.name ?? action.conditionId
    notifyText = `Apply ${name}${
      action.rounds != null ? ` for ${action.rounds} round${action.rounds === 1 ? '' : 's'}` : ''
    }${action.saveEnds ? ' (save ends)' : ''}`
  } else if (action.kind === 'damage') {
    notifyText = `Automatic damage: ${action.amount}`
  } else {
    notifyText = `Automatic healing: ${action.amount}`
  }
  return {
    id: newId(),
    triggerId: trigger.id,
    triggerName: trigger.name,
    eventKind: trigger.event.kind,
    visibility: trigger.visibility,
    combatantId: combatant?.id ?? null,
    combatantName: combatant?.name ?? '',
    damage: ctx.damage,
    pct: ctx.pct,
    percentThreshold:
      trigger.event.kind === 'massiveDamage' || trigger.event.kind === 'hpBelow'
        ? trigger.event.percentOfMax
        : undefined,
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
  // Lair & legendary actions
  setLairAction: (config: LairActionConfig | null) => void
  spendLegendaryAction: (id: string) => void
  // Campaign manager
  addCampaign: () => string
  updateCampaign: (id: string, patch: Partial<Campaign>) => void
  removeCampaign: (id: string) => void
  addSession: (campaignId: string) => string
  updateSession: (sessionId: string, patch: Partial<Session>) => void
  removeSession: (sessionId: string) => void
  importSession: (raw: unknown) => void
  loadEncounter: (sessionId: string, encounterId: string) => void
  saveCurrentAsEncounter: (sessionId: string, name: string) => void
  saveSessionSnapshot: (sessionId: string) => void
  loadSessionSnapshot: (sessionId: string) => void
  addStatblocks: (statblocks: Statblock[]) => void
  updateStatblock: (id: string, patch: Partial<Statblock>) => void
  removeStatblock: (id: string) => void
}

export type Store = EncounterState & Actions

// Durable fields written to localStorage. `eventLog` is DM-only history —
// persisted but never synced.
const PERSIST_KEYS = [
  'combatants',
  'currentCombatantId',
  'round',
  'timerSeconds',
  'timerRemaining',
  'timerRunning',
  'triggers',
  'strategyLabelNames',
  'tables',
  'campaigns',
  'statblocks',
  'lairAction',
  'lairFiredRound',
  'eventLog',
] as const

// Fields broadcast to the player window. Note: `campaigns` and `statblocks`
// are DM-only prep material and are deliberately NOT synced (keeps monster
// stats and planning notes off the player screen entirely); `triggerResults`
// is synced but not persisted; `eventLog` is DM-only.
const SYNC_KEYS = [
  'combatants',
  'currentCombatantId',
  'round',
  'timerSeconds',
  'timerRemaining',
  'timerRunning',
  'triggers',
  'strategyLabelNames',
  'tables',
  'triggerResults',
  'lairAction',
  'lairFiredRound',
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
    legendaryActions: c.legendaryActions ?? 0,
    legendaryUsed: 0,
    firedTriggers: [],
    firedTriggersRound: [],
    playerClass: c.playerClass,
    statblockId: c.statblockId,
  }
}

// Shared by nextTurn and the timer's auto-advance: move the turn marker to
// the next combatant in initiative order, wrapping (and bumping the round
// counter) at the end of the list. perTurn fired-trigger lists reset on every
// turn change; perRound ones only when the round number changes. Timed
// conditions tick down for the combatant whose turn is starting.
//
// Also the engine for turn/round events:
//   - `turnStart` triggers fire for the combatant whose turn is beginning.
//   - `roundStart` triggers fire when the round number changes.
//   - A lair reminder fires when the order passes the configured initiative
//     count (once per round, tracked via lairFiredRound).
//   - The starter's legendary-action pool resets (uses return at the start
//     of its own turn).
//
// Returns the state partial plus the fired results so the caller can apply
// trigger side-effects (applyCondition / damage / heal) after committing.
function advanceTurn(
  s: EncounterState
): { partial: Partial<EncounterState>; fired: TriggerResult[] } {
  if (s.combatants.length === 0) {
    return {
      partial: {
        currentCombatantId: null,
        timerRemaining: s.timerSeconds,
        timerRunning: false,
      },
      fired: [],
    }
  }
  const curIdx = s.combatants.findIndex((c) => c.id === s.currentCombatantId)
  // No current combatant (combat hasn't started): land on the top of the
  // order without bumping the round.
  const starting = curIdx < 0 ? 0 : (curIdx + 1) % s.combatants.length
  const round = curIdx >= 0 && starting === 0 ? s.round + 1 : s.round
  const roundChanged = round !== s.round
  const startingId = s.combatants[starting].id
  const firedTriggersTurn: string[] = []
  const firedTriggersRoundList: string[] = []
  const fired: TriggerResult[] = []

  let combatants: Combatant[] = s.combatants.map((c) => ({
    ...c,
    firedTriggers: [],
    firedTriggersRound: roundChanged ? [] : c.firedTriggersRound,
    conditions: c.id === startingId ? tickConditions(c.conditions) : c.conditions,
    // Legendary uses return at the start of the creature's own turn.
    legendaryUsed: c.id === startingId ? 0 : c.legendaryUsed,
  }))
  const starter = combatants[starting]

  // turnStart triggers — scoped to the combatant whose turn begins. perTurn /
  // perRound dedupe records against the starter like any other event.
  for (const t of s.triggers) {
    if (
      t.enabled &&
      t.event.kind === 'turnStart' &&
      scopeMatches(t.scope, starter.type) &&
      triggerEligible(t, starter)
    ) {
      if (t.dedupe === 'perTurn') firedTriggersTurn.push(t.id)
      else if (t.dedupe === 'perRound') firedTriggersRoundList.push(t.id)
      fired.push(buildResult(t, starter, s.tables, {}))
    }
  }

  // roundStart triggers — round-level, no combatant. `round: 0` = every round.
  if (roundChanged) {
    for (const t of s.triggers) {
      if (
        t.enabled &&
        t.event.kind === 'roundStart' &&
        (t.event.round === 0 || t.event.round === round)
      ) {
        fired.push(buildResult(t, null, s.tables, {}))
      }
    }
  }

  // Lair action reminder: fires when the order crosses the configured count
  // going downward (or on wrap when every combatant sits above it — count 20
  // then falls after the whole round), once per round. The DM acts on the
  // reminder; nothing is applied automatically.
  let lairFiredRound = s.lairFiredRound
  const lair = s.lairAction
  if (lair && lairFiredRound !== round) {
    const prevInit =
      roundChanged || curIdx < 0 ? Infinity : s.combatants[curIdx].initiative
    const nextInit = starter.initiative
    const allAbove = s.combatants.every((c) => c.initiative > lair.initiative)
    const crossed = prevInit > lair.initiative && nextInit <= lair.initiative
    if (crossed || (roundChanged && allAbove)) {
      lairFiredRound = round
      fired.push({
        id: newId(),
        triggerId: 'lair',
        triggerName: lair.name || 'Lair Action',
        eventKind: 'lair',
        visibility: 'both',
        combatantId: null,
        combatantName: '',
        tableId: null,
        tableName: null,
        dice: null,
        rollsRequested: 0,
        rolls: [],
        notifyText: `The lair acts now (initiative ${lair.initiative}).`,
      })
    }
  }

  // Fold dedupe records into the starter's entry.
  if (firedTriggersTurn.length || firedTriggersRoundList.length) {
    combatants = combatants.map((c) =>
      c.id === startingId
        ? {
            ...c,
            firedTriggers: [...c.firedTriggers, ...firedTriggersTurn],
            firedTriggersRound: [...c.firedTriggersRound, ...firedTriggersRoundList],
          }
        : c
    )
  }

  const log: Omit<LogEntry, 'id' | 't'>[] = [
    { kind: 'turnStart', name: starter.name, value: round },
  ]
  if (roundChanged) log.push({ kind: 'roundStart', name: `Round ${round}` })
  for (const r of fired) {
    log.push({
      kind: r.eventKind === 'lair' ? 'lairAction' : 'triggerFired',
      name: r.triggerName,
      text: r.combatantName || undefined,
    })
  }

  return {
    partial: {
      currentCombatantId: startingId,
      round,
      timerRemaining: s.timerSeconds,
      timerRunning: false,
      combatants,
      lairFiredRound,
      triggerResults: fired.length ? [...s.triggerResults, ...fired] : s.triggerResults,
      eventLog: logAdd(s, ...log),
    },
    fired,
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
    (set, get) => {
      // Apply non-roll trigger actions (applyCondition / damage / heal) after
      // the main state change. Per-combatant events hit the combatant that
      // fired; round-level events hit every in-scope combatant ("the lair
      // floods: everyone takes 5"). Trigger-caused changes are logged but
      // never re-evaluate triggers — a bleeding trigger can't cascade into
      // more rolls or conditions.
      const applySideEffects = (results: TriggerResult[]) => {
        if (!results.length) return
        set((s) => {
          const entries: Omit<LogEntry, 'id' | 't'>[] = []
          let combatants = s.combatants

          const mutate = (
            c: Combatant,
            a: Extract<TriggerAction, { kind: 'applyCondition' | 'damage' | 'heal' }>
          ): Combatant => {
            if (a.kind === 'applyCondition') {
              if (c.conditions.some((x) => x.id === a.conditionId)) return c
              entries.push({ kind: 'conditionAdd', name: c.name, text: a.conditionId })
              return {
                ...c,
                conditions: [
                  ...c.conditions,
                  { id: a.conditionId, rounds: a.rounds, saveEnds: a.saveEnds },
                ],
              }
            }
            if (a.kind === 'damage') {
              // Same absorption rules as manual damage: temp HP soaks first.
              const absorbed = Math.min(c.tempHP, a.amount)
              entries.push({ kind: 'damage', name: c.name, value: a.amount, text: 'trigger' })
              return {
                ...c,
                currentHP: Math.max(0, c.currentHP - (a.amount - absorbed)),
                tempHP: c.tempHP - absorbed,
              }
            }
            const newHP = Math.min(c.maxHP, c.currentHP + a.amount)
            const revived = newHP > 0
            entries.push({ kind: 'heal', name: c.name, value: a.amount, text: 'trigger' })
            return {
              ...c,
              currentHP: newHP,
              isDead: revived ? false : c.isDead,
              deathSaves: revived ? { successes: 0, failures: 0 } : c.deathSaves,
            }
          }

          for (const r of results) {
            const t = s.triggers.find((x) => x.id === r.triggerId)
            const a = t?.action
            if (!t || !a || a.kind === 'rollTable' || a.kind === 'notify') continue
            const targetIds = r.combatantId
              ? [r.combatantId]
              : t.event.kind === 'roundStart'
                ? s.combatants.filter((c) => scopeMatches(t.scope, c.type)).map((c) => c.id)
                : []
            for (const tid of targetIds) {
              combatants = combatants.map((c) => (c.id === tid ? mutate(c, a) : c))
            }
          }
          if (combatants === s.combatants && !entries.length) return {}
          return {
            combatants,
            eventLog: logAdd(s, ...entries),
          }
        })
      }

      return {
      ...buildDefaultEncounter(),

      addCombatant: (c) => {
        const newCombatant = buildCombatant(c)
        const s = get()
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
        set({
          combatants: sortByInit([...s.combatants, newCombatant]),
          // First combatant added becomes current, matching the old
          // index-0 behaviour; later adds never move the marker.
          currentCombatantId: s.currentCombatantId ?? newCombatant.id,
          triggerResults: results.length
            ? [...s.triggerResults, ...results]
            : s.triggerResults,
          eventLog: logAdd(s, { kind: 'combatantAdd', name: newCombatant.name }),
        })
        applySideEffects(results)
      },

      // Append several combatants at once (e.g. importing a saved party).
      // Deliberately does NOT fire `combatantAdded` triggers — a bulk party
      // import shouldn't roll a reinforcements table once per player.
      addCombatants: (list) =>
        set((s) => {
          const built = list.map(buildCombatant)
          const combatants = sortByInit([...s.combatants, ...built])
          return {
            combatants,
            currentCombatantId: s.currentCombatantId ?? combatants[0]?.id ?? null,
            eventLog: logAdd(
              s,
              ...built.map((b) => ({ kind: 'combatantAdd' as const, name: b.name }))
            ),
          }
        }),

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
            legendaryActions: c.legendaryActions,
          })
          return {
            combatants: sortByInit([...s.combatants, copy]),
            currentCombatantId: s.currentCombatantId ?? copy.id,
            eventLog: logAdd(s, {
              kind: 'combatantAdd',
              name: copy.name,
              text: 'duplicate',
            }),
          }
        }),

      updateCombatant: (id, patch) =>
        set((s) => ({
          combatants: sortByInit(
            s.combatants.map((c) => (c.id === id ? { ...c, ...patch } : c))
          ),
        })),

      removeCombatant: (id) =>
        set((s) => {
          const idx = s.combatants.findIndex((c) => c.id === id)
          if (idx < 0) return {}
          const removed = s.combatants[idx]
          const combatants = s.combatants.filter((c) => c.id !== id)
          let currentCombatantId = s.currentCombatantId
          if (s.currentCombatantId === id) {
            // Removing whoever is on turn: hand the turn to the next
            // combatant in order (the one that slides into this slot), or
            // last / none if the list runs out.
            currentCombatantId =
              combatants[Math.min(idx, combatants.length - 1)]?.id ?? null
          }
          return {
            combatants,
            currentCombatantId,
            eventLog: logAdd(s, { kind: 'combatantRemove', name: removed.name }),
          }
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

        // hpBelow triggers: crossing-based HP state thresholds (bloodied at
        // 50%, phase changes, "last legs" warnings). Mirrors massive damage's
        // "most severe wins" rule but inverted: the LOWEST threshold crossed
        // fires, since dropping to 10% subsumes crossing 50%. Healing back
        // above a threshold re-arms it.
        const prevPct = (prevHP / Math.max(1, c.maxHP)) * 100
        const newPct = (newHP / Math.max(1, c.maxHP)) * 100
        const below = s.triggers
          .filter(
            (t) =>
              t.enabled &&
              t.event.kind === 'hpBelow' &&
              scopeMatches(t.scope, c.type) &&
              (t.event as { percentOfMax: number }).percentOfMax < prevPct &&
              (t.event as { percentOfMax: number }).percentOfMax >= newPct &&
              triggerEligible(t, c)
          )
          .sort(
            (a, b) =>
              (a.event as { percentOfMax: number }).percentOfMax -
              (b.event as { percentOfMax: number }).percentOfMax
          )
        if (below.length > 0) {
          record(below[0])
          newResults.push(
            buildResult(below[0], c, s.tables, { damage: amount, pct: newPct })
          )
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
            visibility: 'dm',
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

        const log: Omit<LogEntry, 'id' | 't'>[] = [
          { kind: 'damage', name: c.name, value: amount },
          ...newResults.map((r) => ({
            kind: 'triggerFired' as const,
            name: r.triggerName,
            text: c.name,
          })),
        ]

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
          eventLog: logAdd(s, ...log),
        })

        applySideEffects(newResults)
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
          eventLog: logAdd(s, {
            kind: 'heal',
            name: s.combatants.find((c) => c.id === id)?.name ?? '',
            value: amount,
          }),
        }))
      },

      // Set a death-save count (0–3). Three failures marks the PC dead.
      recordDeathSave: (id, kind, value) =>
        set((s) => {
          const name = s.combatants.find((c) => c.id === id)?.name ?? ''
          const entries: Omit<LogEntry, 'id' | 't'>[] = [
            { kind: 'deathSave', name, text: kind, value },
          ]
          const combatants = s.combatants.map((c) => {
            if (c.id !== id) return c
            const deathSaves = { ...c.deathSaves, [kind]: Math.max(0, Math.min(3, value)) }
            // A separate entry for the death itself so replay can tell the
            // third failure apart from the running tally.
            if (deathSaves.failures >= 3 && c.deathSaves.failures < 3)
              entries.push({ kind: 'died', name, text: 'third death-save failure' })
            return { ...c, deathSaves, isDead: deathSaves.failures >= 3 ? true : c.isDead }
          })
          return { combatants, eventLog: logAdd(s, ...entries) }
        }),

      nextTurn: () => {
        const s = get()
        if (s.combatants.length === 0) return
        const { partial, fired } = advanceTurn(s)
        set(partial)
        applySideEffects(fired)
      },

      previousTurn: () =>
        set((s) => {
          if (s.combatants.length === 0) return s
          const curIdx = s.combatants.findIndex((c) => c.id === s.currentCombatantId)
          const idx = curIdx < 0 ? 0 : curIdx
          const prev = idx === 0 ? s.combatants.length - 1 : idx - 1
          const round = idx === 0 ? Math.max(1, s.round - 1) : s.round
          const roundChanged = round !== s.round
          return {
            currentCombatantId: s.combatants[prev]?.id ?? null,
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

      toggleCondition: (id, conditionId) => {
        const s = get()
        const c = s.combatants.find((x) => x.id === id)
        if (!c) return
        const has = c.conditions.some((x) => x.id === conditionId)
        // Fire "condition gained" triggers when a condition is applied
        // (removal is not an event). Trigger-applied conditions deliberately
        // don't re-enter here — applySideEffects never re-evaluates triggers.
        const results: TriggerResult[] = []
        const firedTurn: string[] = []
        const firedRound: string[] = []
        if (!has) {
          for (const t of s.triggers) {
            if (
              t.enabled &&
              t.event.kind === 'conditionGained' &&
              t.event.conditionId === conditionId &&
              scopeMatches(t.scope, c.type) &&
              triggerEligible(t, c)
            ) {
              if (t.dedupe === 'perTurn') firedTurn.push(t.id)
              else if (t.dedupe === 'perRound') firedRound.push(t.id)
              results.push(buildResult(t, c, s.tables, {}))
            }
          }
        }
        set({
          combatants: s.combatants.map((x) =>
            x.id === id
              ? {
                  ...x,
                  conditions: has
                    ? x.conditions.filter((cond) => cond.id !== conditionId)
                    : [...x.conditions, { id: conditionId, rounds: null, saveEnds: false }],
                  firedTriggers: firedTurn.length
                    ? [...x.firedTriggers, ...firedTurn]
                    : x.firedTriggers,
                  firedTriggersRound: firedRound.length
                    ? [...x.firedTriggersRound, ...firedRound]
                    : x.firedTriggersRound,
                }
              : x
          ),
          triggerResults: results.length
            ? [...s.triggerResults, ...results]
            : s.triggerResults,
          eventLog: logAdd(
            s,
            { kind: has ? 'conditionRemove' : 'conditionAdd', name: c.name, text: conditionId },
            ...results.map((r) => ({
              kind: 'triggerFired' as const,
              name: r.triggerName,
              text: c.name,
            }))
          ),
        })
        if (results.length) applySideEffects(results)
      },

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

      tickTimer: () => {
        const s = get()
        if (!s.timerRunning) return
        if (s.timerRemaining - 1 > 0) {
          set({ timerRemaining: s.timerRemaining - 1 })
          return
        }
        if (s.combatants.length === 0) {
          set({ timerRemaining: s.timerSeconds, timerRunning: false })
          return
        }
        // Auto-advance uses the exact same path as the Next button.
        const { partial, fired } = advanceTurn(s)
        set(partial)
        applySideEffects(fired)
      },

      resetTimer: () =>
        set((s) => ({ timerRemaining: s.timerSeconds, timerRunning: false })),

      // Raw merge used by the encounter importer. The importer builds the
      // partial carefully (migrate + marker validation + id check) — this is
      // the one sanctioned "write whatever you're given" escape hatch.
      replaceState: (partial) => set(partial),

      resetEncounter: () =>
        set((s) => {
          const fresh = buildDefaultEncounter()
          return {
            ...fresh,
            tables: s.tables,
            triggers: s.triggers,
            strategyLabelNames: s.strategyLabelNames,
            campaigns: s.campaigns,
            statblocks: s.statblocks,
            lairAction: s.lairAction,
            timerSeconds: s.timerSeconds,
            timerRemaining: s.timerSeconds,
            // The old fight's history is discarded with the board — export
            // the log first if you want to keep it. A marker entry records
            // that a reset happened so resumed logs stay readable.
            eventLog: [
              { id: newId(), t: Date.now(), kind: 'encounterReset', name: 'Encounter reset' },
            ],
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

      // ---------- Campaign manager ----------
      // Campaigns hold sessions; sessions hold encounters and an optional
      // mid-fight snapshot. Nested edits are done by the UI computing new
      // sub-arrays and passing them to updateSession/updateCampaign, which
      // keeps the store surface small. Session lookups search all campaigns —
      // ids are globally unique (newId everywhere), so this stays O(small).

      addCampaign: () => {
        const id = newId()
        const campaign: Campaign = { id, name: 'New Campaign', notes: '', sessions: [] }
        set((s) => ({ campaigns: [...s.campaigns, campaign] }))
        return id
      },

      updateCampaign: (id, patch) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      removeCampaign: (id) =>
        set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) })),

      addSession: (campaignId) => {
        const id = newId()
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  sessions: [...c.sessions, { id, name: 'New Session', encounters: [] }],
                }
              : c
          ),
        }))
        return id
      },

      updateSession: (sessionId, patch) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) => ({
            ...c,
            sessions: c.sessions.map((x) => (x.id === sessionId ? { ...x, ...patch } : x)),
          })),
        })),

      removeSession: (sessionId) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) => ({
            ...c,
            sessions: c.sessions.filter((x) => x.id !== sessionId),
          })),
        })),

      // Accepts a session payload (or a legacy pre-rename scene), optionally
      // wrapped as { session | scene, statblocks }. Fresh session id avoids
      // collisions; nested/statblock ids are kept so roster → statblock
      // links survive.
      importSession: (raw) =>
        set((s) => {
          const data = (raw ?? {}) as {
            session?: Session
            scene?: Session
            statblocks?: Statblock[]
          } & Partial<Session>
          const incoming = (data.session ?? data.scene ?? data) as Session
          if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.encounters)) {
            return s
          }
          const session: Session = { ...incoming, id: newId() }
          const incomingSbs = Array.isArray(data.statblocks) ? data.statblocks : []
          const known = new Set(s.statblocks.map((x) => x.id))
          const addSbs = incomingSbs.filter((x) => x && x.id && !known.has(x.id))
          // Import lands in the first campaign; create one if this is the
          // first import on a fresh install.
          let campaigns = s.campaigns
          if (campaigns.length === 0) {
            campaigns = [{ id: newId(), name: 'My Campaign', notes: '', sessions: [] }]
          }
          campaigns = campaigns.map((c, i) =>
            i === 0 ? { ...c, sessions: [...c.sessions, session] } : c
          )
          return {
            campaigns,
            statblocks: [...s.statblocks, ...addSbs],
          }
        }),

      loadEncounter: (sessionId, encounterId) =>
        set((s) => {
          const enc = s.campaigns
            .flatMap((c) => c.sessions)
            .find((x) => x.id === sessionId)
            ?.encounters.find((e) => e.id === encounterId)
          if (!enc) return s
          const combatants = sortByInit(expandRoster(enc.roster))
          return {
            combatants,
            // Top of the order goes on turn immediately (matches the old
            // index-0 behaviour); the marker now survives later re-sorts.
            currentCombatantId: combatants[0]?.id ?? null,
            round: 1,
            timerRemaining: s.timerSeconds,
            timerRunning: false,
            triggerResults: [],
            eventLog: logAdd(s, { kind: 'encounterLoad', name: enc.name }),
          }
        }),

      saveCurrentAsEncounter: (sessionId, name) =>
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
            legendaryActions: c.legendaryActions,
          }))
          const encounter: EncounterTemplate = {
            id: newId(),
            name: name.trim() || 'Saved Encounter',
            roster,
          }
          return {
            campaigns: s.campaigns.map((c) => ({
              ...c,
              sessions: c.sessions.map((x) =>
                x.id === sessionId ? { ...x, encounters: [...x.encounters, encounter] } : x
              ),
            })),
          }
        }),

      // Save the live board mid-fight into a session so the game can be
      // resumed exactly where it left off — HP, conditions, death saves,
      // round, turn marker and the fight log. Rules (triggers / tables /
      // labels) are deliberately NOT snapshotted; they stay live so tweaks
      // between sessions apply on resume.
      saveSessionSnapshot: (sessionId) =>
        set((s) => {
          const snapshot: SessionSnapshot = {
            combatants: s.combatants,
            currentCombatantId: s.currentCombatantId,
            round: s.round,
            timerSeconds: s.timerSeconds,
            eventLog: s.eventLog,
            lairFiredRound: s.lairFiredRound,
            savedAt: Date.now(),
          }
          return {
            campaigns: s.campaigns.map((c) => ({
              ...c,
              sessions: c.sessions.map((x) => (x.id === sessionId ? { ...x, snapshot } : x)),
            })),
          }
        }),

      // Resume a saved snapshot: restores the board, round, turn marker, the
      // lair guard and the fight log. Stale toasts are dropped; the timer
      // starts paused at full.
      loadSessionSnapshot: (sessionId) =>
        set((s) => {
          const session = s.campaigns
            .flatMap((c) => c.sessions)
            .find((x) => x.id === sessionId)
          const snap = session?.snapshot
          if (!snap || !session) return {}
          const restored: LogEntry[] = [
            ...snap.eventLog,
            {
              id: newId(),
              t: Date.now(),
              kind: 'encounterLoad',
              name: session.name,
              text: 'resumed snapshot',
            },
          ]
          return {
            combatants: sortByInit(snap.combatants),
            currentCombatantId: snap.currentCombatantId,
            round: snap.round,
            timerSeconds: snap.timerSeconds,
            timerRemaining: snap.timerSeconds,
            timerRunning: false,
            triggerResults: [],
            lairFiredRound: snap.lairFiredRound,
            eventLog:
              restored.length > LOG_CAP ? restored.slice(restored.length - LOG_CAP) : restored,
          }
        }),

      // ---------- Lair & legendary actions ----------

      // Enable / disable / reconfigure the lair action. Resetting the
      // once-per-round guard keeps the reminder honest across settings.
      setLairAction: (config) => set({ lairAction: config, lairFiredRound: null }),

      spendLegendaryAction: (id) =>
        set((s) => {
          const c = s.combatants.find((x) => x.id === id)
          if (!c || c.legendaryActions <= c.legendaryUsed) return {}
          return {
            combatants: s.combatants.map((x) =>
              x.id === id ? { ...x, legendaryUsed: x.legendaryUsed + 1 } : x
            ),
            eventLog: logAdd(s, {
              kind: 'legendaryUse',
              name: c.name,
              value: c.legendaryUsed + 1,
              text: `of ${c.legendaryActions}`,
            }),
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
      }
    },
    {
      name: 'turnkeeper-encounter',
      version: 6,
      storage: createJSONStorage(() => localStorage),
      // Persist only the durable fields. Keep this list and SYNC_KEYS (below)
      // in step when adding state — see CLAUDE.md.
      partialize: (state) => pick(state, PERSIST_KEYS) as unknown as EncounterState,
      // Upgrade older saves (v0 thresholds, v1 oncePerTurn, v5 turn index,
      // v6 campaign tree / visibility / legendary / lair / event log) to the
      // current trigger schema — see src/data/migrate.ts.
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
