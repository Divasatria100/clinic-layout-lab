// Single patient simulation domain (Phase 4).
//
// Pure functions — no React, Konva, DOM, timers, or storage. Deterministic:
// same inputs always yield the same outputs (no random, no wall-clock).
// Algorithms: ALG-NAV-001/002, ALG-MOVE-001/002/003, ALG-DIST-001,
// ALG-SAMPLE-001, ALG-REC-001, ALG-VAL-003 (10 §31).

import { SIM_DELTA_TIME_MS, SIM_DISTANCE_PER_TICK, SIM_SPEED } from '../constants/simulation.js'
import { generateId } from '../../utils/id.js'
import { validateLayout } from './layout.js'
import { validateNavigationPath } from './navigation.js'

export { SIM_DELTA_TIME_MS, SIM_DISTANCE_PER_TICK, SIM_SPEED }

function segmentLength([x1, y1], [x2, y2]) {
  return Math.hypot(x2 - x1, y2 - y1)
}

// ALG-DIST-001: total Euclidean polyline length.
export function totalPathLength(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return 0
  }
  let total = 0
  for (let i = 0; i < points.length - 1; i += 1) {
    total += segmentLength(points[i], points[i + 1])
  }
  return total
}

// ALG-NAV-002 + ALG-MOVE-002: position at a travelled distance along the
// polyline. Overshoot is consumed across segments (never stalls at a
// waypoint); distance beyond the end clamps to the target.
export function positionAtDistance(points, distance) {
  const first = points[0]
  const last = points[points.length - 1]
  if (!(distance > 0)) {
    return { x: first[0], y: first[1], done: points.length < 2 }
  }
  let remaining = distance
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i]
    const end = points[i + 1]
    const length = segmentLength(start, end)
    if (length === 0) {
      continue // coincident points: localProgress = 1, skip (10 §25)
    }
    if (remaining <= length) {
      const t = remaining / length
      return { x: start[0] + t * (end[0] - start[0]), y: start[1] + t * (end[1] - start[1]), done: false }
    }
    remaining -= length
  }
  return { x: last[0], y: last[1], done: true }
}

// ALG-NAV-001: single-hop lookup — edge with from==currentNode AND
// to==targetNode, else NOT_FOUND. No multi-hop, no pathfinding.
export function findActivePath(graph, currentNode, targetNode) {
  const edges = Array.isArray(graph?.edges) ? graph.edges : []
  return edges.find((edge) => edge.from === currentNode && edge.to === targetNode) ?? null
}

// D-01: deterministic edge choice — valid edges sorted by edge id
// ascending; the first edge supplies currentNode/targetNode.
export function selectInitialEdge(graph) {
  const edges = Array.isArray(graph?.edges) ? [...graph.edges] : []
  edges.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return edges[0] ?? null
}

// FR-SIM-001/002: initialize one agent on an edge (resolved points).
// Schema (05 §5.5, 09 §6): patientId/currentNode/targetNode/progress/
// status, plus runtime `position` for rendering/recording.
export function createAgent(edge) {
  const points = edge.points
  return {
    patientId: generateId('patient'),
    currentNode: edge.from,
    targetNode: edge.to,
    progress: 0,
    status: 'in-progress',
    position: { x: points[0][0], y: points[0][1] },
  }
}

// ALG-MOVE-001: progress advance for one fixed tick. An epsilon snaps
// float accumulation (e.g. 10 x 0.1) to exactly 1 at journey's end.
export function advanceProgress(progress, totalLength, distance = SIM_DISTANCE_PER_TICK) {
  if (totalLength <= 0) {
    return 1
  }
  const next = Math.min(1, progress + distance / totalLength)
  return 1 - next < 1e-9 ? 1 : next
}

// ALG-MOVE-003: arrival is progress >= 1 (never == 1).
export function hasArrived(progress) {
  return progress >= 1
}

// ALG-SIM-001 single tick: move -> position -> record payload.
// Returns { agent, record } with the new simulation timestamp.
export function advanceSimulationTick(agent, edgePoints, time, sessionId) {
  const total = totalPathLength(edgePoints)
  const progress = advanceProgress(agent.progress, total)
  const travelled = progress * total
  const position = total <= 0
    ? { x: edgePoints[0][0], y: edgePoints[0][1] }
    : positionAtDistance(edgePoints, travelled)
  const arrived = hasArrived(progress)
  const timestamp = time + SIM_DELTA_TIME_MS
  return {
    agent: {
      ...agent,
      progress,
      status: arrived ? 'arrived' : 'in-progress',
      position: { x: position.x, y: position.y },
    },
    record: {
      movementId: generateId('mov'),
      sessionId,
      patientId: agent.patientId,
      timestamp,
      x: position.x,
      y: position.y,
    },
    timestamp,
  }
}

// ALG-REC-001: movement record shape (05 §5.6, 09 §16, 10 §12.1).
export function createMovementRecord({ movementId, sessionId, patientId, timestamp, x, y }) {
  return { movementId, sessionId, patientId, timestamp, x, y }
}

// ALG-VAL-003: run only when Layout valid AND Graph valid (09 §19).
// Returns { allowed, reason, errors } — never throws on bad input.
export function checkSimulationPrecondition(layout, graph) {
  const errors = []
  if (!validateLayout(layout).valid) {
    errors.push('layout invalid')
  } else if (layout.objects.length === 0) {
    errors.push('layout has no objects')
  }
  const edges = Array.isArray(graph?.edges) ? graph.edges : []
  const objectIds = Array.isArray(layout?.objects) ? layout.objects.map((obj) => obj.id) : []
  const validEdges = edges.filter((edge) => validateNavigationPath(
    { id: edge.id ?? `${edge.from}->${edge.to}`, from: edge.from, to: edge.to, points: edge.points },
    objectIds,
  ).valid)
  if (validEdges.length === 0) {
    errors.push('no valid navigation edge')
  }
  if (errors.length > 0) {
    return { allowed: false, reason: 'blocked', errors }
  }
  return { allowed: true, reason: 'ok', errors }
}
