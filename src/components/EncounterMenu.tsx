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
  const state = useStore()
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
      currentTurnIndex,
      triggers,
      strategyLabelNames,
      tables,
      timerSeconds,
    } = state
    const payload = {
      combatants,
      round,
      currentTurnIndex,
      triggers,
      strategyLabelNames,
      tables,
      timerSeconds,
    }
    download(JSON.stringify(payload, null, 2), `turnkeeper-${today()}.json`)
    setOpen(false)
  }

  const exportParty = () => {
    const members = toParty(state.combatants)
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
      const data = JSON.parse(txt)
      if (!confirm('Replace the current encounter with imported data?')) return
      // Normalise through the same migration as persisted state so older files
      // (thresholds / oncePerTurn) and combatants missing the fired-trigger
      // arrays are brought up to the current schema.
      const norm = migratePersisted(data) as Record<string, unknown>
      const combatants = Array.isArray(norm.combatants) ? norm.combatants : []
      const rawIndex =
        typeof norm.currentTurnIndex === 'number' ? norm.currentTurnIndex : 0
      const triggers = Array.isArray(norm.triggers) ? norm.triggers : []
      const next: Partial<EncounterState> = {
        combatants: combatants as EncounterState['combatants'],
        round: typeof norm.round === 'number' ? norm.round : 1,
        // Clamp the turn index so an imported file can't point past the end.
        currentTurnIndex: Math.min(Math.max(0, rawIndex), Math.max(0, combatants.length - 1)),
        triggers: (triggers.length
          ? triggers
          : state.triggers) as EncounterState['triggers'],
        strategyLabelNames: Array.isArray(norm.strategyLabelNames)
          ? (norm.strategyLabelNames as string[])
          : ['Surrounded'],
        tables: (Array.isArray(norm.tables)
          ? norm.tables
          : state.tables) as EncounterState['tables'],
        timerSeconds: typeof norm.timerSeconds === 'number' ? norm.timerSeconds : 60,
        timerRemaining: typeof norm.timerSeconds === 'number' ? norm.timerSeconds : 60,
        timerRunning: false,
        triggerResults: [],
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
              Library — scenes & statblocks…
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
