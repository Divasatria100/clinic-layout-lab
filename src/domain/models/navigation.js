// Navigation Path domain (Phase 3).
//
// Pure functions — no React, Konva, DOM, or storage imports, so Phase 4
// simulation consumes this data without canvas access (FR-NAV-002).
// Canonical schema (05 §5.3, §7.2; 07 §9.1):
//   { id: string, from: string, to: string, points: [[x, y], ...] }
// `from`/`to` reference Layout Object ids. The graph is derived in-memory
// only and never persisted (05 §7.7, §8).

import { generateId } from '../../utils/id.js'
import { MAX_SEGMENT_LENGTH } from '../constants/navigation.js'
import { layoutObjectCenter } from './layoutObject.js'

function isPoint(point) {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    typeof point[0] === 'number' &&
    Number.isFinite(point[0]) &&
    typeof point[1] === 'number' &&
    Number.isFinite(point[1])
  )
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Structural validation (fields/types/points), no layout context needed.
export function validatePathStructure(path) {
  const errors = []
  if (!isRecord(path)) {
    return { valid: false, errors: ['path must be an object'] }
  }
  if (typeof path.id !== 'string' || path.id.length === 0) {
    errors.push('id must be a non-empty string')
  }
  if (typeof path.from !== 'string' || path.from.length === 0) {
    errors.push('from must be a non-empty object id')
  }
  if (typeof path.to !== 'string' || path.to.length === 0) {
    errors.push('to must be a non-empty object id')
  }
  if (!Array.isArray(path.points) || path.points.length < 2) {
    errors.push('points must contain at least 2 coordinates')
  } else if (!path.points.every(isPoint)) {
    errors.push('points must be [x, y] pairs of finite numbers')
  }
  return { valid: errors.length === 0, errors }
}

// Full validation incl. layout references (05 §5.3, §9; 07 §9.3, §17.2).
// `objectIds` = ids of the active layout.
export function validateNavigationPath(path, objectIds = []) {
  const { valid, errors } = validatePathStructure(path)
  if (!valid) {
    return { valid, errors }
  }
  const issues = []
  if (path.from === path.to) {
    issues.push('from and to must reference two different objects')
  }
  if (!objectIds.includes(path.from)) {
    issues.push(`from references missing object "${path.from}"`)
  }
  if (!objectIds.includes(path.to)) {
    issues.push(`to references missing object "${path.to}"`)
  }
  return { valid: issues.length === 0, errors: issues }
}

export function validateNavigation(paths, objectIds = []) {
  const errors = []
  if (!Array.isArray(paths)) {
    return { valid: false, errors: ['navigation data must be an array'] }
  }
  const seen = new Set()
  paths.forEach((path, index) => {
    const result = validateNavigationPath(path, objectIds)
    if (!result.valid) {
      errors.push(`paths[${index}]: ${result.errors.join('; ')}`)
    }
    if (typeof path?.id === 'string') {
      if (seen.has(path.id)) {
        errors.push(`paths[${index}]: duplicate id "${path.id}"`)
      } else {
        seen.add(path.id)
      }
    }
  })
  return { valid: errors.length === 0, errors }
}

// Structural validation without layout context (fields/types/points +
// unique ids). Used by serialization; ref-existence is checked at
// assembly/use time so kept paths survive layout edits (07 §15.3).
export function validateNavigationStructure(paths) {
  const errors = []
  if (!Array.isArray(paths)) {
    return { valid: false, errors: ['navigation data must be an array'] }
  }
  const seen = new Set()
  paths.forEach((path, index) => {
    const result = validatePathStructure(path)
    if (!result.valid) {
      errors.push(`paths[${index}]: ${result.errors.join('; ')}`)
    }
    if (typeof path?.id === 'string') {
      if (seen.has(path.id)) {
        errors.push(`paths[${index}]: duplicate id "${path.id}"`)
      } else {
        seen.add(path.id)
      }
    }
  })
  return { valid: errors.length === 0, errors }
}

// Create a path from editor interaction (FR-PATH-002). Refs are checked
// against the active layout; id is generated (never a Konva id).
export function createNavigationPath({ from, to, points }, objectIds = []) {
  const candidate = { id: generateId('path'), from, to, points: (points ?? []).map(([x, y]) => [x, y]) }
  const { valid, errors } = validateNavigationPath(candidate, objectIds)
  if (!valid) {
    throw new Error(`Invalid navigation path: ${errors.join('; ')}`)
  }
  return candidate
}

// Automatic waypoint generation (Phase 3 refinement): split one segment
// into evenly distributed sub-segments of at most maxLength world units.
// Even split (never 100+100+remainder) keeps geometry stable and editable.
// Pure + deterministic: same input always yields the same points.
// Returns [start, ...interior, end], or null for non-finite coordinates.
export function generateSegmentPoints(start, end, maxLength = MAX_SEGMENT_LENGTH) {
  const [[x1, y1], [x2, y2]] = [start, end]
  if (
    !Number.isFinite(x1) ||
    !Number.isFinite(y1) ||
    !Number.isFinite(x2) ||
    !Number.isFinite(y2) ||
    !Number.isFinite(maxLength) ||
    maxLength <= 0
  ) {
    return null
  }
  const distance = Math.hypot(x2 - x1, y2 - y1)
  const segmentCount = Math.max(1, Math.ceil(distance / maxLength))
  const points = []
  for (let i = 0; i <= segmentCount; i += 1) {
    const t = i / segmentCount
    points.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t])
  }
  return points
}

