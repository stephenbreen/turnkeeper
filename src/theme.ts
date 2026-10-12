import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'turnkeeper-theme'
// Pre-rename key ("The Breaking"); read once as a fallback handoff.
const LEGACY_KEY = 'the-breaking-theme'

export function getStoredTheme(): Theme {
  try {
    let v = localStorage.getItem(KEY)
    if (v == null) {
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy === 'dark' || legacy === 'light') {
        v = legacy
        localStorage.setItem(KEY, v)
      }
    }
    if (v === 'dark' || v === 'light') return v
  } catch {
    /* ignore */
  }
  return 'light' // parchment is the brand default
}

export function applyTheme(theme: Theme) {
  const el = document.documentElement
  el.classList.toggle('dark', theme === 'dark')
  el.style.colorScheme = theme
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
// popout) follow the DM's toggle live.
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        setTheme(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark'
      storeTheme(next)
      return next
    })
  }, [])

  return [theme, toggle]
}
