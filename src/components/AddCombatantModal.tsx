import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { statblockAC, statblockHP } from '../utils/statblock'
import { numberedCopies } from '../utils/names'

export default function AddCombatantModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const add = useStore((s) => s.addCombatant)
  const addMany = useStore((s) => s.addCombatants)
  const statblocks = useStore((s) => s.statblocks)
  const combatantNames = useStore((s) => s.combatants.map((c) => c.name))
  const [name, setName] = useState('')
  const [type, setType] = useState<'pc' | 'monster'>('monster')
  const [maxHP, setMaxHP] = useState<string>('10')
  const [AC, setAC] = useState<string>('10')
  const [pp, setPP] = useState<string>('10')
  const [init, setInit] = useState<string>('10')
  const [qty, setQty] = useState<string>('1')
  const [legendary, setLegendary] = useState<string>('0')
  const [statblockId, setStatblockId] = useState<string>('')

  useEffect(() => {
    if (open) {
      setName('')
      setMaxHP('10')
      setAC('10')
      setPP('10')
      setInit('10')
      setQty('1')
      setLegendary('0')
      setStatblockId('')
    }
  }, [open])

  if (!open) return null

  // Picking a statblock links it and prefills name/HP/AC from it.
  const chooseStatblock = (id: string) => {
    setStatblockId(id)
    const sb = statblocks.find((s) => s.id === id)
    if (!sb) return
    setType('monster')
    if (sb.name) setName(sb.name)
    const hp = statblockHP(sb)
    if (hp != null) setMaxHP(String(hp))
    const ac = statblockAC(sb)
    if (ac != null) setAC(String(ac))
  }

  const submit = (addAnother: boolean) => {
    if (!name.trim()) return
    const mh = Math.max(1, parseInt(maxHP, 10) || 1)
    const n = Math.max(1, Math.min(50, parseInt(qty, 10) || 1))
    const base = {
      type,
      maxHP: mh,
      currentHP: mh,
      AC: parseInt(AC, 10) || 10,
      passivePerception: parseInt(pp, 10) || 10,
      initiative: parseInt(init, 10) || 10,
      legendaryActions:
        type === 'monster' ? Math.max(0, Math.min(3, parseInt(legendary, 10) || 0)) : 0,
      nameVisibleToPlayers: type === 'pc',
      statblockId: statblockId || undefined,
    }
    if (n === 1) {
      // Single add keeps firing "combatant added" triggers, as before.
      add({ ...base, name: name.trim() })
    } else {
      // Bulk add numbers the copies from the lowest unused slot ("Goblin 4",
      // "Goblin 5", … when 1-3 already exist) and skips combatantAdded
      // triggers so they don't fire once per copy.
      const names = numberedCopies(name.trim(), combatantNames, n)
      addMany(names.map((nm) => ({ ...base, name: nm })))
    }
    if (addAnother) {
      setName('')
    } else {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(false)
        }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-[26rem] max-w-full space-y-3"
      >
        <h3 className="text-lg font-bold">Add Combatant</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType('pc')}
            className={`flex-1 py-2 rounded ${
              type === 'pc' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            PC
          </button>
          <button
            type="button"
            onClick={() => setType('monster')}
            className={`flex-1 py-2 rounded ${
              type === 'monster' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Monster / NPC
          </button>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Quantity</span>
          <input
            type="number"
            min={1}
            max={50}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="input w-20"
            title="Add several at once — numbered copies, skipping names already in use"
          />
          {parseInt(qty, 10) > 1 && (
            <span className="text-xs text-slate-500">
              adds numbered copies
            </span>
          )}
        </label>
        {statblocks.length > 0 && (
          <label className="block">
            <span className="text-xs text-slate-400">From statblock (optional)</span>
            <select
              value={statblockId}
              onChange={(e) => chooseStatblock(e.target.value)}
              className="input w-full"
            >
              <option value="">— none —</option>
              {statblocks.map((sb) => (
                <option key={sb.id} value={sb.id}>
                  {sb.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="text-xs text-slate-400">
            {type === 'pc' ? 'Character Name' : 'Name'}
          </span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full"
            placeholder={type === 'pc' ? 'e.g. Aria Nightbreeze' : 'e.g. Goblin'}
            // Keep password managers / browser autofill (1Password, LastPass,
            // Dashlane, Chrome) out of the character-name field.
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-slate-400">Initiative</span>
            <input
              type="number"
              value={init}
              onChange={(e) => setInit(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Max HP</span>
            <input
              type="number"
              value={maxHP}
              onChange={(e) => setMaxHP(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">AC</span>
            <input
              type="number"
              value={AC}
              onChange={(e) => setAC(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Passive Perception</span>
            <input
              type="number"
              value={pp}
              onChange={(e) => setPP(e.target.value)}
              className="input w-full"
            />
          </label>
          {type === 'monster' && (
            <label
              className="block"
              title="Legendary actions per round (0 = none). A reminder window appears after other turns while uses remain; uses return at the start of its own turn."
            >
              <span className="text-xs text-slate-400">Legendary / round</span>
              <input
                type="number"
                min={0}
                max={3}
                value={legendary}
                onChange={(e) => setLegendary(e.target.value)}
                className="input w-full"
              />
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn">
            Cancel
          </button>
          <button type="button" onClick={() => submit(true)} className="btn" disabled={!name.trim()}>
            Add &amp; another
          </button>
          <button type="submit" className="btn-primary" disabled={!name.trim()}>
            Add
          </button>
        </div>
      </form>
    </div>
  )
}
