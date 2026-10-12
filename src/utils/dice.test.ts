import { describe, expect, it } from 'vitest'
import { matchTableEntry, rollExpression } from './dice'

describe('rollExpression', () => {
  it('rolls a plain die', () => {
    const r = rollExpression('d20')
    expect(r).not.toBeNull()
    expect(r!.total).toBeGreaterThanOrEqual(1)
    expect(r!.total).toBeLessThanOrEqual(20)
    expect(r!.rolls).toHaveLength(1)
    expect(r!.rolls[0].die).toBe(20)
    expect(r!.modifier).toBe(0)
  })

  it('parses count + modifier', () => {
    const r = rollExpression('2d6+3')
    expect(r!.rolls).toHaveLength(2)
    expect(r!.rolls.every((x) => x.die === 6)).toBe(true)
    expect(r!.modifier).toBe(3)
    expect(r!.total).toBeGreaterThanOrEqual(5) // 2×1 + 3
    expect(r!.total).toBeLessThanOrEqual(15) // 2×6 + 3
  })

  it('handles negative modifiers', () => {
    const r = rollExpression('1d20-1')
    expect(r!.modifier).toBe(-1)
    expect(r!.total).toBeGreaterThanOrEqual(0)
    expect(r!.total).toBeLessThanOrEqual(19)
  })

  it('handles multiple dice groups', () => {
    const r = rollExpression('3d4+2d6+1')
    expect(r!.rolls).toHaveLength(5)
    expect(r!.modifier).toBe(1)
    expect(r!.total).toBeGreaterThanOrEqual(6) // 3 + 2 + 1
    expect(r!.total).toBeLessThanOrEqual(25) // 12 + 12 + 1
  })

  it('is case- and whitespace-insensitive', () => {
    const r = rollExpression(' 2D6 ')
    expect(r!.rolls).toHaveLength(2)
  })

  it('rejects junk, empty, and absurd expressions', () => {
    expect(rollExpression('')).toBeNull()
    expect(rollExpression('banana')).toBeNull()
    expect(rollExpression('5000d6')).toBeNull() // count > 1000
    expect(rollExpression('1d50000')).toBeNull() // sides > 10000
    expect(rollExpression('d0')).toBeNull() // zero sides
  })
})

describe('matchTableEntry', () => {
  const entries = [
    { id: 'a', range: '1-5', text: 'low' },
    { id: 'b', range: '6-12', text: 'mid' },
    { id: 'c', range: '20', text: 'crit' },
  ]

  it('matches inside ranges', () => {
    expect(matchTableEntry(entries, 3)?.id).toBe('a')
    expect(matchTableEntry(entries, 10)?.id).toBe('b')
  })

  it('matches single values', () => {
    expect(matchTableEntry(entries, 20)?.id).toBe('c')
  })

  it('returns null for gaps in coverage', () => {
    expect(matchTableEntry(entries, 17)).toBeNull()
  })

  it('handles reversed ranges', () => {
    const reversed = [{ id: 'r', range: '5-1', text: '' }]
    expect(matchTableEntry(reversed, 3)?.id).toBe('r')
  })

  it('ignores non-numeric ranges', () => {
    expect(matchTableEntry([{ id: 'x', range: 'abc', text: '' }], 5)).toBeNull()
  })
})