import { newId } from '../utils/id'
import { rollDie } from '../utils/dice'
import type { Combatant, RosterEntry } from '../types'

function makeCombatant(
  entry: RosterEntry,
  index: number,
  quantity: number,
  initiative: number
): Combatant {
  const maxHP = Math.max(1, entry.maxHP)
  return {
    id: newId(),
    name: quantity > 1 ? `${entry.name} ${index + 1}` : entry.name,
    type: entry.type,
    maxHP,
    currentHP: maxHP,
    tempHP: 0,
    AC: entry.AC,
    passivePerception: entry.passivePerception,
    initiative,
    deathSaves: { successes: 0, failures: 0 },
    concentration: null,
    conditions: [],
    strategyLabels: {},
    notes: '',
    nameVisibleToPlayers: entry.nameVisibleToPlayers ?? entry.type === 'pc',
    isDead: false,
    legendaryActions: entry.legendaryActions ?? 0,
    legendaryUsed: 0,
    firedTriggers: [],
    firedTriggersRound: [],
    playerClass: entry.playerClass,
    statblockId: entry.statblockId,
  }
}

// Expand one roster line into combatants, applying its initiative mode:
//   roll-each  → each combatant rolls its own 1d20 + mod
//   roll-group → one shared roll for the whole line
//   static     → everyone uses the fixed value
//   manual     → seeded with the value; DM adjusts live
export function expandRosterEntry(entry: RosterEntry): Combatant[] {
  const quantity = Math.max(1, Math.floor(entry.quantity || 1))
  const rollInit = () => rollDie(20) + (entry.initiativeMod || 0)
  const groupRoll = entry.initiativeMode === 'roll-group' ? rollInit() : 0
  const out: Combatant[] = []
  for (let i = 0; i < quantity; i++) {
    let initiative: number
    switch (entry.initiativeMode) {
      case 'roll-each':
        initiative = rollInit()
        break
      case 'roll-group':
        initiative = groupRoll
        break
      default: // 'static' and 'manual' both seed from the fixed value
        initiative = entry.initiative
    }
    out.push(makeCombatant(entry, i, quantity, initiative))
  }
  return out
}

export const expandRoster = (roster: RosterEntry[]): Combatant[] =>
  roster.flatMap(expandRosterEntry)

// A sensible blank roster line for the encounter editor.
export const blankRosterEntry = (): RosterEntry => ({
  id: newId(),
  name: 'Monster',
  type: 'monster',
  quantity: 1,
  maxHP: 10,
  AC: 10,
  passivePerception: 10,
  initiativeMode: 'roll-each',
  initiative: 10,
  initiativeMod: 0,
  nameVisibleToPlayers: false,
  legendaryActions: 0,
})
