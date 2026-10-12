import { newId } from '../utils/id'
import { buildPresetLibrary } from './presets'
import type { EncounterState, RollTable, Trigger } from '../types'

// One canonical injury table. The "25% vs 50%" distinction is NOT two tables —
// it's how many times you roll on this one table (see buildDefaultTriggers).
export const buildDefaultInjuryTable = (): RollTable => ({
  id: newId(),
  name: 'Injury Table',
  dice: 'd20',
  entries: [
    { id: newId(), range: '1-5', text: 'Wind knocked out — lose your next reaction.' },
    { id: newId(), range: '6-12', text: 'Shallow wound — -1 to next attack roll this round.' },
    { id: newId(), range: '13-18', text: 'Bleeding — 1 damage at the start of each turn until healed.' },
    { id: newId(), range: '19-20', text: 'Ugly gash — disadvantage on next social check until long rest.' },
  ],
})

export const buildDefaultTables = (): RollTable[] => [buildDefaultInjuryTable()]

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
  },
  {
    id: newId(),
    name: 'Grievous Wound (50%)',
    enabled: true,
    scope: 'any',
    dedupe: 'perTurn',
    event: { kind: 'massiveDamage', percentOfMax: 50 },
    action: { kind: 'rollTable', tableId: injuryTableId, rolls: 2 },
  },
]

export const buildDefaultEncounter = (): EncounterState => {
  const injuryTable = buildDefaultInjuryTable()
  const { scenes, statblocks } = buildPresetLibrary()
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
    scenes,
    statblocks,
  }
}
