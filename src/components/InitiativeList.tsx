import { Fragment } from 'react'
import { useStore } from '../store'
import CombatantCard from './CombatantCard'
import { withLairSlots } from '../utils/order'
import type { Combatant } from '../types'

// A slim marker row at the configured initiative count — a visual slot in the
// order, not a combatant (5e: the lair acts at count 20, losing ties, i.e.
// before the first combatant at or below that count).
const LairRow = ({ name, initiative }: { name: string; initiative: number }) => (
  <div
    className="my-1.5 mx-1 flex items-center gap-2 rounded-lg border border-purple-700 bg-purple-950/60 px-3 py-1.5 text-xs text-purple-300"
    title="The lair acts when the order passes this count"
  >
    <span aria-hidden>🐉</span>
    <span className="font-semibold tracking-wide">{name || 'Lair Action'}</span>
    <span className="ml-auto tabular-nums text-purple-400">initiative {initiative}</span>
  </div>
)

// Transient legendary-action window: while a legendary creature still has
// uses and someone else's turn is underway, a reminder is interjected after
// the current card. Deliberately not a permanent fixture — it disappears the
// moment uses run out or the creature's own turn comes up.
const LegendaryWindow = ({ c }: { c: Combatant }) => (
  <div
    className="mx-2 my-0.5 flex items-center gap-2 rounded border border-indigo-700 bg-indigo-950/70 px-3 py-1 text-[11px] text-indigo-300"
    title="Legendary actions may be taken at the end of another creature's turn"
  >
    <span aria-hidden>⚡</span>
    <span>
      <b>{c.name}</b> may take a legendary action
    </span>
    <span className="ml-auto tabular-nums text-indigo-400">
      {c.legendaryActions - c.legendaryUsed} left
    </span>
  </div>
)

export default function InitiativeList({
  expandedId,
  setExpandedId,
}: {
  expandedId: string | null
  setExpandedId: (id: string | null) => void
}) {
  const combatants = useStore((s) => s.combatants)
  const currentId = useStore((s) => s.currentCombatantId)
  const lairAction = useStore((s) => s.lairAction)

  if (combatants.length === 0) {
    return (
      <div className="text-slate-500 text-sm p-6 border border-dashed border-slate-700 rounded text-center">
        No combatants yet. Click <b className="text-slate-300">+ Add</b> to start an encounter.
      </div>
    )
  }

  const rows = withLairSlots(combatants, lairAction?.initiative ?? null)
  // A legendary creature can act after any turn other than its own, so the
  // window opens while someone else is on turn and uses remain.
  const legendaryReady = combatants.filter(
    (c) => !c.isDead && c.legendaryActions > c.legendaryUsed && c.id !== currentId
  )

  return (
    <div>
      {rows.map((row) => {
        if (row.kind === 'lair') {
          return (
            <LairRow
              key="lair"
              name={lairAction!.name}
              initiative={lairAction!.initiative}
            />
          )
        }
        const c = row.value
        return (
          <Fragment key={c.id}>
            <CombatantCard
              c={c}
              isCurrent={c.id === currentId}
              expanded={expandedId === c.id}
              onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
            />
            {c.id === currentId &&
              legendaryReady.map((l) => <LegendaryWindow key={l.id} c={l} />)}
          </Fragment>
        )
      })}
    </div>
  )
}