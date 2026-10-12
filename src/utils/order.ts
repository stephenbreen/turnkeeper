// Builds the displayed initiative order, inserting a lair-action slot at the
// configured initiative count (5e convention: the lair acts at count 20,
// losing ties — i.e. before the first combatant at or below that count).
// If every combatant sits above the count, the slot lands at the end of the
// order (the count falls after the whole round).

export type OrderRow<T> = { kind: 'combatant'; value: T } | { kind: 'lair' }

export function withLairSlots<T extends { initiative: number }>(
  combatants: T[],
  lairInitiative: number | null
): OrderRow<T>[] {
  if (lairInitiative == null) {
    return combatants.map((value) => ({ kind: 'combatant' as const, value }))
  }
  const out: OrderRow<T>[] = []
  let inserted = false
  for (const value of combatants) {
    if (!inserted && value.initiative <= lairInitiative) {
      out.push({ kind: 'lair' })
      inserted = true
    }
    out.push({ kind: 'combatant', value })
  }
  if (!inserted) out.push({ kind: 'lair' })
  return out
}