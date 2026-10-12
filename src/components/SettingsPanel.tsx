import { useState } from 'react'
import { useStore } from '../store'
import { CONDITIONS } from '../data/conditions'
import type { RollTable, Trigger, TriggerDedupe, TriggerEventKind } from '../types'

type TriggerActionKind = Trigger['action']['kind']

const EVENT_OPTIONS: { value: TriggerEventKind; label: string }[] = [
  { value: 'massiveDamage', label: 'Single hit ≥ % of max HP' },
  { value: 'hpReachedZero', label: 'Combatant drops to 0 HP' },
  { value: 'hpBelow', label: 'HP crosses below % of max' },
  { value: 'combatantAdded', label: 'Combatant is added' },
  { value: 'turnStart', label: 'A combatant’s turn begins' },
  { value: 'roundStart', label: 'A round begins' },
  { value: 'conditionGained', label: 'A condition is applied' },
]

const ACTION_OPTIONS: { value: TriggerActionKind; label: string }[] = [
  { value: 'rollTable', label: 'Roll on a table' },
  { value: 'notify', label: 'Show a note' },
  { value: 'applyCondition', label: 'Apply a condition' },
  { value: 'damage', label: 'Deal automatic damage' },
  { value: 'heal', label: 'Restore HP automatically' },
]

const SCOPE_OPTIONS: { value: Trigger['scope']; label: string }[] = [
  { value: 'any', label: 'All combatants' },
  { value: 'pc', label: 'PCs only' },
  { value: 'monster', label: 'Monsters / NPCs only' },
]

const DEDUPE_OPTIONS: { value: TriggerDedupe; label: string }[] = [
  { value: 'always', label: 'Every time' },
  { value: 'perTurn', label: 'Once per turn' },
  { value: 'perRound', label: 'Once per round' },
]

const DEDUPE_LABEL: Record<TriggerDedupe, string> = {
  always: 'every time',
  perTurn: 'once per turn',
  perRound: 'once per round',
}

const VISIBILITY_OPTIONS: { value: Trigger['visibility']; label: string }[] = [
  { value: 'dm', label: 'DM only' },
  { value: 'players', label: 'Players only' },
  { value: 'both', label: 'DM + players' },
]

const conditionName = (id: string) =>
  CONDITIONS.find((c) => c.id === id)?.name ?? id

// Round-level events have no combatant, so scope and dedupe don't apply.
const isRoundLevel = (t: Trigger) => t.event.kind === 'roundStart'

function describe(t: Trigger, tables: RollTable[]): string {
  let when: string
  switch (t.event.kind) {
    case 'massiveDamage':
      when = `a single hit deals ≥ ${t.event.percentOfMax}% of max HP`
      break
    case 'hpReachedZero':
      when = 'a combatant drops to 0 HP'
      break
    case 'combatantAdded':
      when = 'a combatant is added'
      break
    case 'hpBelow':
      when = `HP crosses below ${t.event.percentOfMax}% of max`
      break
    case 'roundStart':
      when = t.event.round === 0 ? 'every round begins' : `round ${t.event.round} begins`
      break
    case 'turnStart':
      when = 'a scoped combatant’s turn begins'
      break
    case 'conditionGained':
      when = `a combatant gains ${conditionName(t.event.conditionId)}`
      break
  }

  const scope =
    isRoundLevel(t) || t.scope === 'any'
      ? ''
      : ` (${t.scope === 'pc' ? 'PCs' : 'monsters'} only)`

  let then: string
  switch (t.action.kind) {
    case 'rollTable': {
      const action = t.action
      const table = tables.find((x) => x.id === action.tableId)
      then = `roll ${table ? `"${table.name}"` : '(no table)'}${
        action.rolls > 1 ? ` ×${action.rolls}` : ''
      }`
      break
    }
    case 'notify':
      then = 'show a note'
      break
    case 'applyCondition':
      then = `apply ${conditionName(t.action.conditionId)}${
        t.action.rounds != null ? ` for ${t.action.rounds} round(s)` : ''
      }${t.action.saveEnds ? ' (save ends)' : ''}`
      break
    case 'damage':
      then = `deal ${t.action.amount} damage automatically`
      break
    case 'heal':
      then = `restore ${t.action.amount} HP automatically`
      break
  }
  // Cadence only applies to per-combatant events.
  const cadence =
    isRoundLevel(t) || t.event.kind === 'combatantAdded' || t.dedupe === 'always'
      ? ''
      : ` (${DEDUPE_LABEL[t.dedupe]})`
  const vis =
    t.visibility === 'both' ? '' : t.visibility === 'dm' ? ' [DM only]' : ' [players only]'
  return `When ${when}${scope} → ${then}${cadence}.${vis}`
}

