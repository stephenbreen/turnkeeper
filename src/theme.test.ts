// @vitest-environment jsdom
// Needs jsdom for localStorage + document.documentElement.
import { beforeEach, describe, expect, it } from 'vitest'
import { THEMES, applyTheme, getStoredTheme } from './theme'
import type { Theme } from './theme'

const KEY = 'turnkeeper-theme'
const LEGACY_KEY = 'the-breaking-theme'

beforeEach(() => {
  localStorage.clear()
})

describe('getStoredTheme', () => {
  it('defaults to parchment', () => {
    expect(getStoredTheme()).toBe('parchment')
  })

  it('keeps valid theme ids', () => {
    for (const t of THEMES) {
      localStorage.setItem(KEY, t.id)
      expect(getStoredTheme()).toBe(t.id)
    }
  })

  it('migrates the old light/dark toggle values onto the closest palette', () => {
    localStorage.setItem(KEY, 'light')
    expect(getStoredTheme()).toBe('parchment')
    // The migrated value is written back, so the legacy path runs only once.
    expect(localStorage.getItem(KEY)).toBe('parchment')

    localStorage.setItem(KEY, 'dark')
    expect(getStoredTheme()).toBe('ember')
    expect(localStorage.getItem(KEY)).toBe('ember')
  })

  it('falls back through the pre-rename key, migrating the same way', () => {
    localStorage.setItem(LEGACY_KEY, 'dark')
    expect(getStoredTheme()).toBe('ember')
    expect(localStorage.getItem(KEY)).toBe('ember')
  })

  it('ignores garbage', () => {
    localStorage.setItem(KEY, 'neon')
    expect(getStoredTheme()).toBe('parchment')
  })
})

describe('THEMES', () => {
  it('lists every theme id exactly once, parchment first', () => {
    const ids = THEMES.map((t) => t.id)
    expect(ids[0]).toBe('parchment')
    expect(new Set(ids).size).toBe(ids.length)

    const all: Theme[] = ['parchment', 'ember', 'midnight', 'dusk']
    for (const id of all) expect(ids).toContain(id)
  })

  it('gives every theme a label, description and swatch', () => {
    for (const t of THEMES) {
      expect(t.label.length).toBeGreaterThan(0)
      expect(t.description.length).toBeGreaterThan(0)
      expect(t.swatch).toMatch(/gradient|#/i)
    }
  })
})

describe('applyTheme', () => {
  it('sets the data-theme attribute and colour scheme', () => {
    applyTheme('parchment')
    expect(document.documentElement.getAttribute('data-theme')).toBe('parchment')
    expect(document.documentElement.style.colorScheme).toBe('light')

    applyTheme('midnight')
    expect(document.documentElement.getAttribute('data-theme')).toBe('midnight')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })
})