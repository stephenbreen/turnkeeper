import { useCallback, useEffect, useState } from 'react'

export type Theme = 'parchment' | 'ember' | 'midnight' | 'dusk'

export interface ThemeDef {
  id: Theme
  label: string
  description: string
  swatch: string
}

// Palettes for the room you're playing in. Parchment is the brand default;
// Ember is the warm dark; Midnight and Dusk came in from the theme-picker
// branch. Swatches are inline CSS backgrounds for the picker chips.
export const THEMES: ThemeDef[] = [
  {
    id: 'parchment',
    label: 'Parchment',
    description: 'Bright rooms — cream page, dark ink',
    swatch: 'linear-gradient(135deg, #fdf6e3 0%, #d6c69e 100%)',
  },
  {
    id: 'ember',
    label: 'Ember',
    description: 'Dim rooms — warm dark, burgundy & gold',
    swatch: 'linear-gradient(135deg, #22130d 0%, #7c1d1d 100%)',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep dark — cool slate & indigo',
    swatch: 'linear-gradient(135deg, #020617 0%, #1e293b 100%)',
  },
  {
    id: 'dusk',
    label: 'Dusk',
    description: 'Soft dark — lighter slate for indoor light',
    swatch: 'linear-gradient(135deg, #334155 0%, #64748b 100%)',
  },
]

export function isTheme(v: string | null): v is Theme {
  return v === 'parchment' || v === 'ember' || v === 'midnight' || v === 'dusk'
}

const KEY = 'turnkeeper-theme'
// Pre-rename key ("The Breaking"); read once as a fallback handoff.
const LEGACY_KEY = 'the-breaking-theme'
// The picker used to be a light/dark toggle — map stored values onto the
// closest palette so nobody loses their preference.
const LEGACY_VALUES: Record<string, Theme> = {
  light: 'parchment',
  dark: 'ember',
}

function normalize(v: string | null): Theme | null {
  if (isTheme(v)) return v
  if (v != null && v in LEGACY_VALUES) return LEGACY_VALUES[v]
  return null
}

export function getStoredTheme(): Theme {
  try {
    let theme = normalize(localStorage.getItem(KEY))
    if (theme == null) {
      theme = normalize(localStorage.getItem(LEGACY_KEY))
    }
    if (theme != null) {
      // Write the (possibly migrated) value back so the legacy path runs once.
      localStorage.setItem(KEY, theme)
      return theme
    }
  } catch {
    /* ignore */
  }
  return 'parchment' // parchment is the brand default
}

export function applyTheme(theme: Theme) {
  const el = document.documentElement
  el.setAttribute('data-theme', theme)
  el.style.colorScheme = theme === 'parchment' ? 'light' : 'dark'
}

function storeTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* ignore */
  }
  applyTheme(theme)
}

// Theme is a per-window UI preference kept in its own localStorage key (not the
// synced encounter store). The `storage` event lets a second window (the player
// popout) follow the DM's choice live — or deliberately pick its own.
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        const next = normalize(e.newValue)
        if (next) setTheme(next)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const set = useCallback((t: Theme) => {
    storeTheme(t)
    setTheme(t)
  }, [])

  return [theme, set]
}