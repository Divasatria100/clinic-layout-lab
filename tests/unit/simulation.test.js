import { describe, expect, it } from 'vitest'
import { SIM_DELTA_TIME_MS, SIM_DISTANCE_PER_TICK, SIM_SPEED } from '../../src/domain/constants/simulation.js'
import {
  advanceProgress,
  advanceSimulationTick,
  checkSimulationPrecondition,
  createAgent,
  createMovementRecord,
  findActivePath,
  findStartCandidates,
  findTerminalNodes,
  getOutgoingEdges,
  hasArrived,
  positionAtDistance,
  resolveJourney,
  selectInitialEdge,
  totalPathLength,
  transitionEdge,
} from '../../src/domain/models/simulation.js'

const GRAPH = {
  nodes: ['a', 'b'],
  edges: [
    { id: 'edge-3', from: 'a', to: 'b', points: [[0, 0], [300, 0]] },
    { id: 'edge-1', from: 'a', to: 'b', points: [[0, 0], [100, 0]] },
    { id: 'edge-2', from: 'b', to: 'a', points: [[100, 0], [0, 0]] },
  ],
}

describe('simulation configuration (A, D)', () => {
  it('uses the normative speed, tick, and distance', () => {
    expect(SIM_SPEED).toBe(80)
    expect(SIM_DELTA_TIME_MS).toBe(100)
    expect(SIM_DISTANCE_PER_TICK).toBe(8)
    expect(advanceProgress(0, 100)).toBeCloseTo(0.08, 10)
  })
})

describe('agent initialization (B) and edge sorting (C)', () => {
  it('picks the lexicographically first edge deterministically', () => {
    const edge = selectInitialEdge(GRAPH)
    expect(edge.id).toBe('edge-1')
    expect(selectInitialEdge({ edges: [] })).toBeNull()
    // Same input twice -> same edge (no random).
    expect(selectInitialEdge(GRAPH).id).toBe('edge-1')
  })

  it('initializes one agent with unique id on the edge', () => {
    const edge = selectInitialEdge(GRAPH)
    const a = createAgent(edge)
    const b = createAgent(edge)
    expect(a.patientId).not.toBe(b.patientId)
    expect(a).toMatchObject({ currentNode: 'a', targetNode: 'b', progress: 0, status: 'in-progress' })
    expect(a.position).toEqual({ x: 0, y: 0 })
  })

  it('finds the active single-hop path or NOT_FOUND', () => {
    expect(findActivePath(GRAPH, 'a', 'b').id).toBe('edge-3')
    expect(findActivePath(GRAPH, 'a', 'ghost')).toBeNull()
  })
})

describe('movement calculation (E, F, G, H, I)', () => {
  it('moves horizontally without teleporting', () => {
    const pos = positionAtDistance([[0, 0], [100, 0]], 8)
    expect(pos).toMatchObject({ x: 8, y: 0, done: false })
  })

  it('moves vertically', () => {
    expect(positionAtDistance([[0, 0], [0, 100]], 8)).toMatchObject({ x: 0, y: 8, done: false })
  })

  it('moves along diagonals proportionally', () => {
    const pos = positionAtDistance([[0, 0], [60, 80]], 50)
    expect(pos.x).toBeCloseTo(30, 10)
    expect(pos.y).toBeCloseTo(40, 10)
  })

  it('traverses waypoints in order and consumes overshoot', () => {
    // A(0,0) -> P1(10,0) -> B(10,10): move 15 from start.
    const pos = positionAtDistance([[0, 0], [10, 0], [10, 10]], 15)
    expect(pos).toMatchObject({ x: 10, y: 5, done: false })
    // Exact arrival clamps to target.
    expect(positionAtDistance([[0, 0], [10, 0]], 10)).toMatchObject({ x: 10, y: 0, done: false })
    expect(positionAtDistance([[0, 0], [10, 0]], 999)).toMatchObject({ x: 10, y: 0, done: true })
  })

  it('clamps progress and detects arrival on >= 1', () => {
    expect(advanceProgress(0.99, 100)).toBe(1)
    expect(hasArrived(1)).toBe(true)
    expect(hasArrived(1.5)).toBe(true)
    expect(hasArrived(0.999)).toBe(false)
    expect(advanceProgress(0, 0)).toBe(1)
    expect(totalPathLength([[0, 0], [3, 4]])).toBe(5)
  })
})

