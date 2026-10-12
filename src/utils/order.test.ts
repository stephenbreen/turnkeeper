import { describe, expect, it } from 'vitest'
import { withLairSlots } from './order'

const c = (initiative: number) => ({ initiative })

describe('withLairSlots', () => {
  it('returns a plain combatant order when lair actions are off', () => {
    const rows = withLairSlots([c(25), c(15)], null)
    expect(rows).toEqual([
      { kind: 'combatant', value: c(25) },
      { kind: 'combatant', value: c(15) },
    ])
  })

  it('inserts the lair slot before the first combatant at or below the count', () => {
    const rows = withLairSlots([c(25), c(20), c(15)], 20)
    expect(rows.map((r) => r.kind)).toEqual(['combatant', 'lair', 'combatant', 'combatant'])
    // the 20 lost the tie — lair acts before it
    expect(rows[1]).toEqual({ kind: 'lair' })
    expect(rows[2]).toEqual({ kind: 'combatant', value: c(20) })
  })

  it('places the slot at the end when every combatant is above the count', () => {
    const rows = withLairSlots([c(25), c(22)], 20)
    expect(rows.map((r) => r.kind)).toEqual(['combatant', 'combatant', 'lair'])
  })

  it('places the slot first when every combatant is below the count', () => {
    const rows = withLairSlots([c(15), c(10)], 20)
    expect(rows.map((r) => r.kind)).toEqual(['lair', 'combatant', 'combatant'])
  })

  it('handles an empty order', () => {
    expect(withLairSlots([], 20)).toEqual([{ kind: 'lair' }])
    expect(withLairSlots([], null)).toEqual([])
  })
})