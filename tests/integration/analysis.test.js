import { beforeEach, describe, expect, it } from 'vitest'
import { aggregateMovementDensity, buildHeatmapData } from '../../src/domain/models/analysis.js'
import { HEATMAP_CELL_SIZE } from '../../src/domain/constants/analysis.js'
import { useLayoutStore } from '../../src/stores/layoutStore.js'
import { useMovementStore } from '../../src/stores/movementStore.js'
import { useNavigationStore } from '../../src/stores/navigationStore.js'
import { useSimulationStore } from '../../src/stores/simulationStore.js'

// End-to-end through real stores: layout -> path -> simulation ->
// movement records -> density -> heatmap (TC-060, TC-064, TC-068,
// TC-069, TC-070, TC-076).
function resetAll() {
  localStorage.clear()
  useLayoutStore.setState({ layout: { layoutId: 'test-layout', objects: [] } })
  useNavigationStore.setState({ paths: [], selectedPathId: null, pendingSourceId: null, editingPathId: null })
  useSimulationStore.setState({ session: null, agents: [], patientCount: 1 })
  useMovementStore.setState({ records: [] })
}

function buildWorld() {
  const store = useLayoutStore.getState()
  const a = store.addObject({ type: 'entrance', x: 0, y: 0 })
  const b = store.addObject({ type: 'reception', x: 400, y: 0 })
  const nav = useNavigationStore.getState()
  nav.pickSourceObject(a)
  nav.pickDestObject(b)
}

function runToEnd(maxTicks = 2000) {
  const sim = () => useSimulationStore.getState()
  let ticks = 0
  while (sim().session?.status === 'running' && ticks < maxTicks) {
    sim().tick()
    ticks += 1
  }
}

function heatmapOfRecords() {
  const records = useMovementStore.getState().records
  return buildHeatmapData(aggregateMovementDensity(records, HEATMAP_CELL_SIZE), HEATMAP_CELL_SIZE)
}

describe('analysis E2E (TC-060, TC-064, TC-076)', () => {
  beforeEach(resetAll)

  it('produces heatmap from actual simulation movement', () => {
    buildWorld()
    useSimulationStore.getState().start(2)
    runToEnd()
    const records = useMovementStore.getState().records
    expect(records.length).toBeGreaterThan(0)
    const heatmap = heatmapOfRecords()
    expect(heatmap.cells.length).toBeGreaterThan(0)
    expect(heatmap.maxDensity).toBeGreaterThan(0)
    // Every cell lies on the travelled route (y=340 row for this world).
    for (const cell of heatmap.cells) {
      expect(cell.size).toBe(HEATMAP_CELL_SIZE)
      expect(cell.x).toBe(cell.cellX * HEATMAP_CELL_SIZE)
    }
  })

  it('differentiates traffic levels (TC-068)', () => {
    buildWorld()
    useSimulationStore.getState().start(3)
    runToEnd()
    const heatmap = heatmapOfRecords()
    const densities = heatmap.cells.map((cell) => cell.intensityValue)
    expect(Math.max(...densities)).toBeGreaterThan(Math.min(...densities))
  })

  it('recomputes when movement data changes (TC-069)', () => {
    buildWorld()
    useSimulationStore.getState().start()
    runToEnd()
    const first = JSON.stringify(heatmapOfRecords())
    useMovementStore.getState().clear()
    expect(heatmapOfRecords()).toEqual({ cells: [], maxDensity: 0 })
    useSimulationStore.getState().reset()
    runToEnd()
    expect(JSON.stringify(heatmapOfRecords())).toBe(first)
  })

  it('yields empty heatmap without data (TC-070)', () => {
    expect(heatmapOfRecords()).toEqual({ cells: [], maxDensity: 0 })
  })

  it('leaves layout, navigation, simulation, and records untouched', () => {
    buildWorld()
    useSimulationStore.getState().start()
    runToEnd()
    const before = {
      layout: JSON.stringify(useLayoutStore.getState().layout),
      paths: JSON.stringify(useNavigationStore.getState().paths),
      session: JSON.stringify(useSimulationStore.getState().session),
      records: JSON.stringify(useMovementStore.getState().records),
    }
    heatmapOfRecords()
    aggregateMovementDensity(useMovementStore.getState().records)
    expect(JSON.stringify(useLayoutStore.getState().layout)).toBe(before.layout)
    expect(JSON.stringify(useNavigationStore.getState().paths)).toBe(before.paths)
    expect(JSON.stringify(useSimulationStore.getState().session)).toBe(before.session)
    expect(JSON.stringify(useMovementStore.getState().records)).toBe(before.records)
  })
})