export default function SettingsPanel() {
  const triggers = useStore((s) => s.triggers)
  const tables = useStore((s) => s.tables)
  const addTrigger = useStore((s) => s.addTrigger)
  const clearFired = useStore((s) => s.clearFiredTriggers)
  const labelNames = useStore((s) => s.strategyLabelNames)
  const addLabel = useStore((s) => s.addStrategyLabel)
  const removeLabel = useStore((s) => s.removeStrategyLabel)
  const lairAction = useStore((s) => s.lairAction)
  const setLairAction = useStore((s) => s.setLairAction)

  const [newLabel, setNewLabel] = useState('')

  const handleAddTrigger = () => {
    addTrigger({
      name: 'New trigger',
      enabled: true,
      scope: 'any',
      dedupe: 'perTurn',
      event: { kind: 'massiveDamage', percentOfMax: 25 },
      action: { kind: 'rollTable', tableId: tables[0]?.id ?? null, rolls: 1 },
      visibility: 'both',
    })
  }

  return (
    <div className="p-3 sm:p-4 space-y-6 h-full overflow-y-auto">
      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold">Triggers</h3>
          <button onClick={handleAddTrigger} className="btn text-xs">
            + Add trigger
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Rules that fire when something happens in combat — "when EVENT → do
          ACTION." The seeded injury rule is two triggers on one sample table:
          a single hit dealing ≥ 25 % of max HP rolls the injury table once; ≥
          50 % rolls the <em>same</em> table twice. When several thresholds
          match one hit, only the most severe fires. HP thresholds are
          crossing-based (healing back above re-arms them), and automatic
          damage/heal from a trigger never re-fires triggers — bleeding engines
          can’t cascade. <b>DM + players</b> results also appear as a banner
          on the player window.
        </p>

        <div className="space-y-2">
          {triggers.length === 0 && (
            <div className="text-xs text-slate-500 italic">
              No triggers. Add one to start.
            </div>
          )}
          {triggers.map((t) => (
            <TriggerEditor key={t.id} trigger={t} tables={tables} />
          ))}
        </div>

        <button
          onClick={clearFired}
          className="btn mt-3 text-xs"
          title="Manually clear fired triggers (also resets on every turn advance)"
        >
          Reset fired triggers now
        </button>
      </section>

      <section>
        <h3 className="font-semibold mb-1">Lair action</h3>
        <p className="text-xs text-slate-400 mb-2">
          Optionally mark a lair-action slot at an initiative count (5e
          convention: 20). A marker row appears in the initiative order and a
          reminder fires when the count is passed — visible to players too.
        </p>
        {lairAction ? (
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 flex items-center gap-2 flex-wrap text-sm">
            <input
              value={lairAction.name}
              onChange={(e) =>
                setLairAction({ ...lairAction, name: e.target.value })
              }
              className="input flex-1 min-w-[8rem]"
              placeholder="Lair Action"
            />
            <label className="flex items-center gap-1 text-xs text-slate-400">
              Initiative
              <input
                type="number"
                min={-20}
                max={40}
                value={lairAction.initiative}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  if (!isNaN(n)) setLairAction({ ...lairAction, initiative: n })
                }}
                className="input w-16"
              />
            </label>
            <button
              onClick={() => setLairAction(null)}
              className="btn text-red-400 text-xs"
            >
              Disable
            </button>
          </div>
        ) : (
          <button
            onClick={() => setLairAction({ initiative: 20, name: 'Lair Action' })}
            className="btn text-xs"
          >
            Enable lair action at initiative 20
          </button>
        )}
      </section>

      <section>
        <h3 className="font-semibold mb-1">Strategy labels</h3>
        <p className="text-xs text-slate-400 mb-2">
          Stackable tactical labels the DM applies to combatants (e.g., Surrounded 1/2/3).
          Visible to players.
        </p>
        <div className="flex flex-wrap gap-1 mb-2">
          {labelNames.length === 0 && (
            <div className="text-xs text-slate-500 italic">No labels defined.</div>
          )}
          {labelNames.map((n) => (
            <div
              key={n}
              className="flex items-center bg-slate-800 rounded overflow-hidden text-sm"
            >
              <span className="px-2 py-1">{n}</span>
              <button
                onClick={() => {
                  if (confirm(`Remove "${n}" label and clear it from all combatants?`))
                    removeLabel(n)
                }}
                className="px-2 py-1 hover:bg-red-900 text-red-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const v = newLabel.trim()
            if (v) {
              addLabel(v)
              setNewLabel('')
            }
          }}
          className="flex gap-2"
        >
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Flanked"
            className="input flex-1"
          />
          <button type="submit" className="btn">
            Add
          </button>
        </form>
      </section>

      <section className="text-xs text-slate-500 pt-4 border-t border-slate-800">
        <div>💾 State auto-saves to this browser's localStorage.</div>
        <div>🔗 Player view syncs via BroadcastChannel.</div>
      </section>
    </div>
  )
}

