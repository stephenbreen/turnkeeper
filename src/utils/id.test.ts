import { describe, expect, it } from 'vitest'
import { newId } from './id'

describe('newId', () => {
  it('returns non-empty unique string ids', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const id = newId()
      expect(id.length).toBeGreaterThan(0)
      expect(seen.has(id)).toBe(false)
      seen.add(id)
    }
  })
})