describe('tick, sampling, and time (J, K)', () => {
  it('advances one tick with a sim-time record', () => {
    const agent = createAgent({ from: 'a', to: 'b', points: [[0, 0], [80, 0]] })
    const stepped = advanceSimulationTick(agent, [[0, 0], [80, 0]], 0, 's1')
    expect(stepped.timestamp).toBe(100)
    expect(stepped.agent.position).toMatchObject({ x: 8, y: 0 })
    expect(stepped.agent.progress).toBeCloseTo(0.1, 10)
    expect(stepped.record).toMatchObject({ sessionId: 's1', timestamp: 100, x: 8, y: 0 })
    expect(stepped.record.movementId.length).toBeGreaterThan(0)
  })

  it('arrives exactly at the end of a 10-tick journey', () => {
    let agent = createAgent({ from: 'a', to: 'b', points: [[0, 0], [80, 0]] })
    let time = 0
    const timestamps = []
    for (let i = 0; i < 10; i += 1) {
      const stepped = advanceSimulationTick(agent, [[0, 0], [80, 0]], time, 's1')
      agent = stepped.agent
      time = stepped.timestamp
      timestamps.push(stepped.record.timestamp)
    }
    expect(timestamps).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])
    expect(agent.status).toBe('arrived')
    expect(agent.position).toMatchObject({ x: 80, y: 0 })
  })

  it('is deterministic across runs (P)', () => {
    const run = () => {
      let agent = createAgent({ from: 'a', to: 'b', points: [[0, 0], [50, 50], [100, 0]] })
      let time = 0
      const out = []
      for (let i = 0; i < 20; i += 1) {
        const stepped = advanceSimulationTick(agent, [[0, 0], [50, 50], [100, 0]], time, 's')
        agent = stepped.agent
        time = stepped.timestamp
        out.push([stepped.record.x, stepped.record.y, stepped.record.timestamp])
      }
      return out
    }
    expect(run()).toEqual(run())
  })
})

describe('movement record shape (S: schema)', () => {
  it('carries the exact record fields', () => {
    expect(Object.keys(createMovementRecord({ movementId: 'm', sessionId: 's', patientId: 'p', timestamp: 0, x: 1, y: 2 }))).toEqual(
      ['movementId', 'sessionId', 'patientId', 'timestamp', 'x', 'y'],
    )
  })
})

describe('precondition gate (S: validation)', () => {
  const layout = { layoutId: 'l', objects: [{ id: 'a', type: 'entrance', asset: 'entrance.png', x: 0, y: 0, width: 80, height: 80, rotation: 0 }] }
  const graph = { nodes: ['a'], edges: [{ id: 'e', from: 'a', to: 'a', points: [[0, 0]] }] }

  it('blocks empty layouts, invalid layouts, and edgeless graphs', () => {
    expect(checkSimulationPrecondition({ layoutId: 'l', objects: [] }, GRAPH).allowed).toBe(false)
    expect(checkSimulationPrecondition(null, GRAPH).allowed).toBe(false)
    expect(checkSimulationPrecondition(layout, { nodes: [], edges: [] }).allowed).toBe(false)
    expect(checkSimulationPrecondition(layout, graph).allowed).toBe(false)
  })

  it('allows valid layout + valid edge', () => {
    const good = {
      nodes: ['a', 'b'],
      edges: [{ id: 'e1', from: 'a', to: 'b', points: [[0, 0], [10, 10]] }],
    }
    const full = { layoutId: 'l', objects: [...layout.objects, { id: 'b', type: 'exit', asset: 'exit.png', x: 10, y: 10, width: 80, height: 80, rotation: 0 }] }
    expect(checkSimulationPrecondition(full, good)).toMatchObject({ allowed: true, reason: 'ok' })
  })
})

