export type CombatantType = 'pc' | 'monster'

export type PlayerClassId =
  | 'none'
  | 'barbarian'
  | 'bard'
  | 'cleric'
  | 'druid'
  | 'fighter'
  | 'monk'
  | 'paladin'
  | 'ranger'
  | 'rogue'
  | 'sorcerer'
  | 'warlock'
  | 'wizard'

export type DeathSaves = { successes: number; failures: number }

// A condition applied to a combatant, with an optional round timer that
// auto-decrements on the combatant's turn, and a "save ends" marker.
export type ActiveCondition = {
  id: string // references a ConditionDef id
  rounds: number | null // remaining rounds; null = no timer
  saveEnds: boolean
}

export type Combatant = {
  id: string
  name: string
  type: CombatantType
  maxHP: number
  currentHP: number
  // Temporary hit points — absorbed before real HP, don't stack, not healed.
  tempHP: number
  AC: number
  passivePerception: number
  initiative: number
  // Death saving throws, tracked while a PC is at 0 HP (0–3 each).
  deathSaves: DeathSaves
  // Name of the spell/effect this combatant is concentrating on, or null.
  concentration: string | null
  conditions: ActiveCondition[]
  strategyLabels: Record<string, number>
  notes: string
  nameVisibleToPlayers: boolean
  isDead: boolean
  // Trigger ids already fired for this combatant in the current turn (for
  // `dedupe: 'perTurn'`). Cleared on every turn change.
  firedTriggers: string[]
  // Trigger ids already fired for this combatant in the current round (for
  // `dedupe: 'perRound'`). Cleared only when the round number changes.
  firedTriggersRound: string[]
  playerClass?: PlayerClassId
  // Optional link to a Statblock (DM-only reference material).
  statblockId?: string
}

export type TableEntry = {
  id: string
  range: string
  text: string
}

export type RollTable = {
  id: string
  name: string
  dice: string
  entries: TableEntry[]
}

// ---------- Triggers ----------
// A Trigger is a DM-authored rule: "when EVENT happens, do ACTION."
// It generalises the old hard-coded massive-damage thresholds.

export type TriggerScope = 'any' | 'pc' | 'monster'

export type TriggerEventKind = 'massiveDamage' | 'hpReachedZero' | 'combatantAdded'

// Result kinds include synthetic notices (concentration) that aren't creatable
// triggers but still surface in the DM toast.
export type ResultKind = TriggerEventKind | 'concentration'

export type TriggerEvent =
  // A single hit dealing >= percentOfMax % of the target's max HP.
  | { kind: 'massiveDamage'; percentOfMax: number }
  // The combatant's current HP crosses from above 0 to 0 or below.
  | { kind: 'hpReachedZero' }
  // A new combatant was added to the encounter.
  | { kind: 'combatantAdded' }

export type TriggerAction =
  // Roll on a table `rolls` times (e.g. 50% massive damage = roll the injury
  // table twice). tableId may be null if the referenced table was deleted.
  | { kind: 'rollTable'; tableId: string | null; rolls: number }
  // Just surface a reminder to the DM.
  | { kind: 'notify'; text: string }

// How often a trigger may fire for the same combatant:
//   always   — every qualifying hit/event
//   perTurn  — at most once per combatant per turn (resets on turn change)
//   perRound — at most once per combatant per round (resets on round change),
//              for effects that should only happen once "this round"
export type TriggerDedupe = 'always' | 'perTurn' | 'perRound'

export type Trigger = {
  id: string
  name: string
  enabled: boolean
  scope: TriggerScope
  dedupe: TriggerDedupe
  event: TriggerEvent
  action: TriggerAction
}

export type TriggerRoll = { roll: number; text: string | null }

// A fired trigger awaiting the DM's attention. Transient (synced, not persisted).
export type TriggerResult = {
  id: string
  triggerId: string
  triggerName: string
  eventKind: ResultKind
  combatantId: string | null
  combatantName: string
  // massiveDamage context
  damage?: number
  pct?: number
  percentThreshold?: number
  // rollTable action
  tableId: string | null
  tableName: string | null
  dice: string | null
  rollsRequested: number
  rolls: TriggerRoll[]
  // notify action
  notifyText?: string
}

// ---------- Statblocks ----------
// Normalised from the Fantasy Statblocks (Javalent) YAML/JSON schema. Fields are
// kept loose (strings) so partial statblocks render fine; numeric prefill (AC,
// HP, initiative mod) is derived on demand in utils/statblock.ts.

export type StatblockSection = { name: string; desc: string }

export type Statblock = {
  id: string
  name: string
  size?: string
  type?: string
  subtype?: string
  alignment?: string
  ac?: string
  hp?: string
  hitDice?: string
  speed?: string
  stats?: number[] // [STR, DEX, CON, INT, WIS, CHA]
  saves?: string
  skillsaves?: string
  damageVulnerabilities?: string
  damageResistances?: string
  damageImmunities?: string
  conditionImmunities?: string
  senses?: string
  languages?: string
  cr?: string
  traits?: StatblockSection[]
  actions?: StatblockSection[]
  bonusActions?: StatblockSection[]
  reactions?: StatblockSection[]
  legendaryActions?: StatblockSection[]
  source?: string
}

// ---------- Prep library: Scene → Encounter → roster ----------

export type InitiativeMode =
  | 'roll-each' // each expanded combatant rolls its own 1d20 + mod
  | 'roll-group' // one 1d20 + mod shared by the whole line
  | 'static' // everyone uses `initiative`
  | 'manual' // seeded with `initiative`, DM edits live at the table

// One line of an encounter roster; `quantity` expands into N combatants on load.
export type RosterEntry = {
  id: string
  name: string
  type: CombatantType
  quantity: number
  maxHP: number
  AC: number
  passivePerception: number
  initiativeMode: InitiativeMode
  initiative: number
  initiativeMod: number
  nameVisibleToPlayers: boolean
  statblockId?: string
  playerClass?: PlayerClassId
}

export type EncounterTemplate = {
  id: string
  name: string
  notes?: string
  roster: RosterEntry[]
}

export type Scene = {
  id: string
  name: string
  notes?: string
  encounters: EncounterTemplate[]
}

export type EncounterState = {
  combatants: Combatant[]
  // Whose turn it is, by id — NOT a positional index. `updateCombatant` and
  // every add re-sort the list by initiative, so a positional index would let
  // the marker silently slide onto a different combatant (adding a
  // reinforcement, editing initiative, …). null = combat hasn't started.
  currentCombatantId: string | null
  round: number
  timerSeconds: number
  timerRemaining: number
  timerRunning: boolean
  triggers: Trigger[]
  strategyLabelNames: string[]
  tables: RollTable[]
  triggerResults: TriggerResult[]
  scenes: Scene[]
  statblocks: Statblock[]
}