function TriggerEditor({ trigger: t, tables }: { trigger: Trigger; tables: RollTable[] }) {
  const update = useStore((s) => s.updateTrigger)
  const remove = useStore((s) => s.removeTrigger)

  const setEventKind = (kind: TriggerEventKind) => {
    if (kind === 'massiveDamage' || kind === 'hpBelow')
      update(t.id, { event: { kind, percentOfMax: 50 } })
    else if (kind === 'roundStart') update(t.id, { event: { kind, round: 1 } })
    else if (kind === 'conditionGained')
      update(t.id, { event: { kind, conditionId: CONDITIONS[0].id } })
    else update(t.id, { event: { kind } })
  }

  const setActionKind = (kind: TriggerActionKind) => {
    if (kind === 'rollTable')
      update(t.id, { action: { kind, tableId: tables[0]?.id ?? null, rolls: 1 } })
    else if (kind === 'notify') update(t.id, { action: { kind, text: '' } })
    else if (kind === 'applyCondition')
      update(t.id, {
        action: { kind, conditionId: CONDITIONS[0].id, rounds: null, saveEnds: false },
      })
    else if (kind === 'damage') update(t.id, { action: { kind, amount: 5 } })
    else update(t.id, { action: { kind: 'heal', amount: 5 } })
  }

  // The action select's value is the discriminating kind — but when the
  // legacy action shape is somehow missing, fall back to notify so the
  // editor still renders something coherent.
  const actionKind: TriggerActionKind = t.action.kind

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        t.enabled ? 'border-slate-700 bg-slate-900' : 'border-slate-800 bg-slate-900/40'
      }`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={t.enabled}
          onChange={(e) => update(t.id, { enabled: e.target.checked })}
          title={t.enabled ? 'Enabled' : 'Disabled'}
        />
        <input
          value={t.name}
          onChange={(e) => update(t.id, { name: e.target.value })}
          className="input flex-1 font-semibold"
        />
        <button
          onClick={() => {
            if (confirm(`Delete trigger "${t.name}"?`)) remove(t.id)
          }}
          className="btn text-red-400"
          title="Delete trigger"
        >
          ×
        </button>
      </div>

      <div className="text-[11px] text-slate-400 italic">{describe(t, tables)}</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">When</span>
          <select
            value={t.event.kind}
            onChange={(e) => setEventKind(e.target.value as TriggerEventKind)}
            className="input"
          >
            {EVENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {(t.event.kind === 'massiveDamage' || t.event.kind === 'hpBelow') && (
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Threshold %
            </span>
            <input
              type="number"
              min={1}
              max={100}
              value={t.event.percentOfMax}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                if (isNaN(n) || n <= 0 || n > 100) return
                // Re-narrow inside the callback — JSX condition narrowing
                // doesn't cross function boundaries.
                if (t.event.kind === 'massiveDamage')
                  update(t.id, { event: { kind: 'massiveDamage', percentOfMax: n } })
                else if (t.event.kind === 'hpBelow')
                  update(t.id, { event: { kind: 'hpBelow', percentOfMax: n } })
              }}
              className="input w-24"
            />
          </label>
        )}

        {t.event.kind === 'roundStart' && (
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Round (0 = every round)
            </span>
            <input
              type="number"
              min={0}
              max={99}
              value={t.event.round}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                if (!isNaN(n) && n >= 0)
                  update(t.id, { event: { kind: 'roundStart', round: n } })
              }}
              className="input w-24"
            />
          </label>
        )}

        {t.event.kind === 'conditionGained' && (
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Condition
            </span>
            <select
              value={t.event.conditionId}
              onChange={(e) =>
                update(t.id, { event: { kind: 'conditionGained', conditionId: e.target.value } })
              }
              className="input"
            >
              {CONDITIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {!isRoundLevel(t) && (
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Applies to
            </span>
            <select
              value={t.scope}
              onChange={(e) => update(t.id, { scope: e.target.value as Trigger['scope'] })}
              className="input"
            >
              {SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Then</span>
          <select
            value={actionKind}
            onChange={(e) => setActionKind(e.target.value as TriggerActionKind)}
            className="input"
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            Show result to
          </span>
          <select
            value={t.visibility}
            onChange={(e) =>
              update(t.id, { visibility: e.target.value as Trigger['visibility'] })
            }
            className="input"
            title="Where the fired result appears — the DM toast, the player window's banner, or both"
          >
            {VISIBILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {t.action.kind === 'rollTable' ? (
          <>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                Table
              </span>
              <select
                value={t.action.tableId ?? ''}
                onChange={(e) =>
                  update(t.id, {
                    action: {
                      kind: 'rollTable',
                      tableId: e.target.value || null,
                      rolls: t.action.kind === 'rollTable' ? t.action.rolls : 1,
                    },
                  })
                }
                className="input"
              >
                <option value="">— none —</option>
                {tables.map((tbl) => (
                  <option key={tbl.id} value={tbl.id}>
                    {tbl.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                Roll count
              </span>
              <input
                type="number"
                min={1}
                max={20}
                value={t.action.rolls}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  update(t.id, {
                    action: {
                      kind: 'rollTable',
                      tableId: t.action.kind === 'rollTable' ? t.action.tableId : null,
                      rolls: !isNaN(n) && n > 0 ? n : 1,
                    },
                  })
                }}
                className="input w-24"
              />
            </label>
          </>
        ) : t.action.kind === 'notify' ? (
          <label className="flex flex-col gap-0.5 sm:col-span-2">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Note to show
            </span>
            <input
              value={t.action.kind === 'notify' ? t.action.text : ''}
              onChange={(e) =>
                update(t.id, { action: { kind: 'notify', text: e.target.value } })
              }
              className="input"
              placeholder="e.g. The ceiling rumbles — remind players to save"
            />
          </label>
        ) : t.action.kind === 'applyCondition' ? (
          <>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                Condition
              </span>
              <select
                value={t.action.conditionId}
                onChange={(e) =>
                  update(t.id, {
                    action: {
                      kind: 'applyCondition',
                      conditionId: e.target.value,
                      rounds: t.action.kind === 'applyCondition' ? t.action.rounds : null,
                      saveEnds:
                        t.action.kind === 'applyCondition' ? t.action.saveEnds : false,
                    },
                  })
                }
                className="input"
              >
                {CONDITIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-3 flex-wrap">
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  Rounds (blank = untimed)
                </span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={t.action.kind === 'applyCondition' ? (t.action.rounds ?? '') : ''}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    update(t.id, {
                      action: {
                        kind: 'applyCondition',
                        conditionId:
                          t.action.kind === 'applyCondition'
                            ? t.action.conditionId
                            : CONDITIONS[0].id,
                        rounds: !isNaN(n) && n > 0 ? n : null,
                        saveEnds:
                          t.action.kind === 'applyCondition' ? t.action.saveEnds : false,
                      },
                    })
                  }}
                  className="input w-24"
                />
              </label>
              {t.action.kind === 'applyCondition' && (
                <label className="flex items-center gap-1.5 text-xs text-slate-400 pb-2">
                  <input
                    type="checkbox"
                    checked={t.action.saveEnds}
                    onChange={(e) => {
                      if (t.action.kind !== 'applyCondition') return
                      update(t.id, {
                        action: {
                          kind: 'applyCondition',
                          conditionId: t.action.conditionId,
                          rounds: t.action.rounds,
                          saveEnds: e.target.checked,
                        },
                      })
                    }}
                  />
                  Save ends
                </label>
              )}
            </div>
          </>
        ) : (
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Amount
            </span>
            <input
              type="number"
              min={1}
              max={999}
              value={t.action.amount}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                const amount = !isNaN(n) && n > 0 ? n : 1
                update(t.id, {
                  action:
                    t.action.kind === 'damage'
                      ? { kind: 'damage', amount }
                      : { kind: 'heal', amount },
                })
              }}
              className="input w-24"
            />
          </label>
        )}
      </div>

      {!isRoundLevel(t) && t.event.kind !== 'combatantAdded' && (
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            Fire at most
          </span>
          <select
            value={t.dedupe}
            onChange={(e) => update(t.id, { dedupe: e.target.value as TriggerDedupe })}
            className="input"
            title="How often this trigger may fire for the same combatant"
          >
            {DEDUPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-slate-500">per combatant</span>
        </label>
      )}
    </div>
  )
}