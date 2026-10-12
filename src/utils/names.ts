// Name-collision helpers for combatants. Pure string logic, unit-testable
// without loading the store.

// Next available name when duplicating: bump a trailing number to the lowest
// unused value ("Goblin 4" -> "Goblin 5"), otherwise append " 2", " 3"…
export function nextName(name: string, takenNames: Iterable<string>): string {
  const taken = new Set(takenNames)
  const m = name.match(/^(.*?)(\d+)\s*$/)
  if (m) {
    const base = m[1]
    let n = parseInt(m[2], 10) + 1
    while (taken.has(`${base}${n}`)) n++
    return `${base}${n}`
  }
  let n = 2
  while (taken.has(`${name} ${n}`)) n++
  return `${name} ${n}`
}

// Numbered names for a bulk add: "Goblin" x3 becomes "Goblin 4", "Goblin 5",
// "Goblin 6" when "Goblin 1"-"Goblin 3" already exist. The block is contiguous
// and starts at the lowest number where none of its names are taken, so
// loading "Goblin x4" twice gives 1-4 then 5-8 rather than duplicate names.
export function numberedCopies(
  base: string,
  takenNames: Iterable<string>,
  count: number
): string[] {
  const taken = new Set(takenNames)
  const m = base.match(/^(.*?)(\d+)\s*$/)
  const stem = m ? m[1] : `${base.trim()} `
  let start = m ? parseInt(m[2], 10) + 1 : 1
  const collides = (k: number) => {
    for (let i = 0; i < count; i++) {
      if (taken.has(`${stem}${k + i}`)) return true
    }
    return false
  }
  while (collides(start)) start++
  return Array.from({ length: count }, (_, i) => `${stem}${start + i}`)
}