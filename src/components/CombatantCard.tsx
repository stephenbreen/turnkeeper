import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { ActiveCondition, Combatant, DeathSaves, PlayerClassId } from '../types'
import { CONDITIONS } from '../data/conditions'
import { hpStatus, hpStatusColor } from '../utils/hpStatus'
import { PLAYER_CLASSES, classLabel } from '../data/playerClasses'
import CombatantIcon from './CombatantIcon'
import StatblockView from './StatblockView'
import StatblockModal from './StatblockModal'

export default function CombatantCard({
  c,
  isCurrent,
  expanded,
  onToggle,
}: {
  c: Combatant
  isCurrent: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const update = useStore((s) => s.updateCombatant)
  const remove = useStore((s) => s.removeCombatant)
  const duplicate = useStore((s) => s.duplicateCombatant)
  const damage = useStore((s) => s.applyDamage)
  const heal = useStore((s) => s.applyHeal)
  const toggleCondition = useStore((s) => s.toggleCondition)
  const setCondition = useStore((s) => s.setCondition)
  const recordDeathSave = useStore((s) => s.recordDeathSave)
  const labelNames = useStore((s) => s.strategyLabelNames)
  const setStrategyStack = useStore((s) => s.setStrategyStack)
  const statblocks = useStore((s) => s.statblocks)
  const sb = c.statblockId ? statblocks.find((x) => x.id === c.statblockId) : undefined
  const [sbOpen, setSbOpen] = useState(false)
  const [condOpen, setCondOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  // Draft name while editing. The store is only touched on commit, so Escape
  // can truly revert instead of leaving half-typed edits in place.
  const [nameDraft, setNameDraft] = useState('')

  const startRename = () => {
    setNameDraft(c.name)
    setEditingName(true)
  }
  const commitRename = () => {
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== c.name) update(c.id, { name: trimmed })
    setEditingName(false)
  }

  // Row-header quick HP control — keyboard-driven (Enter / Shift+Enter).
  const [quick, setQuick] = useState('')
  const quickInputRef = useRef<HTMLInputElement>(null)

  // Expanded-view controls — click-driven dual inputs.
  const [dmg, setDmg] = useState('')
  const [hl, setHl] = useState('')

  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isCurrent) {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isCurrent])

  useEffect(() => {
    if (!isCurrent) return
    const handler = () => {
      const el = quickInputRef.current
      if (!el) return
      el.focus()
      el.select()
    }
    window.addEventListener('focus-active-hp', handler)
    return () => window.removeEventListener('focus-active-hp', handler)
  }, [isCurrent])

  const pct = Math.max(0, Math.min(100, (c.currentHP / Math.max(1, c.maxHP)) * 100))
  const status = hpStatus(c)

  const applyQuick = (kind: 'damage' | 'heal') => {
    const n = parseInt(quick, 10)
    if (!n || n <= 0) return
    if (kind === 'damage') damage(c.id, n)
    else heal(c.id, n)
    setQuick('')
  }

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div
      ref={rootRef}
      className={`mb-2 rounded-lg border transition-colors scroll-mt-24 ${
        isCurrent
          ? 'border-indigo-400 bg-indigo-950/40 ring-2 ring-indigo-500/30'
          : 'border-slate-800 bg-slate-900'
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          // Toggle only when this row itself owns focus, not a child input.
          if (
            (e.key === 'Enter' || e.key === ' ') &&
            e.currentTarget === e.target
          ) {
            e.preventDefault()
            onToggle()
          }
        }}
        className="w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 text-left hover:bg-white/5 cursor-pointer select-none"
      >
        {/* Class / monster icon */}
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded flex items-center justify-center shrink-0 ${
            c.type === 'monster'
              ? 'bg-red-900/40 text-red-200'
              : isCurrent
              ? 'bg-indigo-900 text-slate-100'
              : 'bg-slate-800 text-slate-200'
          }`}
          title={c.type === 'monster' ? 'Monster / NPC' : classLabel(c.playerClass)}
        >
          <CombatantIcon
            c={c}
            size={24}
            title={c.type === 'monster' ? 'Monster / NPC' : classLabel(c.playerClass)}
          />
        </div>

        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-slate-800 flex flex-col items-center justify-center text-xs shrink-0">
          <div className="text-slate-400 text-[9px] sm:text-[10px]">INIT</div>
          <div className="font-bold text-sm sm:text-base leading-none">{c.initiative}</div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {editingName ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onClick={stop}
                onKeyDown={(e) => {
                  stop(e)
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitRename()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    // Revert: reset the draft so a stray blur-event commit
                    // after this is a no-op, then close without writing.
                    setNameDraft(c.name)
                    setEditingName(false)
                    e.currentTarget.blur()
                  }
                }}
                onBlur={commitRename}
                className="input text-sm font-semibold w-36 sm:w-44"
                placeholder="Name"
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                data-form-type="other"
              />
            ) : (
              <span className="font-semibold truncate">{c.name}</span>
            )}
            {expanded && !editingName && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  startRename()
                }}
                className="shrink-0 w-7 h-7 sm:w-6 sm:h-6 rounded flex items-center justify-center text-sm text-slate-400 hover:bg-white/10 hover:text-slate-200"
                title="Rename"
                aria-label={`Rename ${c.name}`}
              >
                ✏️
              </button>
            )}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                c.type === 'pc' ? 'bg-emerald-900 text-emerald-200' : 'bg-red-900 text-red-200'
              }`}
            >
              {c.type === 'pc' ? 'PC' : 'NPC'}
            </span>
            {c.isDead && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                DEAD
              </span>
            )}
            {!c.nameVisibleToPlayers && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400"
                title="Name is hidden from players"
              >
                👁‍🗨 hidden
              </span>
            )}
            {sb && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSbOpen(true)
                }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-200 hover:bg-red-900"
                title={`${sb.name}${sb.ac ? ` · AC ${sb.ac}` : ''}${
                  sb.hp ? ` · HP ${sb.hp}` : ''
                }${sb.cr ? ` · CR ${sb.cr}` : ''} — click for full statblock`}
              >
                📜 statblock
              </button>
            )}
            {c.concentration && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded bg-sky-900 text-sky-200"
                title={`Concentrating on ${c.concentration}`}
              >
                🧠 {c.concentration}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-2 bg-slate-800 rounded overflow-hidden min-w-[4rem]">
              <div
                className={`h-full transition-all ${
                  pct > 50
                    ? 'bg-emerald-500'
                    : pct > 25
                    ? 'bg-amber-500'
                    : pct > 0
                    ? 'bg-red-500'
                    : 'bg-slate-700'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs sm:text-sm font-mono whitespace-nowrap text-slate-200">
              {c.currentHP}/{c.maxHP}
              {c.tempHP > 0 && (
                <span className="text-sky-400" title={`${c.tempHP} temporary HP`}>
                  {' '}
                  +{c.tempHP}
                </span>
              )}
            </span>
            <span className="text-[11px] text-slate-500 whitespace-nowrap">AC {c.AC}</span>
            <span className="hidden sm:inline text-[11px] text-slate-500 whitespace-nowrap">
              PP {c.passivePerception}
            </span>
          </div>
          {(c.conditions.length > 0 ||
            labelNames.some((n) => c.strategyLabels[n])) && (
            <div className="flex gap-1 flex-wrap mt-1.5">
              {c.conditions.map((ac) => {
                const def = CONDITIONS.find((x) => x.id === ac.id)
                if (!def) return null
                return (
                  <span
                    key={ac.id}
                    title={`${def.name} — ${def.description}${
                      ac.saveEnds ? ' (save ends)' : ''
                    }`}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-200"
                  >
                    <span aria-hidden>{def.icon}</span> {def.name}
                    {ac.rounds != null && <span className="text-purple-300"> ⏳{ac.rounds}</span>}
                  </span>
                )
              })}
              {labelNames.map((n) => {
                const count = c.strategyLabels[n]
                return count ? (
                  <span
                    key={n}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-100"
                  >
                    {n} {count}
                  </span>
                ) : null
              })}
            </div>
          )}
        </div>

        {/* Quick HP input — keyboard-first; H focuses this on the active row.
            Hidden on small screens to keep the mobile row uncluttered; mobile
            users tap to expand and use the dual inputs below. */}
        <div
          className="hidden sm:flex items-center shrink-0"
          onClick={stop}
          onKeyDown={stop}
        >
          <input
            ref={quickInputRef}
            type="number"
            inputMode="numeric"
            placeholder="HP"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyQuick(e.shiftKey ? 'heal' : 'damage')
              } else if (e.key === 'Escape') {
                setQuick('')
                e.currentTarget.blur()
              }
            }}
            className="input w-14 text-center"
            title="Enter damages · Shift+Enter heals · ↑/↓ steps · Esc clears"
          />
        </div>

        <div className="text-slate-500 text-lg ml-1 shrink-0 self-center">
          {expanded ? '▾' : '▸'}
        </div>
      </div>

      {expanded && (
        <div className="px-2 sm:px-3 pb-3 pt-2 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 flex-1 min-w-0">
              <input
                type="number"
                placeholder="dmg"
                value={dmg}
                onChange={(e) => setDmg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const n = parseInt(dmg, 10)
                    if (n > 0) {
                      damage(c.id, n)
                      setDmg('')
                    }
                  }
                }}
                className="input w-16 sm:w-20"
              />
              <button
                onClick={() => {
                  const n = parseInt(dmg, 10)
                  if (n > 0) {
                    damage(c.id, n)
                    setDmg('')
                  }
                }}
                className="btn-danger"
              >
                Damage
              </button>
            </div>
            <div className="flex gap-1 flex-1 min-w-0">
              <input
                type="number"
                placeholder="heal"
                value={hl}
                onChange={(e) => setHl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const n = parseInt(hl, 10)
                    if (n > 0) {
                      heal(c.id, n)
                      setHl('')
                    }
                  }
                }}
                className="input w-16 sm:w-20"
              />
              <button
                onClick={() => {
                  const n = parseInt(hl, 10)
                  if (n > 0) {
                    heal(c.id, n)
                    setHl('')
                  }
                }}
                className="btn-primary"
              >
                Heal
              </button>
            </div>
            <span className="text-xs text-slate-400 ml-auto">
              Status{' '}
              <span className={`px-1.5 py-0.5 rounded ${hpStatusColor(status)} text-xs`}>
                {status}
              </span>
            </span>
          </div>

          {/* Combat state: temp HP + concentration */}
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <label className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">
                Temp HP
              </span>
              <input
                type="number"
                min={0}
                value={c.tempHP || ''}
                placeholder="0"
                onChange={(e) =>
                  update(c.id, { tempHP: Math.max(0, parseInt(e.target.value, 10) || 0) })
                }
                className="input w-16"
                title="Temporary hit points — absorbed before real HP"
              />
            </label>
            <label className="flex items-center gap-1.5 flex-1 min-w-[12rem]">
              <span className="text-[10px] uppercase tracking-wide text-slate-400 whitespace-nowrap">
                🧠 Concentrating
              </span>
              <input
                value={c.concentration ?? ''}
                placeholder="—"
                onChange={(e) =>
                  update(c.id, {
                    concentration: e.target.value.trim() ? e.target.value : null,
                  })
                }
                className="input flex-1"
                title="Name the spell/effect; taking damage prompts a Constitution save"
              />
              {c.concentration && (
                <button
                  onClick={() => update(c.id, { concentration: null })}
                  className="btn text-xs"
                  title="Clear concentration"
                >
                  ×
                </button>
              )}
            </label>
          </div>

          {/* Death saves — PCs at 0 HP */}
          {c.type === 'pc' && c.currentHP <= 0 && !c.isDead && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">
                Death saves
              </span>
              <DeathSavePips
                deathSaves={c.deathSaves}
                onSet={(kind, value) => recordDeathSave(c.id, kind, value)}
              />
              {c.deathSaves.successes >= 3 && (
                <span className="text-xs font-semibold text-emerald-400">Stable</span>
              )}
            </div>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
              Conditions
            </div>
            <div className="flex flex-wrap gap-1 items-center">
              {c.conditions.map((ac) => {
                const def = CONDITIONS.find((x) => x.id === ac.id)
                if (!def) return null
                return (
                  <span
                    key={ac.id}
                    title={`${def.name} — ${def.description}`}
                    className="inline-flex items-center gap-1 text-xs pl-2 pr-1 py-1 rounded bg-purple-700 text-white"
                  >
                    <span aria-hidden>{def.icon}</span>
                    {def.name}
                    {ac.rounds != null && (
                      <span className="text-purple-200" title={`${ac.rounds} rounds left`}>
                        ⏳{ac.rounds}
                      </span>
                    )}
                    {ac.saveEnds && (
                      <span className="text-[9px] text-purple-200" title="Save ends">
                        SE
                      </span>
                    )}
                    <button
                      onClick={() => toggleCondition(c.id, ac.id)}
                      className="ml-0.5 w-6 h-6 sm:w-4 sm:h-4 rounded-full hover:bg-black/25 flex items-center justify-center leading-none text-base sm:text-xs"
                      title={`Remove ${def.name}`}
                      aria-label={`Remove ${def.name}`}
                    >
                      ×
                    </button>
                  </span>
                )
              })}
              <button
                onClick={() => setCondOpen(true)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
                title="Add conditions"
              >
                <span className="text-sm leading-none">＋</span> Add
              </button>
              {c.conditions.length === 0 && (
                <span className="text-xs text-slate-500 italic">none</span>
              )}
            </div>
          </div>

          {labelNames.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                Strategy labels
              </div>
              <div className="flex flex-wrap gap-1">
                {labelNames.map((name) => {
                  const count = c.strategyLabels[name] ?? 0
                  return (
                    <div
                      key={name}
                      className={`flex items-center rounded overflow-hidden text-xs ${
                        count > 0
                          ? 'bg-amber-800 text-amber-50'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <button
                        onClick={() => setStrategyStack(c.id, name, count - 1)}
                        className="px-2 py-1 hover:bg-black/20"
                      >
                        −
                      </button>
                      <span className="px-2">
                        {name}
                        {count > 0 ? ` ${count}` : ''}
                      </span>
                      <button
                        onClick={() => setStrategyStack(c.id, name, count + 1)}
                        className="px-2 py-1 hover:bg-black/20"
                      >
                        +
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sheet stats */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">
              Stats
            </div>
            {c.type === 'pc' && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  Class
                </span>
                <select
                  value={c.playerClass ?? 'none'}
                  onChange={(e) =>
                    update(c.id, { playerClass: e.target.value as PlayerClassId })
                  }
                  className="input"
                  title="Sets the icon shown in the player view. Default is the adventurer sword."
                >
                  {PLAYER_CLASSES.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  Initiative
                </span>
                <input
                  type="number"
                  value={c.initiative}
                  onChange={(e) =>
                    update(c.id, { initiative: parseInt(e.target.value, 10) || 0 })
                  }
                  className="input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  Max HP
                </span>
                <input
                  type="number"
                  value={c.maxHP}
                  onChange={(e) =>
                    update(c.id, { maxHP: Math.max(1, parseInt(e.target.value, 10) || 1) })
                  }
                  className="input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">AC</span>
                <input
                  type="number"
                  value={c.AC}
                  onChange={(e) => update(c.id, { AC: parseInt(e.target.value, 10) || 0 })}
                  className="input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  Passive Perception
                </span>
                <input
                  type="number"
                  value={c.passivePerception}
                  onChange={(e) =>
                    update(c.id, { passivePerception: parseInt(e.target.value, 10) || 0 })
                  }
                  className="input"
                />
              </label>
            </div>
          </div>

          {(statblocks.length > 0 || sb) && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                Statblock
              </div>
              <select
                value={c.statblockId ?? ''}
                onChange={(e) =>
                  update(c.id, { statblockId: e.target.value || undefined })
                }
                className="input w-full"
                title="Link a statblock from your library (DM-only reference)"
              >
                <option value="">— none —</option>
                {statblocks.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {sb && (
                <div className="mt-2 rounded-lg border border-[color:rgb(var(--sb-heading)/0.4)] bg-slate-950/40 p-3">
                  <StatblockView sb={sb} />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-wide text-slate-400 block mb-1">
              Notes
            </label>
            <textarea
              value={c.notes}
              onChange={(e) => update(c.id, { notes: e.target.value })}
              className="input w-full"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-800">
            <label className="flex items-center gap-1 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={c.nameVisibleToPlayers}
                onChange={(e) => update(c.id, { nameVisibleToPlayers: e.target.checked })}
              />
              Show name to players
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={c.isDead}
                onChange={(e) => update(c.id, { isDead: e.target.checked })}
              />
              Dead
            </label>
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <button
                onClick={() => duplicate(c.id)}
                className="btn"
                title="Add a fresh full-HP copy of this combatant"
              >
                ⧉ Duplicate
              </button>
              <button
                onClick={() => {
                  if (confirm(`Remove ${c.name} from the encounter?`)) remove(c.id)
                }}
                className="btn-danger"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <StatblockModal sb={sbOpen ? sb ?? null : null} onClose={() => setSbOpen(false)} />
      <ConditionsModal
        open={condOpen}
        onClose={() => setCondOpen(false)}
        name={c.name}
        active={c.conditions}
        onToggle={(id) => toggleCondition(c.id, id)}
        onSetDuration={(condId, patch) => setCondition(c.id, condId, patch)}
      />
    </div>
  )
}

// Three success + three failure pips. Clicking pip N sets the count to N, or
// back to N−1 if it's already there. Read-only when onSet is omitted.
export function DeathSavePips({
  deathSaves,
  onSet,
}: {
  deathSaves: DeathSaves
  onSet?: (kind: 'successes' | 'failures', value: number) => void
}) {
  const group = (kind: 'successes' | 'failures', on: string, off: string) => (
    <div className="flex gap-1">
      {[1, 2, 3].map((i) => {
        const filled = deathSaves[kind] >= i
        // Interactive pips (DM card) grow on touch; read-only pips stay compact.
        const size = onSet ? 'w-6 h-6 sm:w-5 sm:h-5' : 'w-4 h-4'
        const cls = `${size} rounded-full border ${filled ? on : off}`
        const label = `${kind === 'successes' ? 'Success' : 'Failure'} ${i}`
        return onSet ? (
          <button
            key={i}
            onClick={() => onSet(kind, deathSaves[kind] === i ? i - 1 : i)}
            className={cls}
            title={label}
            aria-label={label}
          />
        ) : (
          <span key={i} className={cls} title={label} aria-hidden />
        )
      })}
    </div>
  )
  return (
    <div className="flex items-center gap-2">
      {group('successes', 'bg-emerald-500 border-emerald-400', 'bg-transparent border-emerald-700')}
      <span className="text-slate-600 text-xs">/</span>
      {group('failures', 'bg-red-500 border-red-400', 'bg-transparent border-red-800')}
    </div>
  )
}

// Modal overlay for adding/removing conditions. Lists every condition with its
// icon and name; tap to toggle — several can be picked before closing.
function ConditionsModal({
  open,
  onClose,
  name,
  active,
  onToggle,
  onSetDuration,
}: {
  open: boolean
  onClose: () => void
  name: string
  active: ActiveCondition[]
  onToggle: (id: string) => void
  onSetDuration: (
    conditionId: string,
    patch: Partial<Pick<ActiveCondition, 'rounds' | 'saveEnds'>>
  ) => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-[34rem] max-w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
          <h3 className="font-bold">Conditions</h3>
          <span className="text-sm text-slate-400 truncate">— {name}</span>
          <div className="flex-1" />
          <button onClick={onClose} className="btn-primary text-sm">
            Done
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {CONDITIONS.map((cond) => {
              const on = active.some((a) => a.id === cond.id)
              return (
                <button
                  key={cond.id}
                  onClick={() => onToggle(cond.id)}
                  title={cond.description}
                  aria-pressed={on}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-left text-sm transition ${
                    on
                      ? 'bg-purple-700 text-white'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <span aria-hidden className="text-lg leading-none w-6 text-center">
                    {cond.icon}
                  </span>
                  <span className="flex-1 leading-tight">{cond.name}</span>
                  {on && <span className="text-xs">✓</span>}
                </button>
              )
            })}
          </div>

          {active.length > 0 && (
            <div className="px-3 pb-3 pt-2 border-t border-slate-800">
              <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">
                Durations
              </div>
              <div className="space-y-1.5">
                {active.map((ac) => {
                  const def = CONDITIONS.find((x) => x.id === ac.id)
                  if (!def) return null
                  return (
                    <div key={ac.id} className="flex items-center gap-2 text-sm">
                      <span aria-hidden className="w-5 text-center">
                        {def.icon}
                      </span>
                      <span className="flex-1 truncate">{def.name}</span>
                      <label className="flex items-center gap-1 text-xs text-slate-400">
                        <input
                          type="number"
                          min={1}
                          value={ac.rounds ?? ''}
                          placeholder="∞"
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10)
                            onSetDuration(ac.id, { rounds: !isNaN(n) && n > 0 ? n : null })
                          }}
                          className="input w-16"
                          title="Rounds remaining — ticks down on this combatant's turn. Blank = no timer."
                        />
                        rounds
                      </label>
                      <label className="flex items-center gap-1 text-xs text-slate-400">
                        <input
                          type="checkbox"
                          checked={ac.saveEnds}
                          onChange={(e) => onSetDuration(ac.id, { saveEnds: e.target.checked })}
                        />
                        save ends
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-800 text-xs text-slate-500">
          Tap a condition to add or remove it. Set a rounds timer (ticks down on
          the combatant's turn) or mark "save ends" below. Esc or Done when finished.
        </div>
      </div>
    </div>
  )
}
