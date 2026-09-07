import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../../src/stores/editorStore.js'
import { useLayoutStore } from '../../src/stores/layoutStore.js'
import { useMovementStore } from '../../src/stores/movementStore.js'
import { useNavigationStore } from '../../src/stores/navigationStore.js'
import { useSimulationStore } from '../../src/stores/simulationStore.js'

// Store-level lifecycle through real stores (no timers — ticks are driven
// manually, which is exactly what the UI interval will call).
function resetAll() {
  localStorage.clear()
  useLayoutStore.setState({ layout: { layoutId: 'test-layout', objects: [] } })
  useNavigationStore.setState({ paths: [], selectedPathId: null, pendingSourceId: null, editingPathId: null })
  useSimulationStore.setState({ session: null, agent: null })
  useMovementStore.setState({ records: [] })
  useEditorStore.setState({ toast: null })
}

function buildWorld() {
  const store = useLayoutStore.getState()
  const a = store.addObject({ type: 'entrance', x: 0, y: 0 })
  const b = store.addObject({ type: 'reception', x: 400, y: 0 })
  const nav = useNavigationStore.getState()
  nav.pickSourceObject(a)
  nav.pickDestObject(b)
  return { a, b }
}

function runToEnd(maxTicks = 500) {
  const sim = () => useSimulationStore.getState()
  let ticks = 0
  while (sim().session?.status === 'running' && ticks < maxTicks) {
    sim().tick()
    ticks += 1
  }
  return ticks
}

describe('simulation lifecycle (TC-039, TC-045, TC-075)', () => {
  beforeEach(resetAll)

  it('starts, runs to completion, and records every tick', () => {
    buildWorld()
    const sim = () => useSimulationStore.getState()
    expect(sim().start()).toMatchObject({ ok: true })
    expect(sim().session).toMatchObject({ status: 'running', time: 0 })
    expect(sim().agent).toMatchObject({ progress: 0, status: 'in-progress' })
    expect(useMovementStore.getState().records).toHaveLength(1)
    expect(useMovementStore.getState().records[0]).toMatchObject({ timestamp: 0 })

    const ticks = runToEnd()
    expect(ticks).toBeGreaterThan(0)
    expect(sim().session.status).toBe('completed')
    expect(sim().agent).toMatchObject({ status: 'arrived', progress: 1 })
    const records = useMovementStore.getState().records
    // t=0 record + one per tick; timestamps strictly 100ms apart.
    expect(records.length).toBe(ticks + 1)
    records.forEach((record, i) => expect(record.timestamp).toBe(i * 100))
    // Layout objects never moved; records immutable.
    expect(useLayoutStore.getState().layout.objects[0]).toMatchObject({ x: 0, y: 0 })
    expect(Object.isFrozen(records[0])).toBe(true)
    // Arrived agent is frozen: further ticks are no-ops (AC-048).
    sim().tick()
    expect(useMovementStore.getState().records).toHaveLength(records.length)
    const finalRecord = useMovementStore.getState().records.at(-1)
    expect(sim().agent.position).toEqual({ x: finalRecord.x, y: finalRecord.y })
  })

  it('blocks start without valid navigation (TC-037/038)', () => {
    expect(useSimulationStore.getState().start()).toMatchObject({ ok: false })
    expect(useSimulationStore.getState().session).toBeNull()
    useLayoutStore.getState().addObject({ type: 'entrance', x: 0, y: 0 })
    expect(useSimulationStore.getState().start()).toMatchObject({ ok: false })
  })

  it('uses the current object center after movement (Q, R)', () => {    const { b } = buildWorld()
    useEditorStore.getState().toggleGrid()
    useLayoutStore.getState().moveObject(b, 0, 400)
    useSimulationStore.getState().start()
    const first = useMovementStore.getState().records[0]
    // Start stays at A center; the destination resolves to the NEW center.
    expect([first.x, first.y]).toEqual([40, 40])
    runToEnd()
    const last = useMovementStore.getState().records.at(-1)
    // Reception center is now (50,440), not the stale creation endpoint.
    expect([last.x, last.y]).toEqual([50, 440])
    expect(useSimulationStore.getState().agent.status).toBe('arrived')
  })

  it('freezes when the active path disappears mid-run (AC-050)', () => {
    buildWorld()
    const sim = () => useSimulationStore.getState()
    sim().start()
    sim().tick()
    const position = { ...sim().agent.position }
    const count = useMovementStore.getState().records.length
    useNavigationStore.getState().clearAll()
    expect(sim().tick()).toMatchObject({ ok: false, reason: 'no-active-path' })
    expect(sim().agent.position).toEqual(position)
    expect(useMovementStore.getState().records).toHaveLength(count)
  })
})

describe('simulation controls (TC-078, TC-079, TC-080, TC-081)', () => {
  beforeEach(resetAll)

  it('pauses, resumes, and stops (L, M, N)', () => {
    buildWorld()
    const sim = () => useSimulationStore.getState()
    sim().start()
    sim().tick()
    const frozen = { ...sim().agent.position }
    const count = useMovementStore.getState().records.length

    expect(sim().pause()).toMatchObject({ ok: true })
    expect(sim().session.status).toBe('paused')
    sim().tick()
    expect(sim().agent.position).toEqual(frozen)
    expect(useMovementStore.getState().records).toHaveLength(count)

    expect(sim().resume()).toMatchObject({ ok: true })
    sim().tick()
    expect(useMovementStore.getState().records).toHaveLength(count + 1)
    expect(sim().stop()).toMatchObject({ ok: true })
    expect(sim().session.status).toBe('stopped')
    const stoppedCount = useMovementStore.getState().records.length
    sim().tick()
    expect(useMovementStore.getState().records).toHaveLength(stoppedCount)
  })

  it('resets to a deterministic initial state (O)', () => {
    buildWorld()
    const sim = () => useSimulationStore.getState()
    sim().start()
    const firstSession = sim().session.sessionId
    sim().tick()
    sim().tick()
    expect(sim().reset()).toMatchObject({ ok: true })
    expect(sim().session).toMatchObject({ sessionId: firstSession, status: 'running', time: 0 })
    expect(sim().agent).toMatchObject({ progress: 0, status: 'in-progress' })
    expect(useMovementStore.getState().records).toHaveLength(1)
    expect(useMovementStore.getState().records[0].timestamp).toBe(0)
    // A fresh start without reset mints a new session.
    runToEnd()
    expect(sim().session.status).toBe('completed')
    sim().start()
    expect(sim().session.sessionId).not.toBe(firstSession)
  })

  it('is deterministic across identical runs (P)', () => {
    const runOnce = () => {
      resetAll()
      buildWorld()
      useSimulationStore.getState().start()
      runToEnd()
      return useMovementStore.getState().records.map((r) => [r.x, r.y, r.timestamp])
    }
    expect(runOnce()).toEqual(runOnce())
  })
})
