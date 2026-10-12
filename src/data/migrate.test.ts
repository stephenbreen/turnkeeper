import { describe, expect, it } from 'vitest'
import { migratePersisted } from './migrate'

describe('migratePersisted', () => {
  it('upgrades v0 thresholds into perTurn triggers pointing at the injury tables', () => {
    const out = migratePersisted({
      thresholds: [25, 50],
      tables: [
        { id: 'inj25', name: 'Injury Table', dice: 'd20', entries: [], builtIn: 'injury25' },
        { id: 'inj50', name: 'Grievous Table', dice: 'd20', entries: [], builtIn: 'injury50' },
      ],
      combatants: [],
    })
    expect((out as Record<string, unknown>).thresholds).toBeUndefined()
    // builtIn markers were dropped; tables are plain now.
    expect(out.tables.every((t) => !('builtIn' in t))).toBe(true)
    expect(out.triggers).toHaveLength(2)
    const [t25, t50] = out.triggers
    expect(t25.name).toBe('Injury (25%)')
    expect(t25.dedupe).toBe('perTurn')
    expect(t25.event).toEqual({ kind: 'massiveDamage', percentOfMax: 25 })
    expect(t25.action).toEqual({ kind: 'rollTable', tableId: 'inj25', rolls: 1 })
    expect(t50.event).toEqual({ kind: 'massiveDamage', percentOfMax: 50 })
    expect(t50.action).toEqual({ kind: 'rollTable', tableId: 'inj50', rolls: 1 })
  })

  it('maps v1 oncePerTurn to a dedupe cadence', () => {
    const trigger = (id: string, patch: Record<string, unknown>) => ({
      id,
      name: id,
      enabled: true,
      scope: 'any',
      event: { kind: 'hpReachedZero' },
      action: { kind: 'notify', text: 'down' },
      ...patch,
    })
    const out = migratePersisted({
      triggers: [
        trigger('x', { oncePerTurn: false }),
        trigger('y', { oncePerTurn: true }),
        trigger('z', {}), // predates the flag entirely
      ],
      combatants: [],
    })
    expect(out.triggers.map((t) => t.dedupe)).toEqual(['always', 'perTurn', 'perTurn'])
    expect(out.triggers.every((t) => !('oncePerTurn' in t))).toBe(true)
  })

  it('backfills v4 combatant fields and upgrades string conditions', () => {
    const out = migratePersisted({
      triggers: [],
      combatants: [{ id: 'c1', name: 'A', conditions: ['blinded'], firedThresholds: ['t'] }],
    })
    const c = out.combatants[0]
    expect(c.tempHP).toBe(0)
    expect(c.deathSaves).toEqual({ successes: 0, failures: 0 })
    expect(c.concentration).toBeNull()
    expect(c.conditions).toEqual([{ id: 'blinded', rounds: null, saveEnds: false }])
    expect(c.firedTriggers).toEqual([])
    expect(c.firedTriggersRound).toEqual([])
  })

  it('maps a positional currentTurnIndex to the combatant id (v5)', () => {
    const out = migratePersisted({
      currentTurnIndex: 1,
      combatants: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    })
    expect(out.currentCombatantId).toBe('b')
    expect((out as Record<string, unknown>).currentTurnIndex).toBeUndefined()
  })

  it('clamps an out-of-range positional index', () => {
    const out = migratePersisted({ currentTurnIndex: 99, combatants: [{ id: 'a' }] })
    expect(out.currentCombatantId).toBe('a')
  })

  it('yields a null marker when there are no combatants', () => {
    const out = migratePersisted({ currentTurnIndex: 3 })
    expect(out.currentCombatantId).toBeNull()
  })

  it('is idempotent', () => {
    const input = {
      currentTurnIndex: 1,
      combatants: [{ id: 'a' }, { id: 'b' }],
      thresholds: [50],
      tables: [{ id: 't', name: 'T', dice: 'd20', entries: [] }],
    }
    const once = migratePersisted(input)
    const twice = migratePersisted(once)
    expect(twice).toEqual(once)
  })

  it('seeds the prep library for saves that predate it', () => {
    const out = migratePersisted({ combatants: [] })
    expect(out.scenes.length).toBeGreaterThan(0)
    expect(out.statblocks.length).toBeGreaterThan(0)
  })
})