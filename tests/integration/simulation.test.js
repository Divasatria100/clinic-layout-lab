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
  useSimulationStore.setState({ session: null, agents: [], patientCount: 1 })
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
    expect(sim().agents[0]).toMatchObject({ progress: 0, status: 'in-progress' })
    expect(useMovementStore.getState().records).toHaveLength(1)
    expect(useMovementStore.getState().records[0]).toMatchObject({ timestamp: 0 })

    const ticks = runToEnd()
    expect(ticks).toBeGreaterThan(0)
    expect(sim().session.status).toBe('completed')
    expect(sim().agents[0]).toMatchObject({ status: 'arrived', progress: 1 })
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
    expect(sim().agents[0].position).toEqual({ x: finalRecord.x, y: finalRecord.y })
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
    expect(useSimulationStore.getState().agents[0].status).toBe('arrived')
  })

  it('freezes when the active path disappears mid-run (AC-050)', () => {
    buildWorld()
    const sim = () => useSimulationStore.getState()
    sim().start()
    sim().tick()
    const position = { ...sim().agents[0].position }
    const count = useMovementStore.getState().records.length
    useNavigationStore.getState().clearAll()
    expect(sim().tick()).toMatchObject({ ok: false, reason: 'no-active-path' })
    expect(sim().agents[0].position).toEqual(position)
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
    const frozen = { ...sim().agents[0].position }
    const count = useMovementStore.getState().records.length

    expect(sim().pause()).toMatchObject({ ok: true })
    expect(sim().session.status).toBe('paused')
    sim().tick()
    expect(sim().agents[0].position).toEqual(frozen)
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
    expect(sim().agents[0]).toMatchObject({ progress: 0, status: 'in-progress' })
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

describe('chained journey (AC-R03..R07, R16, R17)', () => {
  beforeEach(resetAll)

  function buildChain() {
    const store = useLayoutStore.getState()
    const ids = {}
    ids.entrance = store.addObject({ type: 'entrance', x: 0, y: 0 })
    ids.pharmacy = store.addObject({ type: 'pharmacy', x: 400, y: 0 })
    ids.reception = store.addObject({ type: 'reception', x: 800, y: 0 })
    ids.exit = store.addObject({ type: 'exit', x: 1200, y: 0 })
    const nav = () => useNavigationStore.getState()
    for (const [from, to] of [[ids.entrance, ids.pharmacy], [ids.pharmacy, ids.reception], [ids.reception, ids.exit]]) {
      nav().pickSourceObject(from)
      expect(nav().pickDestObject(to).ok).toBe(true)
    }
    return ids
  }

  function runJourney(maxTicks = 2000) {
    const sim = () => useSimulationStore.getState()
    const targets = []
    let lastTarget = sim().agents[0].targetNode
    let ticks = 0
    while (sim().session?.status === 'running' && ticks < maxTicks) {
      sim().tick()
      ticks += 1
      const current = sim().agents[0].targetNode
      if (current !== lastTarget) {
        targets.push(current)
        lastTarget = current
      }
    }
    return { ticks, targets }
  }

  it('traverses the full chain without premature completion', () => {
    const ids = buildChain()
    const sim = () => useSimulationStore.getState()
    expect(sim().start()).toMatchObject({ ok: true })
    expect(sim().agents[0]).toMatchObject({ currentNode: ids.entrance, targetNode: ids.pharmacy })

    const { targets } = runJourney()
    // Arrival on pharmacy/reception continues; only exit completes.
    expect(targets).toEqual([ids.reception, ids.exit])
    expect(sim().session.status).toBe('completed')
    expect(sim().agents[0]).toMatchObject({ currentNode: ids.exit, status: 'arrived', progress: 1 })
    // Records span the whole route with sim-time spacing.
    const records = useMovementStore.getState().records
    expect(records.length).toBeGreaterThan(3)
    records.forEach((record, i) => expect(record.timestamp).toBe(i * 100))
    const last = records.at(-1)
    // Exit center (1200,0,80x80).
    expect([last.x, last.y]).toEqual([1240, 40])
  })

  it('resets to the journey start deterministically', () => {
    const ids = buildChain()
    const sim = () => useSimulationStore.getState()
    sim().start()
    for (let i = 0; i < 30; i += 1) {
      sim().tick()
    }
    expect(sim().reset()).toMatchObject({ ok: true })
    expect(sim().agents[0]).toMatchObject({ currentNode: ids.entrance, targetNode: ids.pharmacy, progress: 0, status: 'in-progress' })
    expect(useMovementStore.getState().records).toHaveLength(1)
  })

  it('blocks cyclic journeys without hanging', () => {
    const store = useLayoutStore.getState()
    const a = store.addObject({ type: 'entrance', x: 0, y: 0 })
    const b = store.addObject({ type: 'pharmacy', x: 400, y: 0 })
    const c = store.addObject({ type: 'reception', x: 800, y: 0 })
    const nav = () => useNavigationStore.getState()
    for (const [from, to] of [[a, b], [b, c], [c, a]]) {
      nav().pickSourceObject(from)
      nav().pickDestObject(to)
    }
    expect(useSimulationStore.getState().start()).toMatchObject({ ok: false })
    expect(useSimulationStore.getState().session).toBeNull()
  })

  it('ignores disconnected components', () => {
    const ids = buildChain()
    const store = useLayoutStore.getState()
    const s = store.addObject({ type: 'toilet', x: 0, y: 600 })
    const r = store.addObject({ type: 'doctor-room', x: 400, y: 600 })
    const nav = () => useNavigationStore.getState()
    nav().pickSourceObject(s)
    nav().pickDestObject(r)
    const sim = () => useSimulationStore.getState()
    expect(sim().start()).toMatchObject({ ok: true })
    const { targets } = runJourney()
    expect(sim().session.status).toBe('completed')
    // Exactly one connected component is traversed — never a mixture.
    // (Which one depends on uuid sort order, both are deterministic.)
    const mainChain = JSON.stringify([ids.reception, ids.exit])
    const sideOnly = JSON.stringify([])
    expect([mainChain, sideOnly]).toContain(JSON.stringify(targets))
    if (targets.length === 0) {
      expect(sim().agents[0].targetNode).toBe(r)
    }
  })
})

describe('Phase 5 multi-agent (AC-P5-01..26)', () => {
  beforeEach(resetAll)

  function buildChainWorld() {
    const store = useLayoutStore.getState()
    const ids = {}
    ids.entrance = store.addObject({ type: 'entrance', x: 0, y: 0 })
    ids.pharmacy = store.addObject({ type: 'pharmacy', x: 400, y: 0 })
    ids.reception = store.addObject({ type: 'reception', x: 800, y: 0 })
    const nav = () => useNavigationStore.getState()
    nav().pickSourceObject(ids.entrance)
    nav().pickDestObject(ids.pharmacy)
    nav().pickSourceObject(ids.pharmacy)
    nav().pickDestObject(ids.reception)
    return ids
  }

  it('validates count and defaults to 1', () => {
    buildWorld()
    const sim = () => useSimulationStore.getState()
    for (const bad of [0, 11, Number.NaN, 2.5]) {
      expect(sim().start(bad)).toMatchObject({ ok: false, reason: 'invalid-count' })
    }
    expect(sim().session).toBeNull()
    expect(sim().start()).toMatchObject({ ok: true })
    expect(sim().agents).toHaveLength(1)
    expect(sim().agents[0].patientId).toBe('patient-1')
  })

  it('initializes N independent agents on the same clock', () => {
    buildWorld()
    const sim = () => useSimulationStore.getState()
    expect(sim().start(3)).toMatchObject({ ok: true })
    expect(sim().agents.map((a) => a.patientId)).toEqual(['patient-1', 'patient-2', 'patient-3'])
    expect(sim().session.status).toBe('running')
    // One t=0 record per agent, same timestamp.
    const t0 = useMovementStore.getState().records.filter((r) => r.timestamp === 0)
    expect(t0).toHaveLength(3)
    expect(new Set(t0.map((r) => r.patientId)).size).toBe(3)

    sim().tick()
    // Every active agent recorded exactly once more, same timestamp.
    const t100 = useMovementStore.getState().records.filter((r) => r.timestamp === 100)
    expect(t100).toHaveLength(3)
    expect(new Set(t100.map((r) => r.patientId)).size).toBe(3)
    // Independent state objects.
    expect(sim().agents[0]).not.toBe(sim().agents[1])
  })

  it('starts every agent at the structural start and completes together', () => {
    const ids = buildChainWorld()
    const sim = () => useSimulationStore.getState()
    expect(sim().start(2)).toMatchObject({ ok: true })
    // Both agents start at Entrance — never mid-chain.
    expect(sim().agents.map((a) => a.currentNode)).toEqual([ids.entrance, ids.entrance])
    expect(sim().agents.map((a) => a.targetNode)).toEqual([ids.pharmacy, ids.pharmacy])
    // Mid-journey: session still running, none arrived.
    for (let i = 0; i < 5; i += 1) {
      sim().tick()
    }
    expect(sim().session.status).toBe('running')
    expect(sim().agents.every((a) => a.status === 'in-progress')).toBe(true)
    runToEnd()
    expect(sim().session.status).toBe('completed')
    expect(sim().agents.every((a) => a.status === 'arrived')).toBe(true)
    expect(sim().agents.every((a) => a.currentNode === ids.reception)).toBe(true)
  })

  it('runs 10 agents without crashing (AC-P5-26)', () => {
    buildWorld()
    const sim = () => useSimulationStore.getState()
    expect(sim().start(10)).toMatchObject({ ok: true })
    expect(sim().agents).toHaveLength(10)
    runToEnd()
    expect(sim().session.status).toBe('completed')
    expect(new Set(useMovementStore.getState().records.map((r) => r.patientId)).size).toBe(10)
  })

  it('pauses/resumes/stops all agents together', () => {
    buildWorld()
    const sim = () => useSimulationStore.getState()
    sim().start(2)
    sim().tick()
    const snapshot = JSON.stringify(sim().agents.map((a) => a.position))
    sim().pause()
    sim().tick()
    expect(JSON.stringify(sim().agents.map((a) => a.position))).toBe(snapshot)
    sim().resume()
    sim().tick()
    expect(JSON.stringify(sim().agents.map((a) => a.position))).not.toBe(snapshot)
    sim().stop()
    expect(sim().session.status).toBe('stopped')
  })

  it('resets all agents deterministically with the same count', () => {
    buildWorld()
    const sim = () => useSimulationStore.getState()
    sim().start(2)
    const firstSession = sim().session.sessionId
    for (let i = 0; i < 5; i += 1) {
      sim().tick()
    }
    expect(sim().reset()).toMatchObject({ ok: true })
    expect(sim().session).toMatchObject({ sessionId: firstSession, status: 'running', time: 0 })
    expect(sim().agents.map((a) => a.patientId)).toEqual(['patient-1', 'patient-2'])
    expect(sim().agents.every((a) => a.progress === 0 && a.status === 'in-progress')).toBe(true)
    expect(useMovementStore.getState().records).toHaveLength(2)
  })

  it('stays deterministic across identical multi-agent runs', () => {
    const runOnce = () => {
      resetAll()
      buildWorld()
      useSimulationStore.getState().start(3)
      runToEnd()
      return useMovementStore.getState().records.map((r) => [r.patientId, r.x, r.y, r.timestamp])
    }
    expect(runOnce()).toEqual(runOnce())
  })
})


