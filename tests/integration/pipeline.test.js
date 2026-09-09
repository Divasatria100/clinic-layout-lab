import { beforeEach, describe, expect, it } from 'vitest'
import { aggregateMovementDensity, buildHeatmapData } from '../../src/domain/models/analysis.js'
import { HEATMAP_CELL_SIZE } from '../../src/domain/constants/analysis.js'
import { assembleNavigationGraph } from '../../src/domain/models/navigation.js'
import { resolvePathPoints } from '../../src/domain/models/navigation.js'
import { loadSavedLayout, resetCurrentLayout, saveCurrentLayout } from '../../src/services/layoutService.js'
import { loadSavedNavigation, saveCurrentNavigation } from '../../src/services/navigationService.js'
import { useEditorStore } from '../../src/stores/editorStore.js'
import { useLayoutStore } from '../../src/stores/layoutStore.js'
import { useMovementStore } from '../../src/stores/movementStore.js'
import { useNavigationStore } from '../../src/stores/navigationStore.js'
import { useSimulationStore } from '../../src/stores/simulationStore.js'

// Full-pipeline integration (Phase 8): Editor -> Layout -> Navigation ->
// Simulation -> Movement -> Analysis -> Heatmap, plus LocalStorage
// round-trips. Real stores, real domain, real serialization — no mocks
// except the jsdom environment itself.
function resetAll() {
  localStorage.clear()
  useLayoutStore.setState({ layout: { layoutId: 'test-layout', objects: [] } })
  useNavigationStore.setState({ paths: [], selectedPathId: null, pendingSourceId: null, editingPathId: null })
  useSimulationStore.setState({ session: null, agents: [], patientCount: 1 })
  useMovementStore.setState({ records: [] })
  useEditorStore.setState({
    selectedId: null, activeTool: 'select', mode: 'edit', scale: 1, stageX: 0, stageY: 0,
    gridVisible: true, snapEnabled: true, stageSize: { width: 800, height: 600 },
    toast: null, heatmapVisible: true, heatmapOpacity: 1,
  })
}

// Deterministic fixture: Entrance -> Pharmacy -> Reception -> Exit.
function buildFixture() {
  const store = useLayoutStore.getState()
  const ids = {
    entrance: store.addObject({ type: 'entrance', x: 0, y: 0 }),
    pharmacy: store.addObject({ type: 'pharmacy', x: 400, y: 0 }),
    reception: store.addObject({ type: 'reception', x: 800, y: 0 }),
    exit: store.addObject({ type: 'exit', x: 1200, y: 0 }),
  }
  const nav = () => useNavigationStore.getState()
  for (const [from, to] of [[ids.entrance, ids.pharmacy], [ids.pharmacy, ids.reception], [ids.reception, ids.exit]]) {
    nav().pickSourceObject(from)
    expect(nav().pickDestObject(to).ok).toBe(true)
  }
  return ids
}

function runToEnd(maxTicks = 5000) {
  const sim = () => useSimulationStore.getState()
  let ticks = 0
  while (sim().session?.status === 'running' && ticks < maxTicks) {
    sim().tick()
    ticks += 1
  }
  return ticks
}

