import { useEffect, useState } from 'react'
import { useStore } from './store'
import Timer from './components/Timer'
import InitiativeList from './components/InitiativeList'
import DiceRoller from './components/DiceRoller'
import TablesPanel from './components/TablesPanel'
import InjuryToast from './components/InjuryToast'
import EncounterMenu from './components/EncounterMenu'
import SettingsPanel from './components/SettingsPanel'
import AddCombatantModal from './components/AddCombatantModal'
import HelpModal from './components/HelpModal'
import LibraryModal from './components/LibraryModal'
import ThemeToggle from './components/ThemeToggle'
import KofiWidget from './components/KofiWidget'

type Tab = 'initiative' | 'dice' | 'tables' | 'settings'

export default function App() {
  const round = useStore((s) => s.round)
  const combatants = useStore((s) => s.combatants)
  const currentIdx = useStore((s) => s.currentTurnIndex)
  const nextTurn = useStore((s) => s.nextTurn)
  const previousTurn = useStore((s) => s.previousTurn)
  const setTimerRunning = useStore((s) => s.setTimerRunning)
  const timerRunning = useStore((s) => s.timerRunning)
  const resetTimer = useStore((s) => s.resetTimer)
  const [addOpen, setAddOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('initiative')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Desktop-only: collapse the right panel to give initiative full width.
  const [rightOpen, setRightOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('the-breaking-sidepanel') !== 'closed'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('the-breaking-sidepanel', rightOpen ? 'open' : 'closed')
    } catch {
      /* ignore */
    }
  }, [rightOpen])

  const current = combatants[currentIdx]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Skip while typing into form fields, contenteditable, or while a
      // modal owns the keyboard (each modal handles its own Esc).
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return
      }
      if (addOpen || helpOpen || libraryOpen) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case '?':
          e.preventDefault()
          setHelpOpen(true)
          break
        case 'l':
        case 'L':
          e.preventDefault()
          setLibraryOpen(true)
          break
        case ' ':
        case 'ArrowRight':
        case 'n':
        case 'N':
          if (combatants.length === 0) return
          e.preventDefault()
          nextTurn()
          break
        case 'ArrowLeft':
        case 'p':
        case 'P':
          if (combatants.length === 0) return
          e.preventDefault()
          previousTurn()
          break
        case 'a':
        case 'A':
          e.preventDefault()
          setAddOpen(true)
          break
        case 't':
        case 'T':
          e.preventDefault()
          setTimerRunning(!timerRunning)
          break
        case 'r':
        case 'R':
          e.preventDefault()
          resetTimer()
          break
        case 'h':
        case 'H': {
          if (combatants.length === 0) return
          e.preventDefault()
          // Make sure the active row is visible (mobile may be on another tab)
          // before its quick HP input gets focused.
          setTab('initiative')
          window.dispatchEvent(new CustomEvent('focus-active-hp'))
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    addOpen,
    helpOpen,
    libraryOpen,
    combatants.length,
    nextTurn,
    previousTurn,
    setTimerRunning,
    timerRunning,
    resetTimer,
  ])

  const openPlayerView = () => {
    const url = window.location.pathname + '?view=player'
    const win = window.open(
      url,
      'the-breaking-player',
      'width=1100,height=780,menubar=no,toolbar=no'
    )
    if (!win) {
      alert(
        'Popup blocked — allow popups for this page. Or open this URL manually in a second window:\n\n' +
          window.location.origin +
          url
      )
    }
  }

  // For desktop right panel, treat 'initiative' as defaulting to 'dice'.
  const sideTab: Exclude<Tab, 'initiative'> = tab === 'initiative' ? 'dice' : tab

  const renderPanel = (t: Exclude<Tab, 'initiative'>) => {
    if (t === 'dice') return <DiceRoller />
    if (t === 'tables') return <TablesPanel />
    return <SettingsPanel />
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center gap-2 px-2 sm:px-4 py-2 border-b border-slate-800 bg-slate-900 flex-wrap">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight">
          ⚔ The Breaking
        </h1>
        <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-slate-500 px-1.5 py-0.5 border border-slate-700 rounded">
          DM
        </span>
        <div className="flex-1 min-w-2" />
        {/* Round / on-turn readout and Prev/Next live in the header on desktop;
            on mobile they move to the thumb-reachable bottom bar. */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 leading-none">Round</div>
            <div className="text-lg sm:text-xl font-bold leading-tight">{round}</div>
          </div>
          {current && (
            <div className="text-left px-2 border-l border-slate-700 max-w-[8rem] sm:max-w-none">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 leading-none">On turn</div>
              <div className="text-sm font-semibold text-indigo-300 leading-tight truncate">
                {current.name}
              </div>
            </div>
          )}
        </div>
        <div className="hidden sm:flex gap-1">
          <button onClick={previousTurn} className="btn" disabled={combatants.length === 0}>
            ◀ Prev
          </button>
          <button onClick={nextTurn} className="btn-primary" disabled={combatants.length === 0}>
            Next ▶
          </button>
        </div>
        <Timer />
        <button
          onClick={() => setRightOpen((v) => !v)}
          className="btn hidden sm:inline-flex items-center gap-1.5"
          title={
            rightOpen
              ? 'Hide the dice / tables / settings panel'
              : 'Show the dice / tables / settings panel'
          }
          aria-label={rightOpen ? 'Hide side panel' : 'Show side panel'}
        >
          <span aria-hidden>{rightOpen ? '⇥' : '⇤'}</span>
          {rightOpen ? 'Hide panel' : 'Show panel'}
        </button>
        <button
          onClick={openPlayerView}
          className="btn hidden sm:inline-flex"
          title="Open player view in a new window"
        >
          Player View ↗
        </button>
        <button
          onClick={() => setLibraryOpen(true)}
          className="btn hidden sm:inline-flex"
          title="Scenes, encounters & statblocks (L)"
        >
          📚 Library
        </button>
        <EncounterMenu onOpenLibrary={() => setLibraryOpen(true)} />
        <ThemeToggle />
        <button
          onClick={() => setHelpOpen(true)}
          className="btn inline-flex items-center gap-1.5"
          title="Help — how to use this app (?)"
          aria-label="Open help"
        >
          <span aria-hidden className="font-bold">?</span>
          <span className="hidden sm:inline">Help</span>
        </button>
      </header>

      {/* Mobile tab bar */}
      <div className="sm:hidden flex border-b border-slate-800 bg-slate-900">
        {(['initiative', 'dice', 'tables', 'settings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 capitalize text-sm font-medium transition ${
              tab === t
                ? 'bg-slate-800 text-white border-b-2 border-indigo-400 -mb-px'
                : 'text-slate-400 hover:bg-slate-900'
            }`}
          >
            {t === 'initiative' ? 'Init' : t}
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Initiative panel: always visible on desktop, only when tab='initiative' on mobile */}
        <div
          className={`flex-1 flex-col min-w-0 sm:border-r sm:border-slate-800 sm:flex ${
            tab === 'initiative' ? 'flex' : 'hidden'
          }`}
        >
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-800">
            <h2 className="text-base sm:text-lg font-semibold">Initiative</h2>
            <button onClick={() => setAddOpen(true)} className="btn-primary">
              + Add<span className="hidden sm:inline"> Combatant</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            <InitiativeList
              expandedId={expandedId}
              setExpandedId={setExpandedId}
            />
          </div>
        </div>

        {/* Right panel: fixed-width on desktop (collapsible), full-width on mobile
            when a non-initiative tab is active. */}
        <div
          className={`flex-1 flex-col min-w-0 ${
            tab !== 'initiative' ? 'flex' : 'hidden'
          } ${rightOpen ? 'sm:flex sm:flex-none sm:w-[32rem]' : 'sm:hidden'}`}
        >
          {/* Desktop sub-tabs (dice/tables/settings) */}
          <div className="hidden sm:flex border-b border-slate-800">
            {(['dice', 'tables', 'settings'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 capitalize text-sm font-medium transition ${
                  sideTab === t
                    ? 'bg-slate-800 text-white border-b-2 border-indigo-400 -mb-px'
                    : 'text-slate-400 hover:bg-slate-900'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">{renderPanel(sideTab)}</div>
        </div>
      </div>

      {/* Mobile turn controls — pinned to the bottom for one-handed thumb reach.
          Part of the flex column (not fixed) so it never overlaps the list, and
          padded for the iOS home indicator. Prev/Next live in the header on
          desktop, so this is hidden there. */}
      <div className="sm:hidden flex items-stretch gap-2 border-t border-slate-800 bg-slate-900 px-2 py-2">
        <button
          onClick={previousTurn}
          disabled={combatants.length === 0}
          className="btn flex items-center justify-center px-5 text-lg"
          aria-label="Previous turn"
        >
          ◀
        </button>
        <div className="flex-1 flex flex-col items-center justify-center min-w-0 leading-none">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">
            Round {round}
          </div>
          <div className="text-sm font-semibold text-indigo-300 truncate max-w-full mt-0.5">
            {current ? current.name : '—'}
          </div>
        </div>
        <button
          onClick={nextTurn}
          disabled={combatants.length === 0}
          className="btn-primary flex items-center justify-center gap-1 px-7 text-lg font-bold"
          aria-label="Next turn"
        >
          Next ▶
        </button>
      </div>

      {/* Footer — DM view only. Slim; pads for the iOS home indicator since it's
          the bottom-most element. */}
      <footer className="flex items-center justify-center gap-3 border-t border-slate-800 bg-slate-900 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-xs text-slate-500">
        <span className="hidden sm:inline">
          The Breaking — browser initiative tracker for DMs
        </span>
        <span className="hidden sm:inline text-slate-700" aria-hidden>
          ·
        </span>
        <KofiWidget />
      </footer>

      <AddCombatantModal open={addOpen} onClose={() => setAddOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <LibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onLoaded={() => {
          setLibraryOpen(false)
          setTab('initiative')
          setExpandedId(null)
        }}
      />
      <InjuryToast />
    </div>
  )
}
