import { useState } from 'react'
import { THEMES, useTheme } from '../theme'

// Palette picker for the room you're playing in. Theme is a per-window
// preference (see theme.ts): the player popout follows the DM's choice via
// the storage event, but can pick its own.
export default function ThemeSwitcher() {
  const [theme, setTheme] = useTheme()
  const [open, setOpen] = useState(false)
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn inline-flex items-center gap-1.5"
        title="Change theme"
        aria-label="Change theme"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          aria-hidden
          className="inline-block w-3.5 h-3.5 rounded border border-slate-500"
          style={{ background: current.swatch }}
        />
        <span className="hidden sm:inline">{current.label}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 z-20 bg-slate-900 border border-slate-700 rounded shadow-xl w-64 py-1"
          >
            {THEMES.map((t) => {
              const active = t.id === theme
              return (
                <button
                  key={t.id}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    setTheme(t.id)
                    setOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 ${
                    active ? 'bg-slate-800' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block w-4 h-4 rounded border border-slate-500"
                      style={{ background: t.swatch }}
                    />
                    <span className="font-semibold text-slate-100">{t.label}</span>
                    {active && (
                      <span className="ml-auto text-indigo-300 text-xs">●</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {t.description}
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}