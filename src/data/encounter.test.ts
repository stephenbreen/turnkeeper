import { describe, expect, it } from 'vitest'
import { blankRosterEntry, expandRoster, expandRosterEntry } from './encounter'

const line = (patch: Record<string, unknown>) => ({ ...blankRosterEntry(), ...patch })

describe('expandRosterEntry', () => {
  it('numbers copies when the quantity is above one', () => {
    const out = expandRosterEntry(line({ name: 'Goblin', quantity: 3 }))
    expect(out.map((c) => c.name)).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3'])
  })

  it('keeps the name plain when there is only one', () => {
    const out = expandRosterEntry(line({ name: 'Boss' }))
    expect(out.map((c) => c.name)).toEqual(['Boss'])
  })

  it('treats a zero/negative quantity as one', () => {
    expect(expandRosterEntry(line({ quantity: 0 }))).toHaveLength(1)
    expect(expandRosterEntry(line({ quantity: -2 }))).toHaveLength(1)
  })

  it('seeds static initiative without rolling', () => {
    const out = expandRosterEntry(line({ quantity: 2, initiativeMode: 'static', initiative: 7 }))
    expect(out.map((c) => c.initiative)).toEqual([7, 7])
  })

  it('seeds manual initiative from the fixed value too', () => {
    const out = expandRosterEntry(line({ quantity: 1, initiativeMode: 'manual', initiative: 3 }))
    expect(out[0].initiative).toBe(3)
  })

  it('shares one roll across a roll-group line', () => {
    const out = expandRosterEntry(line({ quantity: 5, initiativeMode: 'roll-group' }))
    expect(new Set(out.map((c) => c.initiative)).size).toBe(1)
  })

  it('rolls separately for roll-each, within 1d20 + mod', () => {
    const out = expandRosterEntry(
      line({ quantity: 20, initiativeMode: 'roll-each', initiativeMod: 2 })
    )
    out.forEach((c) => {
      expect(c.initiative).toBeGreaterThanOrEqual(3)
      expect(c.initiative).toBeLessThanOrEqual(22)
    })
    // 20 separate d20s colliding onto one value would be extraordinary.
    expect(new Set(out.map((c) => c.initiative)).size).toBeGreaterThan(1)
  })

  it('expands with full HP and clean combat state', () => {
    const [c] = expandRoster([line({ maxHP: 0 })])
    expect(c.maxHP).toBe(1) // clamped
    expect(c.currentHP).toBe(1)
    expect(c.conditions).toEqual([])
    expect(c.firedTriggers).toEqual([])
    expect(c.isDead).toBe(false)
  })
})