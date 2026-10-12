import { useEffect } from 'react'

export default function HelpModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-[48rem] max-w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 px-6 py-4 border-b border-slate-800">
          <h2 className="text-xl font-bold">How to use Turnkeeper</h2>
          <div className="flex-1" />
          <button onClick={onClose} className="btn" aria-label="Close help">
            ✕
          </button>
        </header>

        <div className="overflow-y-auto px-6 py-5 space-y-5 text-sm text-slate-300 leading-relaxed">
          <section>
            <h3 className="text-base font-semibold text-white mb-1">What this is</h3>
            <p>
              A two-window initiative tracker for tabletop RPG sessions. The
              window you're in is the <b>DM panel</b> — you add combatants,
              drive turns, apply damage, and consult tables. The{' '}
              <b>player view</b> is a read-only popout you drag onto a second
              monitor or TV so the players can see initiative order, active
              turn, and the turn timer.
            </p>
            <p className="mt-2">
              The two windows stay in sync through your browser only — no
              server, no accounts. Everything auto-saves to this browser's
              local storage.
            </p>
            <p className="mt-2">
              Prefer a darker table? The <b>🌙 Dark</b> / <b>☀️ Light</b> button
              in the header switches between the parchment light theme and a warm
              dark theme. Your choice is remembered, and the player window follows
              along.
            </p>
            <p className="mt-2">
              On desktop, the <b>Hide panel</b> / <b>Show panel</b> button in the
              header collapses the right-hand panel (dice / tables / settings) so
              the initiative list gets the full width. Click it again to bring the
              panel back.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-white mb-1">
              Opening the player view
            </h3>
            <p>
              Click <b>Player View ↗</b> in the header. If a popup is blocked,
              allow popups for this site. Drag the popup to your second
              monitor and leave it there for the session.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-white mb-1">
              Adding combatants
            </h3>
            <p>
              <b>+ Add Combatant</b> opens a dialog. Pick PC or Monster/NPC,
              enter name + initiative + max HP + AC + passive perception.
              The list auto-sorts by initiative. <b>Add &amp; another</b>{' '}
              keeps the dialog open for rapid entry of a monster pack.
            </p>
            <p className="mt-2">
              If you've imported statblocks, the dialog's <b>From statblock</b>{' '}
              picker prefills name, HP, and AC (and links the statblock) in one
              step.
            </p>
            <p className="mt-2">
              Combatants default to <em>name visible to players</em> for PCs
              and <em>hidden</em> for monsters. Players see <code>???</code>{' '}
              until you flip the toggle in the expanded card — useful when you
              want to reveal a boss at the right dramatic moment.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-white mb-1">
              Library — scenes, encounters & statblocks
            </h3>
            <p>
              <b>📚 Library</b> in the header (or <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">L</kbd>)
              opens your prep library. A <b>Scene</b> (e.g. "Wishing Well") holds
              several <b>Encounters</b> ("Goblin Ambush", "Griffin Attack"). It
              ships with an example scene so you can see the shape.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                Each roster line has a <b>quantity</b> (Goblin ×4) that expands
                into separate combatants on load.
              </li>
              <li>
                <b>Initiative</b> per line: <em>roll each</em>, <em>roll as
                group</em> (one shared roll), <em>static</em>, or <em>manual</em>
                (seeded, you set it live). Rolls use 1d20 + the line's modifier.
              </li>
              <li>
                <b>Load ▶</b> replaces the current fight with that encounter
                (rolling initiative as configured). <b>Save current fight here</b>
                captures the live board back into the scene.
              </li>
              <li>
                <b>Export / Import</b> a scene as JSON (bundling its statblocks)
                to share setups or prep offline.
              </li>
            </ul>
            <p className="mt-2">
              The <b>Statblocks</b> tab imports{' '}
              <a
                href="https://plugins.javalent.com/statblocks/readme/code-block"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:text-indigo-300"
              >
                Fantasy Statblocks
              </a>{' '}
              YAML, <em>or</em> <b>5etools / 5e.tools bestiary JSON</b> (paste or
              upload) — a single monster, a JSON array, or a whole{' '}
              <code>{'{ "monster": [ … ] }'}</code> file. Link a statblock to a
              roster line or a combatant; then <b>hover</b> the{' '}
              <b>📜 statblock</b> chip for a quick line, or <b>click</b> it (or
              expand the card) for the full block. Statblocks are DM-only — they
              never appear on the player view.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-white mb-1">
              Running turns
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <b>Next ▶</b> advances; <b>◀ Prev</b> goes back. The round
                counter increments when wrapping around.
              </li>
              <li>
                The turn timer is configurable — default 60 seconds. Click{' '}
                <b>▶</b> to start, <b>⏸</b> to pause, <b>↺</b> to reset to
                full.
              </li>
              <li>
                At 10 s remaining the timer flashes red. At 0 s it
                auto-advances to the next combatant and pauses there,
                waiting for you to start the next turn.
              </li>
              <li>
                The player view shows a huge countdown number and an
                animated hourglass so the whole table can see the time.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-white mb-1">
              Damage and healing
            </h3>
            <p>
              Every combatant row has a quick <b>HP</b> field — type a number and
              press{' '}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">
                Enter
              </kbd>{' '}
              to deal damage, or{' '}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">
                Shift+Enter
              </kbd>{' '}
              to heal. Click the row to expand for separate <b>Damage</b> /{' '}
              <b>Heal</b> buttons and full editing of HP, AC, PP, initiative,
              conditions, statblock, notes, and name.
            </p>
            <p className="mt-2">
              The player view never shows numeric HP. Instead it shows a word
              status —{' '}
              <span className="text-emerald-300">Healthy</span>,{' '}
              <span className="text-lime-300">Hurt</span>,{' '}
              <span className="text-amber-300">Bloodied</span>,{' '}
              <span className="text-orange-300">Dire</span>,{' '}
              <span className="text-red-300">Dying</span>, or{' '}
              <span className="text-slate-400">Dead</span> if you've
              flagged them.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-white mb-1">
              Triggers — injuries and beyond
            </h3>
            <p>
              A <b>trigger</b> is a rule: "when something happens → roll a
              table." You manage them in the <b>Settings</b> tab.
            </p>
            <p className="mt-2">
              The built-in injury rule is <b>two triggers on one table</b>: a
              single hit dealing ≥ 25 % of max HP rolls the injury table{' '}
              <em>once</em>; ≥ 50 % rolls the <em>same</em> table <em>twice</em>.
              When several massive-damage triggers match one hit, only the
              highest fires. Each trigger has a <b>Fire at most</b> cadence —{' '}
              <em>every time</em>, <em>once per turn</em>, or <em>once per
              round</em> per combatant (for an effect that should only happen
              once this round). Turn/round counters reset automatically; manual
              reset lives in <b>Settings</b> and the <b>Encounter ▾</b> menu.
            </p>
            <p className="mt-2">
              Other events you can trigger on: a combatant dropping to{' '}
              <b>0 HP</b>, or a new <b>combatant being added</b> (e.g. roll on a
              reinforcements / random-encounter table). When a trigger fires a
              toast prompts you — players can roll the die physically, or click{' '}
              <b>Roll</b> to do it in-app. Injury reveals also flash on the
              player view; combatant-added notes stay on the DM panel.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-white mb-1">
              Conditions
            </h3>
            <p>
              Expand a combatant's card and click <b>+ Add</b> under Conditions
              to open a picker listing every 5e condition with its icon and name
              (including Exhaustion 1–6). Tap to add or remove — pick as many as
              you need, then Done. Chosen conditions appear under the label as
              chips with an <b>×</b> to clear them, and also show (with icons) on
              the combatant's row and the player view.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-white mb-1">
              Strategy labels
            </h3>
            <p>
              Stackable tactical tags you define in <b>Settings</b> (default:{' '}
              <b>Surrounded</b>). Use the <b>+</b> / <b>−</b> buttons on each
              combatant to stack them — e.g. Surrounded 1/2/3. Purely
              informational, visible to players.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-white mb-1">
              Tables
            </h3>
            <p>
              The <b>tables</b> tab seeds an <b>Injury Table</b> you can edit.
              Add your own (treasure, complications, reinforcements…), edit
              ranges and results in place, reorder entries with ▲/▼, roll
              directly, <b>Duplicate</b> a table to spin a variant, and{' '}
              <b>Delete</b> any table. Import / export individual tables as
              JSON. Point any trigger at any table from <b>Settings</b>.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-white mb-1">Dice</h3>
            <p>
              The <b>dice</b> tab has preset buttons (d4 – d100) and a
              freeform expression field that accepts things like{' '}
              <code>2d6+3</code>, <code>3d4+2d6+1</code>, or <code>d20-1</code>.
              History shows the last 30 rolls.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-white mb-1">
              Keyboard shortcuts
            </h3>
            <p className="mb-2">
              Active in the DM panel. They pause while you're typing into a
              field or while a dialog is open.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">Space</kbd>{' '}
                /{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">→</kbd>{' '}
                /{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">N</kbd>{' '}
                — next turn
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">←</kbd>{' '}
                /{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">P</kbd>{' '}
                — previous turn
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">A</kbd>{' '}
                — add combatant
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">L</kbd>{' '}
                — open the library
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">T</kbd>{' '}
                — start / pause turn timer
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">R</kbd>{' '}
                — reset turn timer
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">H</kbd>{' '}
                — jump to the active combatant's HP field. Then{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">↑</kbd>/
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">↓</kbd>{' '}
                step the value,{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">Enter</kbd>{' '}
                applies damage,{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">Shift+Enter</kbd>{' '}
                heals, and{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">Esc</kbd>{' '}
                clears and unfocuses.
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">?</kbd>{' '}
                — open this help. <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">Esc</kbd> closes it.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-white mb-1">
              Save, import, reset
            </h3>
            <p>
              State auto-saves to this browser's local storage — close the
              tab and come back later, nothing is lost. Under{' '}
              <b>Encounter ▾</b>:
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>
                <b>New encounter</b> — clears combatants, keeps your tables,
                settings, and strategy labels.
              </li>
              <li>
                <b>Reset injury triggers</b> — manual clear (they reset on
                turn advance anyway).
              </li>
              <li>
                <b>Export / Import encounter JSON</b> — prep fights ahead of
                time and load them at the table.
              </li>
            </ul>
          </section>
        </div>

        <footer className="px-6 py-3 border-t border-slate-800 text-xs text-slate-500 flex items-center gap-3">
          <span>
            Press{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> to
            close.
          </span>
          <div className="flex-1" />
          <a
            href="https://github.com/stephenbreen/turnkeeper"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 hover:text-indigo-300"
          >
            Source on GitHub
          </a>
        </footer>
      </div>
    </div>
  )
}
