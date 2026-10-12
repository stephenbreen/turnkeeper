import { newId } from '../utils/id'
import { normalizeStatblock } from '../utils/statblock'
import type { Campaign, RosterEntry, Session, Statblock } from '../types'

// Bundled example content so a new user can see the Campaign → Session →
// Encounter → roster flow (and import/export) without building anything first.

const entry = (p: Partial<RosterEntry> & { name: string }): RosterEntry => ({
  id: newId(),
  type: 'monster',
  quantity: 1,
  maxHP: 10,
  AC: 10,
  passivePerception: 10,
  initiativeMode: 'roll-each',
  initiative: 10,
  initiativeMod: 0,
  nameVisibleToPlayers: false,
  ...p,
})

export function buildPresetLibrary(): { campaigns: Campaign[]; statblocks: Statblock[] } {
  const goblin = normalizeStatblock({
    name: 'Goblin',
    size: 'Small',
    type: 'humanoid',
    subtype: 'goblinoid',
    alignment: 'neutral evil',
    ac: '15 (leather armor, shield)',
    hp: '7 (2d6)',
    speed: '30 ft.',
    stats: [8, 14, 10, 10, 8, 8],
    skillsaves: [{ stealth: 6 }],
    senses: 'darkvision 60 ft., passive Perception 9',
    languages: 'Common, Goblin',
    cr: '1/4',
    traits: [
      {
        name: 'Nimble Escape',
        desc: 'The goblin can take the Disengage or Hide action as a bonus action on each of its turns.',
      },
    ],
    actions: [
      {
        name: 'Scimitar',
        desc: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.',
      },
      {
        name: 'Shortbow',
        desc: 'Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.',
      },
    ],
    source: 'Example',
  })

  const griffin = normalizeStatblock({
    name: 'Griffin',
    size: 'Large',
    type: 'monstrosity',
    alignment: 'unaligned',
    ac: '12',
    hp: '59 (7d10 + 21)',
    speed: '20 ft., fly 80 ft.',
    stats: [18, 15, 16, 2, 13, 8],
    skillsaves: [{ perception: 5 }],
    senses: 'darkvision 60 ft., passive Perception 15',
    languages: '—',
    cr: '2',
    traits: [
      {
        name: 'Keen Sight',
        desc: 'The griffin has advantage on Wisdom (Perception) checks that rely on sight.',
      },
    ],
    actions: [
      { name: 'Multiattack', desc: 'The griffin makes two attacks: one with its beak and one with its claws.' },
      {
        name: 'Beak',
        desc: 'Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 8 (1d8 + 4) piercing damage.',
      },
      {
        name: 'Claws',
        desc: 'Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) slashing damage.',
      },
    ],
    source: 'Example',
  })

  const session: Session = {
    id: newId(),
    name: 'Wishing Well',
    notes: 'Example session — a roadside shrine. Two encounters the party may hit here.',
    encounters: [
      {
        id: newId(),
        name: 'Goblin Ambush',
        notes: 'Goblins spring from the treeline as the party nears the well. They share one initiative (group roll).',
        roster: [
          entry({
            name: 'Goblin',
            quantity: 4,
            maxHP: 7,
            AC: 15,
            passivePerception: 9,
            initiativeMode: 'roll-group',
            initiativeMod: 2,
            statblockId: goblin.id,
          }),
        ],
      },
      {
        id: newId(),
        name: 'Griffin Attack',
        notes: 'During the second watch a mated pair of griffins dives on the camp. Each rolls its own initiative.',
        roster: [
          entry({
            name: 'Griffin',
            quantity: 2,
            maxHP: 59,
            AC: 12,
            passivePerception: 15,
            initiativeMode: 'roll-each',
            initiativeMod: 2,
            statblockId: griffin.id,
          }),
        ],
      },
    ],
  }

  const campaign: Campaign = {
    id: newId(),
    name: 'Example Campaign',
    notes: 'Your campaign holds the sessions you plan to run — prep encounters ahead of time, or save a fight mid-flight and resume it next week.',
    sessions: [session],
  }

  return { campaigns: [campaign], statblocks: [goblin, griffin] }
}