describe('chained journey (AC-R01..R07, R17)', () => {
  const chain = {
    nodes: ['entrance', 'pharmacy', 'reception', 'exit'],
    edges: [
      { id: 'e1', from: 'entrance', to: 'pharmacy', points: [[0, 0], [100, 0]] },
      { id: 'e2', from: 'pharmacy', to: 'reception', points: [[100, 0], [200, 0]] },
      { id: 'e3', from: 'reception', to: 'exit', points: [[200, 0], [300, 0]] },
    ],
  }

  it('detects start candidates structurally, not by name', () => {
    expect(findStartCandidates(chain)).toEqual(['entrance'])
    expect(findStartCandidates({ nodes: ['b', 'a'], edges: [{ id: 'e', from: 'b', to: 'a', points: [[0, 0], [1, 1]] }] })).toEqual(['b'])
    // Multi-start: sorted by node id, first wins.
    const multi = {
      nodes: ['zb', 'aa', 'm'],
      edges: [
        { id: 'e1', from: 'zb', to: 'm', points: [[0, 0], [1, 1]] },
        { id: 'e2', from: 'aa', to: 'm', points: [[0, 0], [1, 1]] },
      ],
    }
    expect(findStartCandidates(multi)).toEqual(['aa', 'zb'])
  })

  it('detects terminal nodes (no outgoing edge)', () => {
    expect(findTerminalNodes(chain)).toEqual(['exit'])
    const fork = {
      nodes: ['r', 'xa', 'xb'],
      edges: [
        { id: 'e1', from: 'r', to: 'xa', points: [[0, 0], [1, 1]] },
        { id: 'e2', from: 'r', to: 'xb', points: [[0, 0], [1, 1]] },
      ],
    }
    expect(findTerminalNodes(fork)).toEqual(['xa', 'xb'])
  })

  it('resolves the full chain in order', () => {
    const journey = resolveJourney(chain)
    expect(journey.ok).toBe(true)
    expect(journey.startNode).toBe('entrance')
    expect(journey.terminalNode).toBe('exit')
    expect(journey.route.map((e) => e.id)).toEqual(['e1', 'e2', 'e3'])
  })

  it('resolves a single edge as a one-step journey', () => {
    const journey = resolveJourney({
      nodes: ['a', 'b'],
      edges: [{ id: 'e', from: 'a', to: 'b', points: [[0, 0], [10, 10]] }],
    })
    expect(journey).toMatchObject({ ok: true, startNode: 'a', terminalNode: 'b' })
    expect(journey.route).toHaveLength(1)
  })

  it('picks the first outgoing edge by id deterministically', () => {
    const fork = {
      nodes: ['e', 'p', 'r'],
      edges: [
        { id: 'e-002', from: 'e', to: 'r', points: [[0, 0], [1, 1]] },
        { id: 'e-001', from: 'e', to: 'p', points: [[0, 0], [1, 1]] },
      ],
    }
    expect(getOutgoingEdges(fork, 'e').map((e) => e.id)).toEqual(['e-001', 'e-002'])
    expect(resolveJourney(fork).route.map((e) => e.id)).toEqual(['e-001'])
  })

  it('ignores disconnected components', () => {
    const graph = {
      nodes: ['a', 'b', 's', 'r'],
      edges: [
        { id: 'e1', from: 'a', to: 'b', points: [[0, 0], [10, 10]] },
        { id: 'e9', from: 's', to: 'r', points: [[50, 50], [60, 60]] },
      ],
    }
    const journey = resolveJourney(graph)
    expect(journey.ok).toBe(true)
    expect(journey.route.map((e) => e.id)).toEqual(['e1'])
  })

  it('rejects cyclic journeys without looping', () => {
    const cyclic = {
      nodes: ['a', 'b', 'c'],
      edges: [
        { id: 'e1', from: 'a', to: 'b', points: [[0, 0], [1, 1]] },
        { id: 'e2', from: 'b', to: 'c', points: [[1, 1], [2, 2]] },
        { id: 'e3', from: 'c', to: 'a', points: [[2, 2], [0, 0]] },
      ],
    }
    // Pure cycle: every node has an incoming edge -> no start candidate.
    expect(resolveJourney(cyclic)).toMatchObject({ ok: false, reason: 'no-start-node' })
    // Cycle with an entry tail: entry resolves, revisit detected.
    const tailed = {
      nodes: ['s', 'a', 'b'],
      edges: [
        { id: 'e0', from: 's', to: 'a', points: [[0, 0], [1, 1]] },
        { id: 'e1', from: 'a', to: 'b', points: [[1, 1], [2, 2]] },
        { id: 'e2', from: 'b', to: 'a', points: [[2, 2], [1, 1]] },
      ],
    }
    expect(resolveJourney(tailed)).toMatchObject({ ok: false, reason: 'cyclic-journey' })
  })

  it('transitions edges on arrival and completes at terminals', () => {
    const agent = { ...createAgent(chain.edges[0]), visitedNodeIds: ['entrance'] }
    const arrived = { ...agent, currentNode: 'entrance', targetNode: 'pharmacy', progress: 1, status: 'arrived', position: { x: 100, y: 0 } }
    const continued = transitionEdge(arrived, chain)
    expect(continued.continued).toBe(true)
    expect(continued.agent).toMatchObject({ currentNode: 'pharmacy', targetNode: 'reception', progress: 0, status: 'in-progress' })
    expect(continued.agent.position).toEqual({ x: 100, y: 0 })
    expect(continued.agent.visitedNodeIds).toEqual(['entrance', 'pharmacy'])

    const last = { ...continued.agent, currentNode: 'reception', targetNode: 'exit', progress: 1, status: 'arrived', position: { x: 300, y: 0 }, visitedNodeIds: ['entrance', 'pharmacy', 'reception'] }
    const done = transitionEdge(last, chain)
    expect(done.continued).toBe(false)
    expect(done.agent.status).toBe('arrived')
  })
})
