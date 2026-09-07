import { create } from 'zustand'
import { generateId } from '../utils/id.js'
import { assembleNavigationGraph } from '../domain/models/navigation.js'
import {
  advanceSimulationTick,
  checkSimulationPrecondition,
  createAgent,
  findActivePath,
  selectInitialEdge,
} from '../domain/models/simulation.js'
import { useLayoutStore } from './layoutStore.js'
import { useMovementStore } from './movementStore.js'
import { useNavigationStore } from './navigationStore.js'

// Simulation session + single patient agent (Phase 4; 06 §7, 07 §13).
// Session status: running | paused | stopped | completed (09 §10, D-08 —
// no idle/ready in the session model; Ready/Blocked are UI derivations).
// Layout/navigation stay read-only inputs; the agent never writes them.
// One agent only (Phase 5 owns multi-agent).

function currentGraph() {
  const layout = useLayoutStore.getState().layout
  const paths = useNavigationStore.getState().paths
  return assembleNavigationGraph(layout, paths)
}

function buildAgent() {
  const graph = currentGraph()
  const edge = selectInitialEdge(graph)
  if (!edge) {
    return { ok: false, reason: 'no-valid-edge' }
  }
  const active = findActivePath(graph, edge.from, edge.to) ?? edge
  return { ok: true, agent: createAgent(active) }
}

export const useSimulationStore = create((set, get) => ({
  session: null, // { sessionId, layoutId, status, time } | null
  agent: null,

  // FR-CTRL-001: validate -> resolve edge -> init agent + t=0 record.
  start: () => {
    const layout = useLayoutStore.getState().layout
    const graph = currentGraph()
    const check = checkSimulationPrecondition(layout, graph)
    if (!check.allowed) {
      return { ok: false, reason: 'blocked', errors: check.errors }
    }
    const built = buildAgent()
    if (!built.ok) {
      return built
    }
    const session = { sessionId: generateId('session'), layoutId: layout.layoutId, status: 'running', time: 0 }
    const agent = built.agent
    useMovementStore.getState().clear()
    useMovementStore.getState().append({
      movementId: generateId('mov'),
      sessionId: session.sessionId,
      patientId: agent.patientId,
      timestamp: 0,
      x: agent.position.x,
      y: agent.position.y,
    })
    set({ session, agent })
    return { ok: true }
  },

  // One fixed 100ms tick (ALG-SIM-001). No-op unless running.
  tick: () => {
    const { session, agent } = get()
    if (!session || session.status !== 'running' || !agent || agent.status === 'arrived') {
      return { ok: false, reason: 'not-running' }
    }
    const graph = currentGraph()
    const active = findActivePath(graph, agent.currentNode, agent.targetNode)
    if (!active) {
      return { ok: false, reason: 'no-active-path' }
    }
    const stepped = advanceSimulationTick(agent, active.points, session.time, session.sessionId)
    useMovementStore.getState().append(stepped.record)
    const status = stepped.agent.status === 'arrived' ? 'completed' : 'running'
    set({ session: { ...session, time: stepped.timestamp, status }, agent: stepped.agent })
    return { ok: true, arrived: stepped.agent.status === 'arrived' }
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

  // Reset: same session, records cleared, agent re-initialized
  // deterministically, geometry re-resolved, time reset, -> running.
  reset: () => {
    const { session } = get()
    if (!session) {
      return { ok: false, reason: 'no-session' }
    }
    const built = buildAgent()
    if (!built.ok) {
      return built
    }
    useMovementStore.getState().clear()
    useMovementStore.getState().append({
      movementId: generateId('mov'),
      sessionId: session.sessionId,
      patientId: built.agent.patientId,
      timestamp: 0,
      x: built.agent.position.x,
      y: built.agent.position.y,
    })
    set({ session: { ...session, status: 'running', time: 0 }, agent: built.agent })
    return { ok: true }
  },
}))

// UI derivation (04 §7.4): Ready/Blocked are not session states.
export function simulationReadiness(layout, graph) {
  const check = checkSimulationPrecondition(layout, graph)
  return check.allowed ? { ready: true } : { ready: false, errors: check.errors }
}
