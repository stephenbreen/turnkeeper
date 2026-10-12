import { describe, expect, it } from 'vitest'
import { parseParty, toParty } from './party'
import type { Combatant } from '../types'

const pc = (name: string, patch: Partial<Combatant> = {}): Combatant => ({
  id: `id-${name}`,
  name,
  type: 'pc',
  maxHP: 20,
  currentHP: 17,
  tempHP: 3,
  AC: 15,
  passivePerception: 12,
  initiative: 10,
  deathSaves: { successes: 1, failures: 0 },
  concentration: 'bless',
  conditions: [{ id: 'blinded', rounds: null, saveEnds: false }],
  strategyLabels: { Surrounded: 2 },
  notes: 'secret DM note',
  nameVisibleToPlayers: true,
  isDead: false,
  firedTriggers: [],
  firedTriggersRound: [],
  ...patch,
})

describe('toParty', () => {
  it('extracts only PCs, and only the durable sheet fields', () => {
    const members = toParty([pc('Aria'), { ...pc('Gob'), type: 'monster' }])
    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({
      name: 'Aria',
      maxHP: 20,
      AC: 15,
      passivePerception: 12,
      notes: 'secret DM note',
      nameVisibleToPlayers: true,
    })
    // Combat state must not ride along.
    expect(JSON.stringify(members[0])).not.toContain('currentHP')
    expect(JSON.stringify(members[0])).not.toContain('deathSaves')
    expect(JSON.stringify(members[0])).not.toContain('strategyLabels')
  })
})

describe('parseParty', () => {
  it('parses our own party file shape', () => {
    const members = parseParty({
      type: 'turnkeeper-party',
      version: 1,
      party: [{ name: 'Aria', maxHP: 30, AC: 14 }],
    })
    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({
      name: 'Aria',
      type: 'pc',
      maxHP: 30,
      currentHP: 30,
      AC: 14,
    })
  })

  it('still parses party files exported before the rename', () => {
    const members = parseParty({
      type: 'the-breaking-party',
      version: 1,
      party: [{ name: 'Aria' }],
    })
    expect(members).toHaveLength(1)
  })

  it('parses a bare array of members', () => {
    expect(parseParty([{ name: 'A' }, { name: 'B' }])).toHaveLength(2)
  })

  it('lifts PCs out of a full encounter blob', () => {
    const members = parseParty({
      combatants: [pc('Aria'), { ...pc('Gob'), type: 'monster', name: 'Gob' }],
    })
    expect(members).toHaveLength(1)
    expect(members[0].name).toBe('Aria')
  })

  it('unwraps a persisted zustand blob', () => {
    const members = parseParty({ state: { combatants: [pc('Aria')] } })
    expect(members).toHaveLength(1)
  })

  it('defaults missing numbers sensibly', () => {
    const [m] = parseParty([{ name: 'B' }])
    expect(m.maxHP).toBe(10)
    expect(m.currentHP).toBe(10)
    expect(m.AC).toBe(10)
    expect(m.passivePerception).toBe(10)
  })

  it('marks imported PCs as visible to players by default', () => {
    const [visible] = parseParty([{ name: 'C' }])
    expect(visible.nameVisibleToPlayers).toBe(true)
    const [hidden] = parseParty([{ name: 'D', nameVisibleToPlayers: false }])
    expect(hidden.nameVisibleToPlayers).toBe(false)
  })

  it('drops rows explicitly typed as monsters', () => {
    expect(parseParty([{ name: 'G', type: 'monster' }])).toHaveLength(0)
  })

  it('returns nothing for junk', () => {
    expect(parseParty('nope' as unknown)).toHaveLength(0)
    expect(parseParty(null)).toHaveLength(0)
    expect(parseParty({})).toHaveLength(0)
  })
})