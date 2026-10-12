import { newId } from '../utils/id'
import { buildPresetLibrary } from './presets'
import type { EncounterState, RollTable, Trigger } from '../types'

// Sample starting content, deliberately generic — every table here is an
// editable example, not a prescribed rule. Rename, rewrite or delete them
// in the Tables tab; triggers that referenced a deleted table say so in the
// DM toast.

// One canonical injury table. The "25% vs 50%" distinction is NOT two tables —
// it's how many times you roll on this one table (see buildDefaultTriggers).
export const buildDefaultInjuryTable = (): RollTable => ({
  id: newId(),
  name: 'Sample: Injury Table',
  dice: 'd20',
  entries: [
    { id: newId(), range: '1-5', text: 'Shaken — disadvantage on your next attack roll.' },
    { id: newId(), range: '6-12', text: 'Knocked flying — you land prone.' },
    {
      id: newId(),
      range: '13-18',
      text: 'Bleeding — 1d4 damage at the start of your next turn; a DC 10 Medicine check stops it.',
    },
    {
      id: newId(),
      range: '19-20',
      text: 'Debilitating wound — gain one level of exhaustion, or describe a lasting scar.',
    },
  ],
})

// A second sample showing tables aren't just for injuries — wire it to a
// trigger (e.g. "a combatant is added" → reinforcements) or roll it yourself.
export const buildDefaultComplicationsTable = (): RollTable => ({
  id: newId(),
  name: 'Sample: Dramatic Complications',
  dice: 'd20',
  entries: [
    { id: newId(), range: '1-2', text: 'A support gives way — debris crashes down nearby.' },
    { id: newId(), range: '3-4', text: 'The ground turns slick — difficult terrain now.' },
    { id: newId(), range: '5-6', text: 'Something catches fire — smoke begins to spread.' },
    { id: newId(), range: '7-8', text: 'The clash draws unwanted attention.' },
    { id: newId(), range: '9-10', text: 'Everyone scrambles — footing and formations break.' },
    { id: newId(), range: '11-12', text: 'An opening appears — one wounded combatant catches a second wind.' },
    { id: newId(), range: '13-14', text: 'The environment lashes out — bite, grab or burn.' },
    { id: newId(), range: '15-16', text: 'Reinforcements arrive — for one side or the other.' },
    { id: newId(), range: '17-18', text: 'Something precious is exposed or dropped mid-fight.' },
    { id: newId(), range: '19-20', text: 'The stakes escalate — this was never the real threat.' },
  ],
})

export const buildDefaultTables = (): RollTable[] => [
  buildDefaultInjuryTable(),
  buildDefaultComplicationsTable(),
]

// The massive-damage rule, written as data:
//   - a single hit dealing >= 25% of max HP  → roll the injury table once
//   - a single hit dealing >= 50% of max HP  → roll the same table twice
// "Only the highest matching threshold fires" is handled in the store engine.
export const buildDefaultTriggers = (injuryTableId: string): Trigger[] => [
  {
    id: newId(),
    name: 'Injury (25%)',
    enabled: true,
    scope: 'any',
    dedupe: 'perTurn',
    event: { kind: 'massiveDamage', percentOfMax: 25 },
    action: { kind: 'rollTable', tableId: injuryTableId, rolls: 1 },
    visibility: 'both',
  },
  {
    id: newId(),
    name: 'Grievous Wound (50%)',
    enabled: true,
    scope: 'any',
    dedupe: 'perTurn',
    event: { kind: 'massiveDamage', percentOfMax: 50 },
    action: { kind: 'rollTable', tableId: injuryTableId, rolls: 2 },
    visibility: 'both',
  },
]

export const buildDefaultEncounter = (): EncounterState => {
  const injuryTable = buildDefaultInjuryTable()
  const { campaigns, statblocks } = buildPresetLibrary()
  return {
    combatants: [],
    currentCombatantId: null,
    round: 1,
    timerSeconds: 60,
    timerRemaining: 60,
    timerRunning: false,
    triggers: buildDefaultTriggers(injuryTable.id),
    strategyLabelNames: ['Surrounded'],
    tables: [injuryTable],
    triggerResults: [],
    campaigns,
    statblocks,
    lairAction: null,
    lairFiredRound: null,
    eventLog: [],
  }
}
