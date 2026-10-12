import yaml from 'js-yaml'
import { newId } from './id'
import type { Statblock, StatblockSection } from '../types'

// Parses statblocks from YAML or JSON into our normalised shape. Two schemas are
// auto-detected and supported, field by field:
//   - Fantasy Statblocks (Javalent): flat strings, `traits`/`actions` with `desc`.
//   - 5etools / 5e.tools bestiary: arrays/objects for ac/hp/speed/size/alignment,
//     `trait`/`action` with `entries`, and {@tag ...} markup.
// Everything is best-effort and tolerant of missing fields.

const ABBR: Record<string, string> = {
  strength: 'Str', dexterity: 'Dex', constitution: 'Con',
  intelligence: 'Int', wisdom: 'Wis', charisma: 'Cha',
  str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha',
}

const SIZE: Record<string, string> = {
  T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan',
}
const ALIGN: Record<string, string> = {
  L: 'Lawful', N: 'Neutral', C: 'Chaotic', G: 'Good', E: 'Evil',
  U: 'Unaligned', A: 'Any',
}
const ABILITY_FULL: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}
const abilityName = (code: string) => ABILITY_FULL[code.toLowerCase().trim()] ?? code

// 5etools attack-roll kinds ({@atkr mw,s} etc.): m/melee-weapon, r/ranged-
// weapon, s/spell, plus the melee/ranged spell variants.
const ATK_TYPE: Record<string, string> = {
  m: 'Melee', mw: 'Melee',
  r: 'Ranged', rw: 'Ranged',
  s: 'Spell', ms: 'Melee Spell', rs: 'Ranged Spell',
}

function asString(v: unknown): string | undefined {
  if (v == null) return undefined
  if (typeof v === 'string') return v.trim() || undefined
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return undefined
}

// Convert 5etools {@tag ...} markup to plain text. Repeats to catch adjacent tags.
function strip5eTags(input: string): string {
  let s = input
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/\{@(\w+)([^{}]*)\}/g, (_m, tag: string, rest: string) => {
      const body = rest.trim()
      const parts = body.split('|')
      const first = parts[0] ?? ''
      const display = parts.length > 2 ? parts[parts.length - 1] : first
      switch (tag) {
        // 5etools hit lines already carry the sign ("{@hit +4}"), so only
        // prepend one when it's missing.
        case 'hit': return first.startsWith('+') || first.startsWith('-') ? first : `+${first}`
        case 'dc': return `DC ${first}`
        case 'h': return 'Hit: '
        case 'atk': return ''
        case 'atkr':
        case 'atkro': {
          const label = first
            .split(',')
            .map((k) => ATK_TYPE[k.trim()] ?? k.trim())
            .join(' or ')
          return `${label} Attack Roll: `
        }
        case 'actSave': return `${abilityName(first)} Saving Throw: `
        case 'actSaveFail': return 'Failure: '
        case 'actSaveSuccess': return 'Success: '
        case 'actSaveSuccessOrFail': return 'Failure or Success: '
        case 'actTrigger': return 'Trigger: '
        case 'actResponse': return 'Response: '
        case 'recharge': return first ? `(Recharge ${first}–6)` : '(Recharge 6)'
        case 'damage':
        case 'dice':
        case 'scaledamage':
        case 'scaledice':
          return first
        default:
          return display || first
      }
    })
    if (next === s) break
    s = next
  }
  return s.replace(/\s+([.,;:)])/g, '$1').replace(/\s{2,}/g, ' ').trim()
}

// Flatten 5etools `entries` (strings and nested list/entry objects) to text.
function entriesToText(entries: unknown): string {
  if (entries == null) return ''
  if (typeof entries === 'string') return strip5eTags(entries)
  if (Array.isArray(entries)) {
    return entries.map(entriesToText).filter(Boolean).join('\n')
  }
  if (typeof entries === 'object') {
    const o = entries as Record<string, unknown>
    if (o.entries != null) return entriesToText(o.entries)
    if (o.items != null) return entriesToText(o.items)
    if (typeof o.entry === 'string') return strip5eTags(o.entry)
    return ''
  }
  return ''
}

function toSections(v: unknown): StatblockSection[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: StatblockSection[] = []
  for (const item of v) {
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      const name = strip5eTags(asString(o.name) ?? '')
      const descStr = asString(o.desc) ?? asString(o.description)
      const desc = descStr != null ? strip5eTags(descStr) : entriesToText(o.entries ?? o.entry)
      if (name || desc) out.push({ name, desc })
    } else if (typeof item === 'string') {
      out.push({ name: '', desc: strip5eTags(item) })
    }
  }
  return out.length ? out : undefined
}

