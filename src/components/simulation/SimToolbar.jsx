import React from 'react'
import { useSimulationStore } from '../../stores/simulationStore.js'

// Slim Simulation-mode bar (04 §7.4, SCR-004): controls live in the
// Simulation Control Panel; this bar only states the mode contract.
export default function SimToolbar() {
  const status = useSimulationStore((state) => state.session?.status ?? null)
  return (
    <div role="toolbar" aria-label="Simulation tools" className="flex flex-wrap items-center gap-1 border-b border-neutral-800 bg-neutral-950 px-4 py-2">
      <span className="pr-2 text-xs text-neutral-400">
        {status === 'running'
          ? 'Simulation running — patient follows the navigation path'
          : 'Simulation mode — objects and paths are read-only'}
      </span>
    </div>
  )
}
