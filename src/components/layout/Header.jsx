import React from 'react'

// App header (04 §5.1): app name + mode switcher. Only Edit mode exists in
// Phase 1; other modes are disabled placeholders (TBD, later phases).
// Save/Load belong to Phase 2 (layout persistence) and are NOT rendered here.
const MODES = ['Edit', 'Path', 'Simulation', 'Analysis']

export default function Header() {
  return (
    <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-2">
      <h1 className="text-sm font-semibold tracking-wide text-neutral-100">Clinic Layout Lab</h1>
      <nav aria-label="Editor mode" className="flex gap-1">
        {MODES.map((mode) =>
          mode === 'Edit' ? (
            <button
              key={mode}
              type="button"
              aria-pressed="true"
              className="rounded bg-cyan-400 px-3 py-1 text-xs font-medium text-neutral-950"
            >
              {mode}
            </button>
          ) : (
            <button
              key={mode}
              type="button"
              disabled
              title="Available in a later phase"
              className="cursor-not-allowed rounded px-3 py-1 text-xs text-neutral-500"
            >
              {mode}
            </button>
          ),
        )}
      </nav>
    </header>
  )
}