// saves/skills: [{dexterity: 9}] or {dex: "+2"}  →  "Dex +9, Con +14"
function toModList(v: unknown): string | undefined {
  const parts: string[] = []
  const push = (k: string, val: unknown) => {
    const label = ABBR[k.toLowerCase()] ?? k.charAt(0).toUpperCase() + k.slice(1)
    const n = typeof val === 'number' ? val : parseInt(String(val), 10)
    if (!isNaN(n)) parts.push(`${label} ${n >= 0 ? '+' : ''}${n}`)
    else if (val != null) parts.push(`${label} ${val}`)
  }
  if (Array.isArray(v)) {
    for (const item of v) {
      if (item && typeof item === 'object') {
        for (const [k, val] of Object.entries(item)) push(k, val)
      }
    }
  } else if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) push(k, val)
  } else {
    return asString(v)
  }
  return parts.length ? parts.join(', ') : undefined
}

function toStats(o: Record<string, unknown>): number[] | undefined {
  const v = o.stats
  if (Array.isArray(v) && v.length >= 6) return v.slice(0, 6).map((x) => Number(x) || 10)
  const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  if (keys.every((k) => o[k] != null)) return keys.map((k) => Number(o[k]) || 10)
  return undefined
}

// ----- 5etools field coercions (all accept the flat string form too) -----

function coerceSize(v: unknown): string | undefined {
  if (Array.isArray(v)) {
    return v.map((x) => SIZE[String(x)] ?? String(x)).join(' or ') || undefined
  }
  if (typeof v === 'string') return SIZE[v] ?? v
  return asString(v)
}

function coerceAlignment(v: unknown): string | undefined {
  if (Array.isArray(v)) {
    const words = v
      .map((x) => (typeof x === 'string' ? ALIGN[x] ?? x : null))
      .filter(Boolean)
    return words.length ? words.join(' ') : undefined
  }
  return asString(v)
}

function coerceType(v: unknown): { type?: string; subtype?: string } {
  if (typeof v === 'string') return { type: v }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    const tags = Array.isArray(o.tags)
      ? o.tags
          .map((t) => (typeof t === 'string' ? t : asString((t as Record<string, unknown>)?.tag)))
          .filter(Boolean)
          .join(', ')
      : undefined
    return { type: asString(o.type), subtype: tags || undefined }
  }
  return {}
}

function coerceAC(v: unknown): string | undefined {
  if (Array.isArray(v)) {
    return (
      v
        .map((x) => {
          if (typeof x === 'number') return String(x)
          if (typeof x === 'string') return x
          if (x && typeof x === 'object') {
            const o = x as Record<string, unknown>
            const from = Array.isArray(o.from)
              ? ` (${o.from.map((f) => strip5eTags(String(f))).join(', ')})`
              : ''
            return `${o.ac ?? ''}${from}`
          }
          return ''
        })
        .filter(Boolean)
        .join(', ') || undefined
    )
  }
  return asString(v)
}

function coerceHP(v: unknown): { hp?: string; hitDice?: string } {
  if (typeof v === 'number' || typeof v === 'string') return { hp: String(v) }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (o.special != null) return { hp: asString(o.special) }
    return {
      hp: o.average != null ? String(o.average) : undefined,
      hitDice: asString(o.formula),
    }
  }
  return {}
}

function coerceSpeed(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return `${v} ft.`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    const fmt = (val: unknown): string | null => {
      if (typeof val === 'number') return `${val} ft.`
      if (val && typeof val === 'object') {
        const s = val as Record<string, unknown>
        const cond = asString(s.condition)
        return typeof s.number === 'number' ? `${s.number} ft.${cond ? ' ' + cond : ''}` : null
      }
      return null
    }
    const parts: string[] = []
    const walk = fmt(o.walk)
    if (walk) parts.push(walk)
    for (const mode of ['burrow', 'climb', 'fly', 'swim']) {
      const f = fmt(o[mode])
      if (f) parts.push(`${mode} ${f}`)
    }
    return parts.length ? parts.join(', ') : undefined
  }
  return undefined
}

function coerceList(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) {
    const items = v
      .map((x) => {
        if (typeof x === 'string') return strip5eTags(x)
        if (x && typeof x === 'object') {
          const o = x as Record<string, unknown>
          for (const k of ['resist', 'immune', 'vulnerable', 'special']) {
            if (Array.isArray(o[k])) return (o[k] as unknown[]).map((s) => strip5eTags(String(s))).join(', ')
            if (typeof o[k] === 'string') return strip5eTags(String(o[k]))
          }
          return ''
        }
        return String(x)
      })
      .filter(Boolean)
    return items.length ? items.join(', ') : undefined
  }
  return asString(v)
}

function coerceCR(v: unknown): string | undefined {
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (v && typeof v === 'object') return asString((v as Record<string, unknown>).cr)
  return undefined
}

