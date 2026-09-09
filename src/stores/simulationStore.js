import { create } from 'zustand'
import { generateId } from '../utils/id.js'
import { assembleNavigationGraph } from '../domain/models/navigation.js'
import {
  advanceSimulationTick,
  checkSimulationPrecondition,
  createAgent,
  findActivePath,
  journeyStartEdge,
  patientIdFor,
  resolveJourney,
  transitionEdge,
  validatePatientCount,
} from '../domain/models/simulation.js'
import { useLayoutStore } from './layoutStore.js'
import { useMovementStore } from './movementStore.js'
import { useNavigationStore } from './navigationStore.js'

// Simulation session + patient agents (Phase 4 + Phase 5; 06 §7, 07 §13).
// Session status: running | paused | stopped | completed (09 §10, D-08 —
// no idle/ready in the session model; Ready/Blocked are UI derivations).
// Layout/navigation stay read-only inputs; agents never write them.
// agents[] holds 1..10 independent agents sharing one simulation clock.
export const DEFAULT_PATIENT_COUNT = 1

function currentGraph() {
  const layout = useLayoutStore.getState().layout
  const paths = useNavigationStore.getState().paths
  return assembleNavigationGraph(layout, paths)
}

// Deterministic build of N agents: every agent starts on the FIRST edge
// of the resolved structural journey (never mid-chain), then follows the
// chained engine independently.
function buildAgents(patientCount) {
  const graph = currentGraph()
  const journey = resolveJourney(graph)
  const first = journeyStartEdge(journey)
  if (!first) {
    return { ok: false, reason: 'blocked', errors: [journey.reason ?? 'no-valid-edge'] }
  }
  const active = findActivePath(graph, first.from, first.to) ?? first
  const agents = Array.from({ length: patientCount }, (_, i) => createAgent(active, patientIdFor(i)))
  return { ok: true, agents }
}

function initialRecord(sessionId, agent) {
  return {
    movementId: generateId('mov'),
    sessionId,
    patientId: agent.patientId,
    timestamp: 0,
    x: agent.position.x,
    y: agent.position.y,
  }
}

export const useSimulationStore = create((set, get) => ({
  session: null, // { sessionId, layoutId, status, time } | null
  agents: [],
  patientCount: DEFAULT_PATIENT_COUNT,

  // FR-CTRL-001 (+ FR-SIM-006): validate -> resolve journey -> init N
  // agents + t=0 records each. patientCount is a Start parameter
  // (09 §4-5), not persisted configuration.
  start: (patientCount = DEFAULT_PATIENT_COUNT) => {
    if (!validatePatientCount(patientCount).valid) {
      return { ok: false, reason: 'invalid-count' }
    }
    const layout = useLayoutStore.getState().layout
    const graph = currentGraph()
    const check = checkSimulationPrecondition(layout, graph, patientCount)
    if (!check.allowed) {
      return { ok: false, reason: 'blocked', errors: check.errors }
    }
    const built = buildAgents(patientCount)
    if (!built.ok) {
      return built
    }
    const session = { sessionId: generateId('session'), layoutId: layout.layoutId, status: 'running', time: 0 }
    const movements = useMovementStore.getState()
    movements.clear()
    for (const agent of built.agents) {
      movements.append(initialRecord(session.sessionId, agent))
    }
    set({ session, agents: built.agents, patientCount })
    return { ok: true }
  },

  // One fixed 100ms tick (ALG-SIM-001) for every active agent on the same
  // clock. Completed only when ALL agents arrived. No-op unless running.
  tick: () => {
    const { session, agents } = get()
    if (!session || session.status !== 'running' || agents.length === 0) {
      return { ok: false, reason: 'not-running' }
    }
    if (agents.every((agent) => agent.status === 'arrived')) {
      return { ok: false, reason: 'not-running' }
    }
    const graph = currentGraph()
    const movements = useMovementStore.getState()
    let nextAgents = agents
    let moved = false
    for (const agent of agents) {
      if (agent.status === 'arrived') {
        continue
      }
      const active = findActivePath(graph, agent.currentNode, agent.targetNode)
      if (!active) {
        continue
      }
      const stepped = advanceSimulationTick(agent, active.points, session.time, session.sessionId)
      movements.append(stepped.record)
      moved = true
      let nextAgent = stepped.agent
      if (stepped.agent.status === 'arrived') {
        nextAgent = transitionEdge(stepped.agent, graph).agent
      }
      nextAgents = nextAgents.map((entry) => (entry.patientId === agent.patientId ? nextAgent : entry))
    }
    if (!moved) {
      return { ok: false, reason: 'no-active-path' }
    }
    const status = nextAgents.every((agent) => agent.status === 'arrived') ? 'completed' : 'running'
    set({ session: { ...session, time: session.time + 100, status }, agents: nextAgents })
    return { ok: true }
  },

  pause: () => {
    const { session } = get()
    if (!session || session.status !== 'running') {
      return { ok: false, reason: 'not-running' }
    }
    set({ session: { ...session, status: 'paused' } })
    return { ok: true }
  },

  resume: () => {
    const { session } = get()
    if (!session || session.status !== 'paused') {
      return { ok: false, reason: 'not-paused' }
    }
    set({ session: { ...session, status: 'running' } })
    return { ok: true }
  },

  // Stop halts but retains state and records (Stop != Reset).
  stop: () => {
    const { session } = get()
    if (!session || (session.status !== 'running' && session.status !== 'paused')) {
      return { ok: false, reason: 'not-active' }
    }
    set({ session: { ...session, status: 'stopped' } })
    return { ok: true }
  },

  // Reset: same session, records cleared, all agents re-initialized
  // deterministically, geometry re-resolved, time reset, -> running.
  reset: () => {
    const { session, patientCount } = get()
    if (!session) {
      return { ok: false, reason: 'no-session' }
    }
    const built = buildAgents(patientCount)
    if (!built.ok) {
      return built
    }
    const movements = useMovementStore.getState()
    movements.clear()
    for (const agent of built.agents) {
      movements.append(initialRecord(session.sessionId, agent))
    }
    set({ session: { ...session, status: 'running', time: 0 }, agents: built.agents })
    return { ok: true }
  },
}))

// UI derivation (04 §7.4): Ready/Blocked are not session states.
export function simulationReadiness(layout, graph, patientCount = DEFAULT_PATIENT_COUNT) {
  const check = checkSimulationPrecondition(layout, graph, patientCount)
  return check.allowed ? { ready: true } : { ready: false, errors: check.errors }
}
