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
      visibility: 'dm',
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
      visibility: 'dm',
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

describe('hpBelow triggers', () => {
  it('fires only the most severe threshold crossed by a hit', () => {
    add('A', 10, { maxHP: 100, currentHP: 100 })
    S().addTrigger({
      name: 'Bloodied',
      enabled: true,
      scope: 'any',
      dedupe: 'always',
      event: { kind: 'hpBelow', percentOfMax: 50 },
      action: { kind: 'notify', text: 'half' },
      visibility: 'dm',
    })
    S().addTrigger({
      name: 'Last legs',
      enabled: true,
      scope: 'any',
      dedupe: 'always',
      event: { kind: 'hpBelow', percentOfMax: 20 },
      action: { kind: 'notify', text: 'low' },
      visibility: 'dm',
    })
    S().applyDamage(idOf('A'), 85) // 100% → 15%: crosses both 50 and 20
    expect(S().triggerResults).toHaveLength(1)
    expect(S().triggerResults[0].triggerName).toBe('Last legs')
    expect(S().triggerResults[0].pct).toBe(15)
  })

  it('re-arms after healing back above the threshold', () => {
    add('A', 10, { maxHP: 100, currentHP: 100 })
    S().addTrigger({
      name: 'Bloodied',
      enabled: true,
      scope: 'any',
      dedupe: 'always',
      event: { kind: 'hpBelow', percentOfMax: 50 },
      action: { kind: 'notify', text: 'half' },
      visibility: 'dm',
    })
    S().applyDamage(idOf('A'), 60) // → 40%: crosses 50 — fires
    expect(S().triggerResults).toHaveLength(1)
    S().applyDamage(idOf('A'), 1) // → 39%: no new crossing
    expect(S().triggerResults).toHaveLength(1)
    S().applyHeal(idOf('A'), 30) // back to 70% — re-armed
    S().applyDamage(idOf('A'), 20) // → 50%: at the threshold counts as crossing
    expect(S().triggerResults).toHaveLength(2)
  })
})

describe('roundStart and turnStart triggers', () => {
  it('fires roundStart only when the round changes; round 0 means every round', () => {
    add('A', 20)
    add('B', 10)
    S().addTrigger({
      name: 'Round 2 only',
      enabled: true,
      scope: 'any',
      dedupe: 'always',
      event: { kind: 'roundStart', round: 2 },
      action: { kind: 'notify', text: 'phase two' },
      visibility: 'dm',
    })
    S().addTrigger({
      name: 'Every round',
      enabled: true,
      scope: 'any',
      dedupe: 'always',
      event: { kind: 'roundStart', round: 0 },
      action: { kind: 'notify', text: 'tick' },
      visibility: 'dm',
    })
    S().nextTurn() // A → B, still round 1
    expect(S().triggerResults).toHaveLength(0)
    S().nextTurn() // wrap → round 2: both fire
    expect(S().triggerResults.map((r) => r.triggerName).sort()).toEqual([
      'Every round',
      'Round 2 only',
    ])
    S().nextTurn() // round 3: only "Every round"
    S().nextTurn()
    expect(S().triggerResults).toHaveLength(3)
    expect(S().triggerResults[2].triggerName).toBe('Every round')
  })

  it('fires turnStart for the scoped combatant whose turn begins', () => {
    add('A', 20, { type: 'pc' })
    add('B', 10, { type: 'monster' })
    S().addTrigger({
      name: 'PC turn',
      enabled: true,
      scope: 'pc',
      dedupe: 'always',
      event: { kind: 'turnStart' },
      action: { kind: 'notify', text: 'go' },
      visibility: 'dm',
    })
    S().nextTurn() // B (monster) starts — out of scope
    expect(S().triggerResults).toHaveLength(0)
    S().nextTurn() // A (pc) starts — fires
    expect(S().triggerResults).toHaveLength(1)
  })
})

