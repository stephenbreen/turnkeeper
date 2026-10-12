// @vitest-environment jsdom
// Needs jsdom for localStorage — the persist middleware writes through it.
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store'
import { buildDefaultEncounter } from './data/defaultState'

const S = () => useStore.getState()
const idOf = (name: string) => S().combatants.find((c) => c.name === name)!.id
const currentName = () =>
  S().combatants.find((c) => c.id === S().currentCombatantId)?.name ?? null

// Merge-reset the encounter fields (actions stay on the store instance), with
// a clean trigger slate — the seeded defaults would fire alongside anything
// the test adds.
beforeEach(() => {
  useStore.setState({ ...buildDefaultEncounter(), triggers: [] })
})

const add = (name: string, initiative: number, patch: Record<string, unknown> = {}) =>
  S().addCombatant({ name, initiative, maxHP: 20, ...patch })

describe('turn tracking (currentCombatantId)', () => {
  it('makes the first added combatant current', () => {
    add('A', 10)
    expect(currentName()).toBe('A')
  })

  it('keeps the marker when a higher-initiative reinforcement arrives', () => {
    add('A', 10)
    add('B', 5)
    S().nextTurn() // now B's turn
    add('C', 20) // sorts to the front — must not steal the marker
    expect(currentName()).toBe('B')
  })

  it('keeps the marker on the same combatant when its initiative is edited', () => {
    add('A', 10)
    add('B', 5)
    S().nextTurn() // B
    S().updateCombatant(idOf('B'), { initiative: 99 })
    expect(S().combatants[0].name).toBe('B') // the list did re-sort…
    expect(currentName()).toBe('B') // …but the marker stayed on B
  })

  it('advances by initiative order and bumps the round on wrap', () => {
    add('A', 20)
    add('B', 10)
    S().nextTurn()
    expect(currentName()).toBe('B')
    expect(S().round).toBe(1)
    S().nextTurn()
    expect(currentName()).toBe('A')
    expect(S().round).toBe(2)
  })

  it('keeps the marker when an earlier combatant is removed', () => {
    add('A', 30)
    add('B', 20)
    add('C', 10)
    S().nextTurn() // B (index 1) — removing A used to slide B's marker onto C
    S().removeCombatant(idOf('A'))
    expect(currentName()).toBe('B')
  })

  it('hands the turn to the next in order when the active combatant is removed', () => {
    add('A', 30)
    add('B', 20)
    add('C', 10) // current: A
    S().removeCombatant(idOf('A'))
    expect(currentName()).toBe('B')
  })

  it('clamps to the last combatant when the final one is removed while active', () => {
    add('A', 30)
    add('B', 20)
    add('C', 10)
    S().nextTurn()
    S().nextTurn() // C
    S().removeCombatant(idOf('C'))
    expect(currentName()).toBe('B')
  })

  it('nulls the marker when the last combatant is removed', () => {
    add('A', 5)
    S().removeCombatant(idOf('A'))
    expect(S().currentCombatantId).toBeNull()
  })

  it('ticks timed conditions only for the combatant whose turn starts', () => {
    add('A', 20)
    add('B', 10)
    S().toggleCondition(idOf('B'), 'blinded') // add it…
    S().setCondition(idOf('B'), 'blinded', { rounds: 2 }) // …then give it a timer
    S().nextTurn() // B starts — 2 → 1
    expect(S().combatants.find((c) => c.name === 'B')!.conditions[0].rounds).toBe(1)
    S().nextTurn() // A starts — B untouched
    expect(S().combatants.find((c) => c.name === 'B')!.conditions[0].rounds).toBe(1)
    S().nextTurn() // B again — 1 → 0, expired and dropped
    expect(S().combatants.find((c) => c.name === 'B')!.conditions).toEqual([])
  })

  it('auto-advances via the timer on the same path as nextTurn', () => {
    add('A', 20)
    add('B', 10)
    useStore.setState({ timerRemaining: 1, timerRunning: true })
    S().tickTimer()
    expect(currentName()).toBe('B')
    expect(S().timerRunning).toBe(false)
    expect(S().timerRemaining).toBe(S().timerSeconds)
  })
})

describe('trigger dedupe cadences', () => {
  it('resets perTurn fired triggers on every turn change', () => {
    add('A', 10)
    S().addTrigger({
      name: 'Injury',
      enabled: true,
      scope: 'any',
      dedupe: 'perTurn',
      event: { kind: 'massiveDamage', percentOfMax: 25 },
      action: { kind: 'notify', text: 'ow' },
    })
    S().applyDamage(idOf('A'), 5) // 25% of 20 — fires
    expect(S().triggerResults).toHaveLength(1)
    S().applyDamage(idOf('A'), 5) // same turn — deduped
    expect(S().triggerResults).toHaveLength(1)
    S().nextTurn() // solo encounter: wraps to A, clears perTurn markers
    S().applyDamage(idOf('A'), 5) // fires again
    expect(S().triggerResults).toHaveLength(2)
  })

  it('resets perRound fired triggers only when the round changes', () => {
    add('A', 30)
    add('B', 20)
    S().addTrigger({
      name: 'Once per round',
      enabled: true,
      scope: 'any',
      dedupe: 'perRound',
      event: { kind: 'massiveDamage', percentOfMax: 10 },
      action: { kind: 'notify', text: 'ow' },
    })
    S().applyDamage(idOf('B'), 3) // 15% — fires
    expect(S().triggerResults).toHaveLength(1)
    S().nextTurn() // A → B, still round 1 — deduped
    S().applyDamage(idOf('B'), 3)
    expect(S().triggerResults).toHaveLength(1)
    S().nextTurn() // wraps → round 2, markers cleared
    S().applyDamage(idOf('B'), 3)
    expect(S().triggerResults).toHaveLength(2)
  })
})