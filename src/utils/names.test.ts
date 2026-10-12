import { describe, expect, it } from 'vitest'
import { nextName, numberedCopies } from './names'

describe('nextName', () => {
  it('appends " 2" to an unnumbered name', () => {
    expect(nextName('Goblin', ['Goblin'])).toBe('Goblin 2')
  })

  it('bumps a trailing number', () => {
    expect(nextName('Goblin 4', ['Goblin 4'])).toBe('Goblin 5')
  })

  it('skips to the lowest unused number', () => {
    expect(nextName('Goblin', ['Goblin', 'Goblin 2'])).toBe('Goblin 3')
  })

  it('keeps the base name spacing style', () => {
    expect(nextName('Orc2', ['Orc2'])).toBe('Orc3')
  })
})

describe('numberedCopies', () => {
  it('numbers from 1 when the field is clear', () => {
    expect(numberedCopies('Goblin', [], 3)).toEqual([
      'Goblin 1',
      'Goblin 2',
      'Goblin 3',
    ])
  })

  it('continues an existing series instead of colliding', () => {
    // Loading "Goblin x4" twice must give 5-8, not a second "Goblin 1".
    expect(numberedCopies('Goblin', ['Goblin 1', 'Goblin 2', 'Goblin 3'], 2)).toEqual([
      'Goblin 4',
      'Goblin 5',
    ])
  })

  it('starts the block after the last collision when the series has gaps', () => {
    // Goblin 1 and 3 exist; a 2-copy block can't fit at 1 (needs 1,2) or 2
    // (needs 2,3), so it lands at 4.
    expect(numberedCopies('Goblin', ['Goblin 1', 'Goblin 3'], 2)).toEqual([
      'Goblin 4',
      'Goblin 5',
    ])
  })

  it('continues from a numbered base', () => {
    expect(numberedCopies('Goblin 4', ['Goblin 4', 'Goblin 5'], 2)).toEqual([
      'Goblin 6',
      'Goblin 7',
    ])
  })

  it('round-trips a repeated bulk add without duplicates', () => {
    const first = numberedCopies('Goblin', [], 4)
    const second = numberedCopies('Goblin', first, 4)
    expect([...first, ...second].sort()).toEqual(
      ['Goblin 1', 'Goblin 2', 'Goblin 3', 'Goblin 4', 'Goblin 5', 'Goblin 6', 'Goblin 7', 'Goblin 8']
    )
  })
})