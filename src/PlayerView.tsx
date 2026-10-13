import { Fragment, useEffect, useRef } from 'react'
import { useStore } from './store'
import { CONDITIONS } from './data/conditions'
import { hpStatus, hpStatusColor } from './utils/hpStatus'
import { withLairSlots } from './utils/order'
import Hourglass from './components/Hourglass'
import PlayerAnnouncementBanner from './components/PlayerAnnouncementBanner'
import CombatantIcon from './components/CombatantIcon'
import ThemeSwitcher from './components/ThemeSwitcher'
import { DeathSavePips } from './components/CombatantCard'
import { classLabel } from './data/playerClasses'

export default function PlayerView() {
  const combatants = useStore((s) => s.combatants)
  const currentId = useStore((s) => s.currentCombatantId)
  const round = useStore((s) => s.round)
  const timerRemaining = useStore((s) => s.timerRemaining)
  const timerSeconds = useStore((s) => s.timerSeconds)
  const timerRunning = useStore((s) => s.timerRunning)
  const labelNames = useStore((s) => s.strategyLabelNames)
  const lairAction = useStore((s) => s.lairAction)

  const activeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [currentId, combatants.length])

  // Legendary-action windows: a legendary creature with uses remaining may
  // act at the end of any turn other than its own, so the interjection shows
  // while someone else is on turn (and vanishes once uses run out).
  const legendaryReady = combatants.filter(
    (c) => !c.isDead && c.legendaryActions > c.legendaryUsed && c.id !== currentId
  )

  const danger = timerRemaining <= 10 && timerRunning

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <PlayerAnnouncementBanner />
      <header className="flex items-center gap-6 px-8 py-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
        <h1 className="text-3xl font-bold tracking-tight">⚔ Turnkeeper</h1>
        <ThemeSwitcher />
        <div className="flex-1" />
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-slate-400">Round</div>
          <div className="text-6xl font-bold leading-none tabular-nums">{round}</div>
        </div>
        <div
          className={`flex items-center gap-5 rounded-lg px-6 py-3 transition-colors ${
            danger ? 'bg-red-900/60 animate-pulse' : 'bg-slate-800'
          }`}
        >
          <Hourglass
            remaining={timerRemaining}
            total={timerSeconds}
            danger={danger}
            running={timerRunning}
            size={140}
          />
          <div className="text-left">
            <div className="text-xs uppercase tracking-widest text-slate-300">
              Turn Timer
            </div>
            <div
              className={`font-mono font-black leading-none tabular-nums ${
                danger ? 'text-red-200' : 'text-slate-100'
              }`}
              style={{ fontSize: '7rem' }}
            >
              {timerRemaining}
              <span className="text-4xl text-slate-400 font-normal ml-1">s</span>
            </div>
          </div>
        </div>
      </header>

      <main className="p-8">
        {combatants.length === 0 ? (
          <div className="text-center text-slate-500 text-xl py-24">
            Waiting for the DM…
          </div>
        ) : (
          <div className="space-y-2 max-w-5xl mx-auto">
            {withLairSlots(combatants, lairAction?.initiative ?? null).map((row) => {
              if (row.kind === 'lair') {
                return (
                  <div
                    key="lair"
                    className="rounded-lg border-2 border-purple-600 bg-purple-950/70 px-4 py-2 flex items-center gap-3"
                    title="The lair acts when the order passes this count"
                  >
                    <span className="text-xl" aria-hidden>
                      🐉
                    </span>
                    <span className="font-bold text-purple-200 tracking-wide">
                      {lairAction!.name || 'Lair Action'}
                    </span>
                    <span className="ml-auto text-xs text-purple-400">
                      lair acts at initiative {lairAction!.initiative}
                    </span>
                  </div>
                )
              }
              const c = row.value
              const isCurrent = c.id === currentId
              const name = c.nameVisibleToPlayers ? c.name : '???'
              const status = hpStatus(c)
              return (
                <Fragment key={c.id}>
                  <div
                    ref={isCurrent ? activeRef : undefined}
                    className={`rounded-lg p-4 flex items-center gap-4 transition-all scroll-mt-32 ${
                      isCurrent
                        ? 'bg-indigo-950/60 border-2 border-indigo-400 shadow-lg shadow-indigo-500/20 scale-[1.01]'
                        : 'bg-slate-900 border border-slate-800'
                    }`}
                  >
                    <div
                      className={`w-14 h-14 rounded flex items-center justify-center shrink-0 ${
                        c.type === 'monster'
                          ? 'bg-red-900/30 text-red-200'
                          : isCurrent
                          ? 'bg-indigo-900 text-slate-100'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                      title={
                        c.type === 'monster'
                          ? 'Monster / NPC'
                          : classLabel(c.playerClass)
                      }
                    >
                      <CombatantIcon
                        c={c}
                        size={36}
                        title={
                          c.type === 'monster'
                            ? 'Monster / NPC'
                            : classLabel(c.playerClass)
                        }
                      />
                    </div>
                    <div
                      className={`w-16 h-16 rounded flex flex-col items-center justify-center shrink-0 ${
                        isCurrent ? 'bg-indigo-900' : 'bg-slate-800'
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">INIT</div>
                      <div className="text-2xl font-bold leading-none">{c.initiative}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-2xl font-bold truncate">{name}</span>
                        <span
                          className={`text-sm font-semibold px-2 py-0.5 rounded ${hpStatusColor(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                        {c.concentration && (
                          <span className="text-sm px-2 py-0.5 rounded bg-sky-900 text-sky-100">
                            🧠 Concentrating
                          </span>
                        )}
                        {c.type === 'pc' && c.currentHP <= 0 && !c.isDead && (
                          <DeathSavePips deathSaves={c.deathSaves} />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {c.conditions.map((ac) => {
                          const def = CONDITIONS.find((x) => x.id === ac.id)
                          return def ? (
                            <span
                              key={ac.id}
                              title={def.description}
                              className="text-xs px-2 py-1 rounded bg-purple-900 text-purple-100"
                            >
                              <span aria-hidden>{def.icon}</span> {def.name}
                              {ac.rounds != null && ` (${ac.rounds})`}
                            </span>
                          ) : null
                        })}
                        {labelNames.map((n) => {
                          const count = c.strategyLabels[n]
                          return count && count > 0 ? (
                            <span
                              key={n}
                              className="text-xs px-2 py-1 rounded bg-amber-800 text-amber-50"
                            >
                              {n} {count}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                    {isCurrent && (
                      <div className="text-indigo-300 text-lg font-bold whitespace-nowrap">
                        ◀ ACTIVE
                      </div>
                    )}
                  </div>
                    {isCurrent &&
                      legendaryReady.map((l) => (
                        <div
                          key={l.id}
                          className="mx-2 flex items-center gap-2 rounded border border-indigo-600 bg-indigo-950/70 px-3 py-1 text-xs text-indigo-300"
                          title="Legendary actions may be taken at the end of another creature's turn"
                        >
                          <span aria-hidden>⚡</span>
                          <span>
                            <b>
                              {l.nameVisibleToPlayers ? l.name : 'A legendary foe'}
                            </b>{' '}
                            may take a legendary action
                          </span>
                          <span className="ml-auto tabular-nums text-indigo-400">
                            {l.legendaryActions - l.legendaryUsed} left
                          </span>
                        </div>
                      ))}
                </Fragment>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
