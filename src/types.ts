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
  // Legendary actions available per round (0 = none). Uses reset at the
  // start of this combatant's own turn.
  legendaryActions: number
  legendaryUsed: number
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

export type TriggerEventKind =
  | 'massiveDamage'
  | 'hpReachedZero'
  | 'combatantAdded'
  | 'hpBelow'
  | 'roundStart'
  | 'turnStart'
  | 'conditionGained'

// Result kinds include synthetic notices (concentration, lair action) that
// aren't creatable triggers but still surface in the DM toast / player banner.
export type ResultKind = TriggerEventKind | 'concentration' | 'lair'

export type TriggerEvent =
  // A single hit dealing >= percentOfMax % of the target's max HP.
  | { kind: 'massiveDamage'; percentOfMax: number }
  // The combatant's current HP crosses from above 0 to 0 or below.
  | { kind: 'hpReachedZero' }
  // A new combatant was added to the encounter.
  | { kind: 'combatantAdded' }
  // Current HP crosses from above percentOfMax % to that threshold or below
  // (bloodied, phase changes). Crossing-based: healing back above the
  // threshold re-arms it.
  | { kind: 'hpBelow'; percentOfMax: number }
  // The given round begins — 0 means "every round". Reinforcements,
  // escalating plots.
  | { kind: 'roundStart'; round: number }
  // A scoped combatant's turn begins — start-of-turn reminders and effects.
  | { kind: 'turnStart' }
  // The named condition is applied to a scoped combatant.
  | { kind: 'conditionGained'; conditionId: string }

// Who sees a fired trigger's result: the DM toast, the player window's
// banner, or both.
export type ResultVisibility = 'dm' | 'players' | 'both'

export type TriggerAction =
  // Roll on a table `rolls` times (e.g. 50% massive damage = roll the injury
  // table twice). tableId may be null if the referenced table was deleted.
  | { kind: 'rollTable'; tableId: string | null; rolls: number }
  // Just surface a reminder to the DM.
  | { kind: 'notify'; text: string }
  // Auto-apply a condition (with optional round timer / save-ends) to the
  // combatant that triggered it.
  | { kind: 'applyCondition'; conditionId: string; rounds: number | null; saveEnds: boolean }
  // Engine-adjusted HP. Trigger-caused changes never re-fire triggers, so a
  // bleeding trigger can't cascade into more rolls.
  | { kind: 'damage'; amount: number }
  | { kind: 'heal'; amount: number }

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
  // Where the result surfaces. Note: `players`-only triggers skip the DM
  // toast entirely — a reveal meant purely for the big screen.
  visibility: ResultVisibility
}

export type TriggerRoll = { roll: number; text: string | null }

// A fired trigger awaiting the DM's attention. Transient (synced, not persisted).
export type TriggerResult = {
  id: string
  triggerId: string
  triggerName: string
  eventKind: ResultKind
  visibility: ResultVisibility
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
  // notify / applyCondition / damage / heal actions, rendered as text
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

// ---------- Event log ----------
// Append-only, DM-only history of the fight, capped to the last LOG_CAP
// entries. Exported as JSON (a replay viewer may come later); deliberately
// NOT synced to the player window.

export type LogEntryKind =
  | 'roundStart'
  | 'turnStart'
  | 'damage'
  | 'heal'
  | 'deathSave'
  | 'died'
  | 'conditionAdd'
  | 'conditionRemove'
  | 'combatantAdd'
  | 'combatantRemove'
  | 'triggerFired'
  | 'lairAction'
  | 'legendaryUse'
  | 'encounterLoad'
  | 'encounterReset'

export type LogEntry = {
  id: string
  // Date.now() at the moment of the entry.
  t: number
  kind: LogEntryKind
  // Primary subject — combatant name, trigger name, encounter name…
  name: string
  value?: number
  // Extra context (condition id, save kind, action summary…).
  text?: string
}

// ---------- Campaign manager: Campaign → Session → Encounter → roster ----------

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
  // Legendary actions per round for expanded combatants (0 = none).
  legendaryActions?: number
}

export type EncounterTemplate = {
  id: string
  name: string
  notes?: string
  roster: RosterEntry[]
}

// Mid-fight state saved into a session so a game can be resumed exactly where
// it left off. Rules (triggers / tables / labels) stay live rather than being
// snapshotted — tweaking them between sessions applies on resume.
export type SessionSnapshot = {
  combatants: Combatant[]
  currentCombatantId: string | null
  round: number
  timerSeconds: number
  // DM-only fight history, restored so the log survives the pause.
  eventLog: LogEntry[]
  lairFiredRound: number | null
  savedAt: number
}

export type Session = {
  id: string
  name: string
  notes?: string
  encounters: EncounterTemplate[]
  snapshot?: SessionSnapshot
}

export type Campaign = {
  id: string
  name: string
  notes?: string
  sessions: Session[]
}

export type LairActionConfig = {
  // Initiative count the lair acts at (5e convention: 20).
  initiative: number
  name: string
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
  // DM-only planning tree — never synced to the player window.
  campaigns: Campaign[]
  statblocks: Statblock[]
  // Lair action setting; null = off. When set, a marker row appears in the
  // initiative order at this count and a reminder fires when it's passed.
  lairAction: LairActionConfig | null
  // Round number the lair reminder last fired in (once-per-round guard).
  lairFiredRound: number | null
  // DM-only fight history — never synced to the player window.
  eventLog: LogEntry[]
}
