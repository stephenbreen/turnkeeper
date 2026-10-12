import type { Combatant, PlayerClassId } from '../types'

// A "party" is a reusable roster of PCs, saved to / loaded from a JSON file so a
// DM doesn't re-enter the same characters every session. It carries only the
// durable "character sheet" fields — not per-encounter combat state (current HP,
// initiative, conditions, death saves…), which is reset on import.

export type PartyMember = {
  name: string
  playerClass?: PlayerClassId
  maxHP: number
  AC: number
  passivePerception: number
  notes?: string
  nameVisibleToPlayers?: boolean
}

export type PartyFile = {
  type: 'turnkeeper-party'
  version: 1
  party: PartyMember[]
}

// Old exports from before the rename said 'the-breaking-party'; parseParty
// ignores the tag entirely (it finds the `party` array by shape), so those
// files still import cleanly.
const PARTY_FILE_TYPE = 'turnkeeper-party'

// Pull the exportable sheet fields out of the live PCs.
export function toParty(combatants: Combatant[]): PartyMember[] {
  return combatants
    .filter((c) => c.type === 'pc')
    .map((c) => ({
      name: c.name,
      playerClass: c.playerClass,
      maxHP: c.maxHP,
      AC: c.AC,
      passivePerception: c.passivePerception,
      notes: c.notes || undefined,
      nameVisibleToPlayers: c.nameVisibleToPlayers,
    }))
}

export function serializeParty(members: PartyMember[]): string {
  const file: PartyFile = { type: PARTY_FILE_TYPE, version: 1, party: members }
  return JSON.stringify(file, null, 2)
}

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  return Number.isFinite(n) ? n : fallback
}
const str = (v: unknown, fallback: string): string =>
  typeof v === 'string' && v.trim() ? v : fallback

// Find the member rows in a parsed file. Tolerant of three shapes so imports
// "just work": our own party file, a bare array of members, or a full
// encounter / persisted-store blob (from which we lift the PCs).
function extractRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    if (Array.isArray(o.party)) return o.party as Record<string, unknown>[]
    if (Array.isArray(o.combatants)) return o.combatants as Record<string, unknown>[]
    // zustand persisted blob: { state: { combatants: [...] } }
    if (o.state && typeof o.state === 'object') return extractRows(o.state)
  }
  return []
}

// Parse a party file into combatant partials ready for `addCombatants`. Anything
// explicitly marked as a monster is dropped; everything else becomes a PC with
// full current HP.
export function parseParty(data: unknown): Partial<Combatant>[] {
  return extractRows(data)
    .filter((r) => r && typeof r === 'object' && r.type !== 'monster')
    .map((r) => {
      const maxHP = Math.max(1, num(r.maxHP, 10))
      return {
        type: 'pc' as const,
        name: str(r.name, 'Unnamed'),
        playerClass: r.playerClass as PlayerClassId | undefined,
        maxHP,
        currentHP: maxHP,
        AC: num(r.AC, 10),
        passivePerception: num(r.passivePerception, 10),
        notes: typeof r.notes === 'string' ? r.notes : '',
        nameVisibleToPlayers: r.nameVisibleToPlayers !== false,
      }
    })
}
