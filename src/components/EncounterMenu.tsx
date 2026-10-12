import { useRef, useState } from 'react'
import { useStore } from '../store'
import { migratePersisted } from '../data/migrate'
import { parseParty, serializeParty, toParty } from '../data/party'
import type { EncounterState } from '../types'

export default function EncounterMenu({
  onOpenLibrary,
}: {
  onOpenLibrary: () => void
}) {
  // No store subscription for data: nothing here renders reactively, and the
  // old selector-less `useStore()` re-rendered the menu on every timer tick.
  // Handlers read fresh state via getState() at click time.
  const replace = useStore((s) => s.replaceState)
  const reset = useStore((s) => s.resetEncounter)
  const clearFired = useStore((s) => s.clearFiredTriggers)
  const addCombatants = useStore((s) => s.addCombatants)
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const partyFileRef = useRef<HTMLInputElement>(null)

  const download = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const today = () => new Date().toISOString().slice(0, 10)

  const exportJson = () => {
    const {
      combatants,
      round,
      currentCombatantId,
      triggers,
      strategyLabelNames,
      tables,
      timerSeconds,
      lairAction,
    } = useStore.getState()
    const payload = {
      // Export-format marker (v1; independent of the persist schema —
      // migratePersisted is shape-driven, so imports stay compatible).
      type: 'turnkeeper-encounter',
      version: 1,
      combatants,
      round,
      currentCombatantId,
      triggers,
      strategyLabelNames,
      tables,
      timerSeconds,
      lairAction,
    }
    download(JSON.stringify(payload, null, 2), `turnkeeper-${today()}.json`)
    setOpen(false)
  }

  // The DM-only fight history: every damage tick, turn, trigger, lair action
  // and death, in order. The JSON is shaped for a future replay viewer; for
  // now it's an archive the DM can keep with session notes.
  const exportLog = () => {
    const { eventLog, round } = useStore.getState()
    if (eventLog.length === 0) {
      alert('The fight log is empty — nothing to export yet.')
      return
    }
    const payload = {
      type: 'turnkeeper-log',
      version: 1,
      exportedAt: new Date().toISOString(),
      round,
      entries: eventLog,
    }
    download(JSON.stringify(payload, null, 2), `turnkeeper-log-${today()}.json`)
    setOpen(false)
  }

  const exportParty = () => {
    const members = toParty(useStore.getState().combatants)
    if (members.length === 0) {
      alert('No players to export. Add PCs first (set type to "PC" when adding).')
      return
    }
    download(serializeParty(members), `turnkeeper-party-${today()}.json`)
    setOpen(false)
  }

  const importParty = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const members = parseParty(JSON.parse(await file.text()))
      if (members.length === 0) {
        alert('No players found in that file.')
        return
      }
      const names = members
        .map((m) => m.name)
        .slice(0, 4)
        .join(', ')
      const more = members.length > 4 ? `, +${members.length - 4} more` : ''
      if (
        !confirm(
          `Add ${members.length} player${members.length > 1 ? 's' : ''} to the ` +
            `current encounter?\n\n${names}${more}`
        )
      )
        return
      addCombatants(members)
      setOpen(false)
    } catch (err) {
      alert('Import failed: ' + (err as Error).message)
    }
  }

  const importJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const txt = await file.text()
      const data = JSON.parse(txt) as Record<string, unknown>
      // Typed files we don't recognise (a party file, something else
      // entirely) are rejected up front rather than importing as an
      // empty encounter. Unmarked files are treated as legacy exports —
      // the first exports predate the marker.
      if (typeof data.type === 'string' && data.type !== 'turnkeeper-encounter') {
        alert(`That file is a "${data.type}" — not a Turnkeeper encounter export.`)
        return
      }
      if (!Array.isArray(data.combatants)) {
        alert(
          'No combatants found in that file — is it an encounter export? ' +
            '(Party files import via "Import party…".)'
        )
        return
      }
      if (!confirm('Replace the current encounter with imported data?')) return
      // Normalise through the same migration as persisted state so older files
      // (thresholds / oncePerTurn) and combatants missing the fired-trigger
      // arrays are brought up to the current schema.
      const norm = migratePersisted(data) as Record<string, unknown>
      const combatants = Array.isArray(norm.combatants) ? norm.combatants : []
      const triggers = Array.isArray(norm.triggers) ? norm.triggers : []
      // migratePersisted already mapped any old positional index to an id;
      // verify the id actually exists so a foreign file can't strand the
      // turn marker.
      const importedId = norm.currentCombatantId
      const currentCombatantId =
        typeof importedId === 'string' &&
        combatants.some((c) => (c as { id?: string }).id === importedId)
          ? importedId
          : null
      const current = useStore.getState()
      const next: Partial<EncounterState> = {
        combatants: combatants as EncounterState['combatants'],
        round: typeof norm.round === 'number' ? norm.round : 1,
        currentCombatantId,
        triggers: (triggers.length
          ? triggers
          : current.triggers) as EncounterState['triggers'],
        strategyLabelNames: Array.isArray(norm.strategyLabelNames)
          ? (norm.strategyLabelNames as string[])
          : current.strategyLabelNames,
        tables: (Array.isArray(norm.tables)
          ? norm.tables
          : current.tables) as EncounterState['tables'],
        timerSeconds: typeof norm.timerSeconds === 'number' ? norm.timerSeconds : 60,
        timerRemaining: typeof norm.timerSeconds === 'number' ? norm.timerSeconds : 60,
        timerRunning: false,
        triggerResults: [],
        // migratePersisted normalises this to a valid config or null; the
        // once-per-round guard starts fresh either way.
        lairAction: (norm.lairAction ?? null) as EncounterState['lairAction'],
        lairFiredRound: null,
      }
      replace(next)
      setOpen(false)
    } catch (err) {
      alert('Import failed: ' + (err as Error).message)
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="btn">
        Encounter ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-slate-900 border border-slate-700 rounded shadow-xl w-60 py-1">
            <button
              onClick={() => {
                onOpenLibrary()
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 text-sm"
            >
              Library — campaigns & statblocks…
            </button>
            <div className="border-t border-slate-700 my-1" />
            <button
              onClick={() => {
                if (confirm('Start a new encounter? Combatants will be cleared; tables kept.')) {
                  reset()
                  setOpen(false)
                }
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 text-sm"
            >
              New encounter
            </button>
            <button
              onClick={() => {
                clearFired()
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 text-sm"
            >
              Reset injury triggers
            </button>
            <div className="border-t border-slate-700 my-1" />
            <button
              onClick={exportJson}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 text-sm"
            >
              Export encounter JSON…
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 text-sm"
            >
              Import encounter JSON…
            </button>
            <button
              onClick={exportLog}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 text-sm"
              title="Export the fight history (turns, damage, triggers, lair actions, deaths) as JSON — replay-ready for future features"
            >
              Export fight log…
            </button>
            <div className="border-t border-slate-700 my-1" />
            <div className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wide text-slate-500">
              Party
            </div>
            <button
              onClick={exportParty}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 text-sm"
              title="Save the current PCs to a file to reuse next session"
            >
              Export party (PCs)…
            </button>
            <button
              onClick={() => partyFileRef.current?.click()}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 text-sm"
              title="Add a saved party of PCs to this encounter"
            >
              Import party…
            </button>
          </div>
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={importJson}
      />
      <input
        ref={partyFileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={importParty}
      />
    </div>
  )
}