describe('conditionGained triggers and action side effects', () => {
  it('fires when a condition is applied, not when it is removed', () => {
    add('A', 10)
    S().addTrigger({
      name: 'Poisoned!',
      enabled: true,
      scope: 'any',
      dedupe: 'always',
      event: { kind: 'conditionGained', conditionId: 'poisoned' },
      action: { kind: 'notify', text: 'ick' },
      visibility: 'dm',
    })
    S().toggleCondition(idOf('A'), 'poisoned') // applied — fires
    expect(S().triggerResults).toHaveLength(1)
    S().toggleCondition(idOf('A'), 'poisoned') // removed — no fire
    expect(S().triggerResults).toHaveLength(1)
  })

  it('auto-applies conditions and HP changes without cascading', () => {
    add('A', 10, { maxHP: 100, currentHP: 100 })
    // Stunned for 1 round when HP drops below 50%.
    S().addTrigger({
      name: 'Stagger',
      enabled: true,
      scope: 'any',
      dedupe: 'always',
      event: { kind: 'hpBelow', percentOfMax: 50 },
      action: { kind: 'applyCondition', conditionId: 'stunned', rounds: 1, saveEnds: false },
      visibility: 'dm',
    })
    // A bleeding engine: automatic damage at the start of every round.
    S().addTrigger({
      name: 'Bleed',
      enabled: true,
      scope: 'any',
      dedupe: 'always',
      event: { kind: 'roundStart', round: 0 },
      action: { kind: 'damage', amount: 5 },
      visibility: 'dm',
    })
    S().applyDamage(idOf('A'), 60) // 100 → 40: Stagger fires and applies Stunned
    expect(S().combatants.find((c) => c.name === 'A')!.conditions).toEqual([
      { id: 'stunned', rounds: 1, saveEnds: false },
    ])
    S().nextTurn() // solo — wraps to round 2: Bleed fires, deals 5
    expect(S().combatants.find((c) => c.name === 'A')!.currentHP).toBe(35)
    // Trigger-caused damage must not re-fire Stagger or Bleed — exactly the
    // two results exist, in order.
    expect(S().triggerResults.map((r) => r.triggerName)).toEqual(['Stagger', 'Bleed'])
  })
})

describe('legendary actions', () => {
  it('spends uses, clamps at max, and resets at the start of its own turn', () => {
    add('Dragon', 20, { type: 'monster', legendaryActions: 3 })
    add('Hero', 10, { type: 'pc' })
    const d = idOf('Dragon')
    S().spendLegendaryAction(d)
    S().spendLegendaryAction(d)
    expect(S().combatants.find((c) => c.id === d)!.legendaryUsed).toBe(2)
    S().spendLegendaryAction(d)
    S().spendLegendaryAction(d) // a 4th — ignored
    expect(S().combatants.find((c) => c.id === d)!.legendaryUsed).toBe(3)
    S().nextTurn() // Dragon → Hero: not the Dragon's turn start, no reset
    expect(S().combatants.find((c) => c.id === d)!.legendaryUsed).toBe(3)
    S().nextTurn() // Hero → Dragon (wrap): pool resets
    expect(S().combatants.find((c) => c.id === d)!.legendaryUsed).toBe(0)
  })
})

describe('lair action reminder', () => {
  it('fires once per round when the order crosses the configured count', () => {
    add('A', 25)
    add('B', 15)
    S().setLairAction({ initiative: 20, name: 'Cave In' })
    S().nextTurn() // A → B: 25 → 15 crosses 20
    expect(S().triggerResults).toHaveLength(1)
    expect(S().triggerResults[0].eventKind).toBe('lair')
    expect(S().triggerResults[0].visibility).toBe('both')
    S().nextTurn() // B → A (wrap): count not crossed going down
    expect(S().triggerResults).toHaveLength(1)
    S().nextTurn() // A → B again in round 2: fires once more
    expect(S().triggerResults).toHaveLength(2)
  })
})

describe('session snapshots (campaign manager)', () => {
  it('saves the live board mid-fight and resumes it exactly', () => {
    add('A', 20, { maxHP: 50, currentHP: 50 })
    add('B', 10)
    S().applyDamage(idOf('A'), 30) // A at 20 HP
    S().nextTurn() // B's turn, round 1
    const session = S().campaigns[0].sessions[0]
    S().saveSessionSnapshot(session.id)

    S().resetEncounter() // wipe the board entirely
    expect(S().combatants).toHaveLength(0)

    S().loadSessionSnapshot(session.id)
    expect(S().combatants).toHaveLength(2)
    expect(S().combatants.find((c) => c.name === 'A')!.currentHP).toBe(20)
    expect(currentName()).toBe('B')
    expect(S().round).toBe(1)
    // The fight log survived the pause.
    expect(S().eventLog.some((e) => e.kind === 'damage' && e.value === 30)).toBe(true)
  })
})