// 5etools spellcasting → sections, routed to traits or actions by `displayAs`.
function spellcastingSections(v: unknown): { traits: StatblockSection[]; actions: StatblockSection[] } {
  const traits: StatblockSection[] = []
  const actions: StatblockSection[] = []
  if (!Array.isArray(v)) return { traits, actions }
  const spellName = (s: unknown) => strip5eTags(String(s))
  for (const block of v) {
    if (!block || typeof block !== 'object') continue
    const b = block as Record<string, unknown>
    const hidden = Array.isArray(b.hidden) ? (b.hidden as string[]) : []
    const lines: string[] = []
    const header = entriesToText(b.headerEntries)
    if (header) lines.push(header)
    if (!hidden.includes('will') && Array.isArray(b.will)) {
      lines.push(`At will: ${(b.will as unknown[]).map(spellName).join(', ')}`)
    }
    if (!hidden.includes('daily') && b.daily && typeof b.daily === 'object') {
      for (const [k, val] of Object.entries(b.daily as Record<string, unknown>)) {
        if (Array.isArray(val)) {
          const per = k.replace('e', '')
          lines.push(`${per}/day${k.endsWith('e') ? ' each' : ''}: ${val.map(spellName).join(', ')}`)
        }
      }
    }
    const footer = entriesToText(b.footerEntries)
    if (footer) lines.push(footer)
    const section: StatblockSection = { name: asString(b.name) ?? 'Spellcasting', desc: lines.join('\n') }
    if (b.displayAs === 'action') actions.push(section)
    else traits.push(section)
  }
  return { traits, actions }
}

export function normalizeStatblock(input: unknown): Statblock {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const t = coerceType(o.type)
  const { hp, hitDice } = coerceHP(o.hp)
  const spells = spellcastingSections(o.spellcasting)

  const sensesList = coerceList(o.senses)
  const passive = o.passive != null ? `passive Perception ${o.passive}` : undefined
  const senses = [sensesList, passive].filter(Boolean).join(', ') || undefined

  const merge = (a?: StatblockSection[], b?: StatblockSection[]) => {
    const combined = [...(a ?? []), ...(b ?? [])]
    return combined.length ? combined : undefined
  }

  return {
    id: newId(),
    name: asString(o.name) ?? 'Unnamed Creature',
    size: coerceSize(o.size),
    type: t.type,
    subtype: t.subtype ?? asString(o.subtype),
    alignment: coerceAlignment(o.alignment),
    ac: coerceAC(o.ac),
    hp: hp ?? asString(o.hp),
    hitDice: hitDice ?? asString(o.hit_dice ?? o.hitDice),
    speed: coerceSpeed(o.speed),
    stats: toStats(o),
    saves: toModList(o.saves ?? o.save),
    skillsaves: toModList(o.skillsaves ?? o.skill ?? o.skills),
    damageVulnerabilities: coerceList(o.damage_vulnerabilities ?? o.damageVulnerabilities ?? o.vulnerable),
    damageResistances: coerceList(o.damage_resistances ?? o.damageResistances ?? o.resist),
    damageImmunities: coerceList(o.damage_immunities ?? o.damageImmunities ?? o.immune),
    conditionImmunities: coerceList(o.condition_immunities ?? o.conditionImmunities ?? o.conditionImmune),
    senses,
    languages: coerceList(o.languages),
    cr: coerceCR(o.cr),
    traits: merge(toSections(o.traits ?? o.trait), spells.traits),
    actions: merge(toSections(o.actions ?? o.action), spells.actions),
    bonusActions: toSections(o.bonus_actions ?? o.bonusActions ?? o.bonus),
    reactions: toSections(o.reactions ?? o.reaction),
    legendaryActions: toSections(o.legendary_actions ?? o.legendaryActions ?? o.legendary),
    source: asString(o.source),
  }
}

// Strip an Obsidian ```statblock fence if the text was pasted from a note.
function stripFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:statblock[^\n]*)?\s*\n?/i, '')
    .replace(/\n?```$/, '')
    .trim()
}

// Unwrap 5etools bestiary files ({ "monster": [...] }) and flatten arrays.
function toMonsterArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data.flatMap(toMonsterArray)
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    if (Array.isArray(o.monster)) return o.monster
    if (Array.isArray(o.creature)) return o.creature
    return [data]
  }
  return data == null ? [] : [data]
}

// Parse one or many statblocks from JSON (object, array, or 5etools file) or YAML.
export function parseStatblocks(text: string): Statblock[] {
  const cleaned = stripFence(text)
  if (!cleaned) return []
  let data: unknown
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    data = JSON.parse(cleaned)
  } else {
    const docs: unknown[] = []
    yaml.loadAll(cleaned, (d) => docs.push(d))
    data = docs.length === 1 ? docs[0] : docs
  }
  return toMonsterArray(data)
    .filter((d) => d && typeof d === 'object')
    .map(normalizeStatblock)
}

// ----- numeric derivations for prefilling a combatant -----

export const abilityMod = (score: number): number => Math.floor((score - 10) / 2)

const firstInt = (v: string | undefined): number | undefined => {
  const m = String(v ?? '').match(/-?\d+/)
  return m ? parseInt(m[0], 10) : undefined
}

export const statblockAC = (sb: Statblock): number | undefined => firstInt(sb.ac)
export const statblockHP = (sb: Statblock): number | undefined => firstInt(sb.hp)
export const statblockInitMod = (sb: Statblock): number =>
  sb.stats?.[1] != null ? abilityMod(sb.stats[1]) : 0
