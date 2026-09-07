import React, { useEffect } from 'react'
import { SIM_DELTA_TIME_MS } from '../../domain/constants/simulation.js'
import { assembleNavigationGraph } from '../../domain/models/navigation.js'
import { useMovementStore } from '../../stores/movementStore.js'
import { simulationReadiness, useSimulationStore } from '../../stores/simulationStore.js'
import { useEditorStore } from '../../stores/editorStore.js'
import { useLayoutStore } from '../../stores/layoutStore.js'
import { useNavigationStore } from '../../stores/navigationStore.js'

// Simulation Control Panel (04 §10, §13; right panel in Simulation mode):
// status badge, patient count, Start/Stop/Reset/Pause-Resume. Drives the
// fixed 100ms tick while running; all movement logic lives in the domain.
const buttonClass = (disabled) =>
  `rounded px-2 py-1 text-xs ${
    disabled ? 'cursor-not-allowed text-neutral-600' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
  }`

const STATUS_LABEL = {
  running: 'Running',
  paused: 'Paused',
  stopped: 'Stopped',
  completed: 'Completed',
}

export default function SimulationPanel() {
  const session = useSimulationStore((state) => state.session)
  const agent = useSimulationStore((state) => state.agent)
  const recordCount = useMovementStore((state) => state.records.length)

  const status = session?.status ?? null
  const layout = useLayoutStore((state) => state.layout)
  const paths = useNavigationStore((state) => state.paths)
  const readiness = simulationReadiness(layout, assembleNavigationGraph(layout, paths))

  useEffect(() => {
    if (status !== 'running') {
      return undefined
    }
    const timer = setInterval(() => {
      useSimulationStore.getState().tick()
    }, SIM_DELTA_TIME_MS)
    return () => clearInterval(timer)
  }, [status])

  const handleStart = () => {
    const result = useSimulationStore.getState().start()
    if (!result.ok) {
      useEditorStore.getState().showToast('error', 'Cannot start simulation')
    }
  }

  const arrived = agent?.status === 'arrived' ? 1 : 0

  return (
    <aside aria-label="Simulation control" className="w-64 shrink-0 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-3">
      <h2 className="pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Simulation</h2>
      <div className="mb-3 flex items-center gap-2">
        <span
          data-testid="sim-status"
          className="inline-block rounded-full bg-neutral-800 px-3 py-0.5 text-[11px] text-neutral-200"
        >
          {status ? STATUS_LABEL[status] : 'Ready'}
        </span>
        {!readiness.ready && !status && <span className="text-[11px] text-amber-400">Blocked: no valid path</span>}
      </div>
      <p className="mb-3 text-xs text-neutral-400">{`${arrived}/1 arrived · ${recordCount} records`}</p>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={status === 'running' || status === 'paused' || !readiness.ready}
          title={!readiness.ready ? 'Needs a valid layout and navigation path' : 'Start simulation'}
          onClick={handleStart}
          className={
            status === 'running' || status === 'paused' || !readiness.ready
              ? 'cursor-not-allowed rounded bg-cyan-400/40 px-2 py-1 text-xs text-neutral-950/60'
              : 'rounded bg-cyan-400 px-2 py-1 text-xs font-medium text-neutral-950 hover:bg-cyan-300'
          }
        >
          Start
        </button>
        {status === 'paused' ? (
          <button type="button" onClick={() => useSimulationStore.getState().resume()} className={buttonClass(false)}>
            Resume
          </button>
        ) : (
          <button
            type="button"
            disabled={status !== 'running'}
            onClick={() => useSimulationStore.getState().pause()}
            className={buttonClass(status !== 'running')}
          >
            Pause
          </button>
        )}
        <button
          type="button"
          disabled={status !== 'running' && status !== 'paused'}
          onClick={() => useSimulationStore.getState().stop()}
          className={buttonClass(status !== 'running' && status !== 'paused')}
        >
          Stop
        </button>
        <button
          type="button"
          disabled={!session}
          onClick={() => useSimulationStore.getState().reset()}
          className={buttonClass(!session)}
        >
          Reset
        </button>
      </div>
    </aside>
  )
}
