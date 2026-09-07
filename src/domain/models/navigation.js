// Navigation Path domain (Phase 3).
//
// Pure functions — no React, Konva, DOM, or storage imports, so Phase 4
// simulation consumes this data without canvas access (FR-NAV-002).
// Canonical schema (05 §5.3, §7.2; 07 §9.1):
//   { id: string, from: string, to: string, points: [[x, y], ...] }
// `from`/`to` reference Layout Object ids. The graph is derived in-memory
// only and never persisted (05 §7.7, §8).

import { generateId } from '../../utils/id.js'

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

// Assemble the derived in-memory graph (05 §7.7; ALG-VAL-002):
// nodes = layout object ids, edges = structurally valid paths whose
// from/to both exist. Broken-ref paths are excluded WITHOUT failing
// the whole assembly (AC-036).
export function assembleNavigationGraph(layout, paths) {
  const objectIds = Array.isArray(layout?.objects) ? layout.objects.map((obj) => obj.id) : []
  const edges = (Array.isArray(paths) ? paths : []).filter(
    (path) => validateNavigationPath(path, objectIds).valid,
  ).map((path) => ({ from: path.from, to: path.to, points: path.points.map(([x, y]) => [x, y]) }))
  return { nodes: [...objectIds], edges }
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
