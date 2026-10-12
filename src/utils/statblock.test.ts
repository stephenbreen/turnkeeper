import { describe, expect, it } from 'vitest'
import {
  parseStatblocks,
  statblockAC,
  statblockHP,
  statblockInitMod,
} from './statblock'

const javalentYaml = `
name: Goblin
size: Small
type: humanoid
subtype: goblinoid
alignment: neutral evil
ac: 15 (leather armor, shield)
hp: 7 (2d6)
speed: 30 ft.
stats: [8, 14, 10, 10, 8, 8]
languages: Common, Goblin
cr: '1/4'
traits:
  - name: Nimble Escape
    desc: The goblin can take the Disengage or Hide action as a bonus action.
`

describe('parseStatblocks', () => {
  it('parses Fantasy Statblocks (Javalent) YAML', () => {
    const [sb] = parseStatblocks(javalentYaml)
    expect(sb.name).toBe('Goblin')
    expect(sb.size).toBe('Small')
    expect(sb.ac).toBe('15 (leather armor, shield)')
    expect(sb.hp).toBe('7 (2d6)')
    expect(sb.stats).toEqual([8, 14, 10, 10, 8, 8])
    expect(sb.traits).toEqual([
      {
        name: 'Nimble Escape',
        desc: 'The goblin can take the Disengage or Hide action as a bonus action.',
      },
    ])
  })

  it('parses 5etools JSON: object fields, entries, and {@tag} markup', () => {
    const [sb] = parseStatblocks(
      JSON.stringify({
        name: 'Test Monster',
        size: ['M'],
        type: { type: 'humanoid', tags: ['goblinoid'] },
        alignment: ['L', 'E'],
        ac: [{ ac: 15, from: ['shield'] }],
        hp: { average: 7, formula: '2d6' },
        speed: { walk: 30, fly: { number: 60, condition: '(hover)' } },
        passive: 9,
        trait: [
          {
            name: 'Keen Attack',
            entries: ['{@atkr mw} {@hit +4} to hit. {@dc 12} Constitution save.'],
          },
        ],
      })
    )
    expect(sb.size).toBe('Medium')
    expect(sb.type).toBe('humanoid')
    expect(sb.subtype).toBe('goblinoid')
    expect(sb.alignment).toBe('Lawful Evil')
    expect(sb.ac).toBe('15 (shield)')
    expect(sb.hp).toBe('7')
    expect(sb.hitDice).toBe('2d6')
    expect(sb.speed).toBe('30 ft., fly 60 ft. (hover)')
    expect(sb.senses).toContain('passive Perception 9')
    // Hit lines keep a single sign ({@hit +4} must not become "++4"), DCs
    // render inline, and atkr expands to an attack-roll label.
    const desc = sb.traits![0].desc
    expect(desc).toContain('Melee Attack Roll: +4 to hit.')
    expect(desc).toContain('DC 12 Constitution save.')
    expect(desc).not.toContain('++')
  })

  it('unwraps a 5etools bestiary file ({ "monster": [...] })', () => {
    const out = parseStatblocks(JSON.stringify({ monster: [{ name: 'A' }, { name: 'B' }] }))
    expect(out.map((s) => s.name)).toEqual(['A', 'B'])
  })

  it('parses several YAML documents in one paste', () => {
    const two = `${javalentYaml}\n---\nname: Hobgoblin\n`
    const out = parseStatblocks(two)
    expect(out.map((s) => s.name)).toEqual(['Goblin', 'Hobgoblin'])
  })

  it('strips Obsidian statblock fences', () => {
    const [sb] = parseStatblocks('```statblock\nname: Fenced\n```')
    expect(sb.name).toBe('Fenced')
  })

  it('returns [] for junk input', () => {
    expect(parseStatblocks('')).toEqual([])
  })

  it('derives the numeric prefill fields', () => {
    const [sb] = parseStatblocks(javalentYaml)
    expect(statblockAC(sb)).toBe(15)
    expect(statblockHP(sb)).toBe(7)
    expect(statblockInitMod(sb)).toBe(2) // DEX 14 → +2
  })
})