// Squared distance from point P to segment AB (world coordinates).
function segmentDistanceSquared(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq
  t = Math.min(1, Math.max(0, t))
  const cx = a[0] + t * dx - p[0]
  const cy = a[1] + t * dy - p[1]
  return cx * cx + cy * cy
}

// Index of the segment nearest to (x, y), or -1 for degenerate input.
export function nearestSegmentIndex(points, x, y) {
  if (!Array.isArray(points) || points.length < 2 || !Number.isFinite(x) || !Number.isFinite(y)) {
    return -1
  }
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < points.length - 1; i += 1) {
    const dist = segmentDistanceSquared([x, y], points[i], points[i + 1])
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

// Insert a waypoint on its nearest segment (never appended blindly).
// Returns { points, index } or null for invalid input.
export function insertWaypoint(points, x, y) {
  const segment = nearestSegmentIndex(points, x, y)
  if (segment < 0) {
    return null
  }
  const next = points.map(([px, py]) => [px, py])
  next.splice(segment + 1, 0, [x, y])
  return { points: next, index: segment + 1 }
}

// Remove an interior waypoint. Endpoints are never removable and the
// polyline must keep at least 2 points (validation contract).
// Returns { points, index } or null when removal is not allowed.
export function deleteWaypoint(points, index) {
  if (!Array.isArray(points) || !Number.isInteger(index)) {
    return null
  }
  if (index <= 0 || index >= points.length - 1 || points.length <= 2) {
    return null
  }
  return { points: points.filter((_, i) => i !== index), index }
}

// Assemble the derived in-memory graph (05 §7.7; ALG-VAL-002):
// nodes = layout object ids, edges = structurally valid paths whose
// from/to both exist, with endpoints resolved to current object centers
// (endpoint synchronization). Broken-ref paths are excluded WITHOUT
// failing the whole assembly (AC-036).
export function assembleNavigationGraph(layout, paths) {
  const objects = Array.isArray(layout?.objects) ? layout.objects : []
  const objectIds = objects.map((obj) => obj.id)
  const edges = (Array.isArray(paths) ? paths : []).filter(
    (path) => validateNavigationPath(path, objectIds).valid,
  ).map((path) => ({ from: path.from, to: path.to, points: resolvePathPoints(path, objects) }))
  return { nodes: [...objectIds], edges }
}

// Endpoint synchronization: effective render/use geometry of a path.
// from/to are anchors — endpoints resolve to the CURRENT centers of the
// referenced objects; interior waypoints stay exactly as stored (§4-5).
// Missing refs or non-geometric objects fall back to stored endpoints,
// so legacy/broken data still renders without migration (§9, §19).
// Pure: never mutates the path or objects, never regenerates (§6, §11).
export function resolvePathPoints(path, objects = []) {
  const stored = Array.isArray(path?.points) ? path.points.map(([x, y]) => [x, y]) : []
  if (stored.length === 0) {
    return stored
  }
  const byId = new Map((Array.isArray(objects) ? objects : []).map((obj) => [obj?.id, obj]))
  const centerOf = (id, fallback) => {
    const obj = byId.get(id)
    if (!obj || typeof obj.x !== 'number' || typeof obj.y !== 'number') {
      return fallback
    }
    const [cx, cy] = layoutObjectCenter(obj)
    return Number.isFinite(cx) && Number.isFinite(cy) ? [cx, cy] : fallback
  }
  const resolved = [...stored]
  resolved[0] = centerOf(path.from, stored[0])
  resolved[resolved.length - 1] = centerOf(path.to, stored[stored.length - 1])
  return resolved
}

// Simulation precondition gate (AC-037, Phase 3–4 boundary): true iff at
// least one valid edge exists. No simulation logic lives here.
export function hasValidEdge(graph) {
  return !!graph && Array.isArray(graph.edges) && graph.edges.length > 0
}

// Deterministic JSON for the sibling navigation collection.
// Collection shape {"paths": [...]} is an implementation choice — the docs
// fix the path schema, not the collection envelope (07 §9.2).
export function serializeNavigation(paths) {
  const { valid, errors } = validateNavigationStructure(paths)
  if (!valid) {
    throw new Error(`Cannot serialize invalid navigation: ${errors.join('; ')}`)
  }
  if (paths.length === 0) {
    throw new Error('Cannot serialize empty navigation')
  }
  return JSON.stringify({
    paths: paths.map((path) => ({
      id: path.id,
      from: path.from,
      to: path.to,
      points: path.points.map(([x, y]) => [x, y]),
    })),
  })
}

// Deserialize: parse, then structural validation (ref checks happen against
// the active layout at assembly time, so kept paths survive layout edits).
export function parseNavigationJson(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'malformed', errors: ['navigation JSON is malformed'] }
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.paths)) {
    return { ok: false, reason: 'invalid', errors: ['navigation data must contain a paths array'] }
  }
  const { valid, errors } = validateNavigationStructure(parsed.paths)
  if (!valid) {
    return { ok: false, reason: 'invalid', errors }
  }
  return {
    ok: true,
    paths: parsed.paths.map((path) => ({
      id: path.id,
      from: path.from,
      to: path.to,
      points: path.points.map(([x, y]) => [x, y]),
    })),
  }
}