describe('full pipeline E2E (§16)', () => {
  beforeEach(resetAll)

  it('Editor -> Layout -> Navigation -> Simulation(3) -> Movement -> Analysis -> Heatmap', () => {
    const ids = buildFixture()

    // Persistence round-trip BEFORE simulation (source data preserved).
    expect(saveCurrentLayout()).toMatchObject({ ok: true })
    expect(saveCurrentNavigation()).toMatchObject({ ok: true })

    // 3-patient simulation to completion.
    expect(useSimulationStore.getState().start(3)).toMatchObject({ ok: true })
    runToEnd()
    expect(useSimulationStore.getState().session.status).toBe('completed')
    expect(useSimulationStore.getState().agents.every((a) => a.status === 'arrived')).toBe(true)

    // Movement records: per-patient, sim-time, immutable.
    const records = useMovementStore.getState().records
    expect(records.length).toBeGreaterThan(0)
    for (const pid of ['patient-1', 'patient-2', 'patient-3']) {
      const own = records.filter((r) => r.patientId === pid)
      expect(own.length).toBeGreaterThan(0)
      own.forEach((r, i) => expect(r.timestamp).toBe(i * 100))
    }

    // Analysis derives cells from those exact records.
    const heatmap = buildHeatmapData(aggregateMovementDensity(records, HEATMAP_CELL_SIZE), HEATMAP_CELL_SIZE)
    expect(heatmap.cells.length).toBeGreaterThan(0)
    expect(heatmap.maxDensity).toBeGreaterThan(0)

    // Move a referenced object: endpoint follows, records/history untouched.
    const recordsBefore = JSON.stringify(records)
    const heatmapBefore = JSON.stringify(heatmap)
    useEditorStore.getState().toggleGrid()
    useLayoutStore.getState().moveObject(ids.exit, 1200, 400)
    const moved = useLayoutStore.getState().layout.objects.find((o) => o.id === ids.exit)
    const resolved = resolvePathPoints(
      useNavigationStore.getState().paths.find((p) => p.to === ids.exit),
      useLayoutStore.getState().layout.objects,
    )
    expect(resolved[resolved.length - 1]).toEqual([moved.x + moved.width / 2, moved.y + moved.height / 2])
    expect(JSON.stringify(useMovementStore.getState().records)).toBe(recordsBefore)
    const recomputed = buildHeatmapData(aggregateMovementDensity(useMovementStore.getState().records, HEATMAP_CELL_SIZE), HEATMAP_CELL_SIZE)
    expect(JSON.stringify(recomputed)).toBe(heatmapBefore)
  })

  it('layout + navigation save/load round-trip preserves the session context', () => {
    const ids = buildFixture()
    expect(saveCurrentLayout()).toMatchObject({ ok: true })
    expect(saveCurrentNavigation()).toMatchObject({ ok: true })

    resetCurrentLayout()
    useNavigationStore.getState().clearAll()
    expect(useLayoutStore.getState().layout.objects).toHaveLength(0)
    expect(useNavigationStore.getState().paths).toHaveLength(0)

    expect(loadSavedLayout()).toMatchObject({ ok: true })
    expect(loadSavedNavigation()).toMatchObject({ ok: true })
    const objects = useLayoutStore.getState().layout.objects
    const paths = useNavigationStore.getState().paths
    expect(objects.map((o) => o.id).sort()).toEqual(Object.values(ids).sort())
    expect(paths).toHaveLength(3)
    for (const path of paths) {
      expect(Object.keys(path).sort()).toEqual(['from', 'id', 'points', 'to'])
    }
    // Navigation still references valid layout ids; journey still runs.
    const graph = assembleNavigationGraph(useLayoutStore.getState().layout, paths)
    expect(graph.edges).toHaveLength(3)
    expect(useSimulationStore.getState().start()).toMatchObject({ ok: true })
    runToEnd()
    expect(useSimulationStore.getState().session.status).toBe('completed')
  })

  it('broken references stay stable without crashing', () => {
    const ids = buildFixture()
    // Delete the middle object: paths referencing it become invalid refs.
    useLayoutStore.getState().deleteObject(ids.pharmacy)
    const paths = useNavigationStore.getState().paths
    expect(paths).toHaveLength(3)
    const graph = assembleNavigationGraph(useLayoutStore.getState().layout, paths)
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]).toMatchObject({ from: ids.reception, to: ids.exit })
    // Persisted + reloaded navigation keeps all three paths (no cascade).
    expect(saveCurrentNavigation()).toMatchObject({ ok: true })
    useNavigationStore.getState().clearAll()
    expect(loadSavedNavigation()).toMatchObject({ ok: true })
    expect(useNavigationStore.getState().paths).toHaveLength(3)
  })

  it('invalid storage data is rejected safely without exceptions', () => {
    buildFixture()
    const layoutBefore = JSON.stringify(useLayoutStore.getState().layout)
    const pathsBefore = JSON.stringify(useNavigationStore.getState().paths)
    localStorage.setItem('clinic-layout-lab:layout', '{corrupt')
    localStorage.setItem('clinic-layout-lab:navigation', JSON.stringify({ paths: [{ id: 'x' }] }))
    expect(loadSavedLayout()).toMatchObject({ ok: false })
    expect(loadSavedNavigation()).toMatchObject({ ok: false })
    expect(JSON.stringify(useLayoutStore.getState().layout)).toBe(layoutBefore)
    expect(JSON.stringify(useNavigationStore.getState().paths)).toBe(pathsBefore)
    expect(() => useSimulationStore.getState().start()).not.toThrow()
  })

  it('mode switching preserves all pipeline state', () => {
    buildFixture()
    useSimulationStore.getState().start()
    runToEnd()
    const snapshot = {
      layout: JSON.stringify(useLayoutStore.getState().layout),
      paths: JSON.stringify(useNavigationStore.getState().paths),
      session: JSON.stringify(useSimulationStore.getState().session),
      records: JSON.stringify(useMovementStore.getState().records),
    }
    for (const mode of ['path', 'simulation', 'analysis', 'edit']) {
      useEditorStore.getState().setMode(mode)
    }
    expect(JSON.stringify(useLayoutStore.getState().layout)).toBe(snapshot.layout)
    expect(JSON.stringify(useNavigationStore.getState().paths)).toBe(snapshot.paths)
    expect(JSON.stringify(useSimulationStore.getState().session)).toBe(snapshot.session)
    expect(JSON.stringify(useMovementStore.getState().records)).toBe(snapshot.records)
  })

  it('selection is UI state and never persists', () => {
    buildFixture()
    const firstId = useLayoutStore.getState().layout.objects[0].id
    useEditorStore.getState().select(firstId)
    expect(saveCurrentLayout()).toMatchObject({ ok: true })
    const raw = localStorage.getItem('clinic-layout-lab:layout')
    expect(raw).not.toContain('selectedId')
    expect(raw).not.toContain('selected')
    const parsed = JSON.parse(raw)
    expect(Object.keys(parsed).sort()).toEqual(['layoutId', 'objects'])
    expect(Object.keys(parsed.objects[0]).sort()).toEqual(['asset', 'height', 'id', 'rotation', 'type', 'width', 'x', 'y'])
  })
})