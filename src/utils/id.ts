// Opaque ids for combatants / tables / entries / scenes. randomUUID exists in
// secure contexts (https Pages, localhost dev — all our targets); the fallback
// keeps things working for a file:// or LAN-http copy.
export const newId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)