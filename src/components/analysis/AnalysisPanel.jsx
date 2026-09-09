import React, { useMemo } from 'react'
import { aggregateMovementDensity, buildHeatmapData, summarizeMovement } from '../../domain/models/analysis.js'
import { HEATMAP_CELL_SIZE } from '../../domain/constants/analysis.js'
import { HEATMAP_HIGH, HEATMAP_LOW, HEATMAP_MID } from '../canvas/canvasTheme.js'
import { useEditorStore } from '../../stores/editorStore.js'
import { useMovementStore } from '../../stores/movementStore.js'

// Analysis Panel (04 §7.5, §11–§13; right panel in Analysis mode):
// legend, overlay toggle, master opacity, movement summary. Derived data
// recomputes automatically from movementStore (FR-HM-006); nothing here
// mutates records, layout, navigation, or simulation state.
export default function AnalysisPanel() {
  const records = useMovementStore((state) => state.records)
  const heatmapVisible = useEditorStore((state) => state.heatmapVisible)
  const heatmapOpacity = useEditorStore((state) => state.heatmapOpacity)

  const density = useMemo(() => aggregateMovementDensity(records, HEATMAP_CELL_SIZE), [records])
  const heatmap = useMemo(() => buildHeatmapData(density, HEATMAP_CELL_SIZE), [density])
  const summary = useMemo(() => summarizeMovement(records), [records])

  if (records.length === 0) {
    return (
      <aside aria-label="Analysis panel" className="w-64 shrink-0 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-3">
        <h2 className="pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Analysis</h2>
        <p className="text-xs text-neutral-500">No movement data available. Run a simulation first.</p>
      </aside>
    )
  }

  return (
    <aside aria-label="Analysis panel" className="w-64 shrink-0 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-3">
      <h2 className="pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Analysis</h2>
      <div className="mb-3 text-xs text-neutral-300">
        <div className="flex justify-between py-0.5">
          <span className="text-neutral-500">Positions</span>
          <span data-testid="analysis-positions">{summary.totalPositions}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-neutral-500">Agents</span>
          <span data-testid="analysis-agents">{summary.agentCount}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-neutral-500">Cells</span>
          <span data-testid="analysis-cells">{heatmap.cells.length}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-neutral-500">Max density</span>
          <span data-testid="analysis-max">{heatmap.maxDensity}</span>
        </div>
      </div>
      <button
        type="button"
        aria-pressed={heatmapVisible}
        onClick={() => useEditorStore.getState().toggleHeatmap()}
        className={`mb-2 rounded px-2 py-1 text-xs ${heatmapVisible ? 'bg-cyan-400 text-neutral-950' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
      >
        Heatmap: {heatmapVisible ? 'ON' : 'OFF'}
      </button>
      <label className="mb-3 flex items-center gap-2 text-xs text-neutral-400">
        Opacity
        <input
          aria-label="Heatmap opacity"
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(heatmapOpacity * 100)}
          onChange={(event) => useEditorStore.getState().setHeatmapOpacity(Number(event.target.value) / 100)}
          className="w-full"
        />
      </label>
      <div aria-label="Heatmap legend" className="border-t border-neutral-800 pt-2 text-[11px] text-neutral-500">
        <div className="flex items-center justify-between">
          <span>Low</span>
          <span>Medium</span>
          <span>High</span>
        </div>
        <div
          data-testid="heatmap-legend-bar"
          className="mt-1 h-2 rounded"
          style={{ background: `linear-gradient(to right, ${HEATMAP_LOW}, ${HEATMAP_MID}, ${HEATMAP_HIGH})` }}
        />
      </div>
      <p className="pt-2 text-[11px] text-neutral-600">Updated from latest simulation</p>
    </aside>
  )
}
