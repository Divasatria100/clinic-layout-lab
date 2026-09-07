import { describe, expect, it } from 'vitest'
import {
  assembleNavigationGraph,
  createNavigationPath,
  deleteWaypoint,
  hasValidEdge,
  insertWaypoint,
  nearestSegmentIndex,
  parseNavigationJson,
  serializeNavigation,
  validateNavigation,
  validateNavigationPath,
} from '../../src/domain/models/navigation.js'

const IDS = ['entrance-1', 'reception-1']

function samplePath() {
  return { id: 'path-1', from: 'entrance-1', to: 'reception-1', points: [[100, 500], [150, 500], [200, 400]] }
}

describe('validateNavigationPath', () => {
  it('accepts a complete path with existing refs', () => {
    expect(validateNavigationPath(samplePath(), IDS).valid).toBe(true)
  })

  it('rejects same from/to, missing refs, and short/invalid points', () => {
    const base = samplePath()
    expect(validateNavigationPath({ ...base, to: base.from }, IDS).valid).toBe(false)
    expect(validateNavigationPath({ ...base, from: 'ghost' }, IDS).valid).toBe(false)
    expect(validateNavigationPath({ ...base, to: 'ghost' }, IDS).valid).toBe(false)
    expect(validateNavigationPath({ ...base, points: [[1, 2]] }, IDS).valid).toBe(false)
    expect(validateNavigationPath({ ...base, points: [[1, 'x']] }, IDS).valid).toBe(false)
    expect(validateNavigationPath({ ...base, id: '' }, IDS).valid).toBe(false)
  })

  it('rejects duplicate ids within the set', () => {
    expect(validateNavigation([samplePath(), { ...samplePath(), points: [[0, 0], [1, 1]] }], IDS).valid).toBe(false)
  })
})

describe('createNavigationPath', () => {
  it('creates a path with a generated unique id', () => {
    const a = createNavigationPath({ from: 'entrance-1', to: 'reception-1', points: [[0, 0], [10, 10]] }, IDS)
    const b = createNavigationPath({ from: 'entrance-1', to: 'reception-1', points: [[0, 0], [10, 10]] }, IDS)
    expect(a.id).not.toBe(b.id)
    expect(a).toMatchObject({ from: 'entrance-1', to: 'reception-1' })
  })

  it('throws for same endpoints or insufficient points', () => {
    expect(() => createNavigationPath({ from: 'entrance-1', to: 'entrance-1', points: [[0, 0], [1, 1]] }, IDS)).toThrow()
    expect(() => createNavigationPath({ from: 'entrance-1', to: 'reception-1', points: [[0, 0]] }, IDS)).toThrow()
    expect(() => createNavigationPath({ from: 'ghost', to: 'reception-1', points: [[0, 0], [1, 1]] }, IDS)).toThrow()
  })
})

describe('assembleNavigationGraph (TC-036)', () => {
  it('builds nodes from layout and edges from valid paths', () => {
    const graph = assembleNavigationGraph({ objects: [{ id: 'entrance-1' }, { id: 'reception-1' }] }, [samplePath()])
    expect(graph.nodes).toEqual(['entrance-1', 'reception-1'])
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]).toMatchObject({ from: 'entrance-1', to: 'reception-1' })
  })

  it('excludes broken-ref paths without failing assembly', () => {
    const graph = assembleNavigationGraph({ objects: [{ id: 'entrance-1' }, { id: 'reception-1' }] }, [
      samplePath(),
      { id: 'path-2', from: 'entrance-1', to: 'ghost-room', points: [[0, 0], [5, 5]] },
    ])
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0].id).toBeUndefined()
    expect(graph.edges[0].from).toBe('entrance-1')
  })
})

describe('hasValidEdge (TC-037 gate)', () => {
  it('is true only with at least one valid edge', () => {
    expect(hasValidEdge({ nodes: [], edges: [] })).toBe(false)
    expect(hasValidEdge(null)).toBe(false)
    expect(hasValidEdge({ nodes: ['a'], edges: [{ from: 'a', to: 'b', points: [[0, 0], [1, 1]] }] })).toBe(true)
  })
})

describe('serializeNavigation / parseNavigationJson (TC-032)', () => {
  it('round-trips the canonical schema without loss', () => {
    const json = serializeNavigation([samplePath()])
    const parsed = JSON.parse(json)
    expect(Object.keys(parsed)).toEqual(['paths'])
    expect(Object.keys(parsed.paths[0])).toEqual(['id', 'from', 'to', 'points'])
    expect(parseNavigationJson(json)).toEqual({ ok: true, paths: [samplePath()] })
  })

  it('blocks empty/invalid sets and reports malformed input', () => {
    expect(() => serializeNavigation([])).toThrow()
    expect(parseNavigationJson('{bad')).toMatchObject({ ok: false, reason: 'malformed' })
    expect(parseNavigationJson(JSON.stringify({ paths: [{ id: 'x' }] }))).toMatchObject({ ok: false, reason: 'invalid' })
    expect(parseNavigationJson(JSON.stringify({ nope: [] }))).toMatchObject({ ok: false, reason: 'invalid' })
  })
})

describe('waypoint insert/delete geometry', () => {
  const line = [[0, 0], [100, 0], [100, 100]]

  it('finds the nearest segment', () => {
    expect(nearestSegmentIndex(line, 50, 5)).toBe(0)
    expect(nearestSegmentIndex(line, 105, 50)).toBe(1)
    expect(nearestSegmentIndex([[0, 0]], 0, 0)).toBe(-1)
    expect(nearestSegmentIndex(line, Number.NaN, 0)).toBe(-1)
  })

  it('inserts on the correct segment, never blind-appended', () => {
    expect(insertWaypoint(line, 50, 0)).toEqual({ points: [[0, 0], [50, 0], [100, 0], [100, 100]], index: 1 })
    expect(insertWaypoint(line, 100, 50)).toEqual({ points: [[0, 0], [100, 0], [100, 50], [100, 100]], index: 2 })
    expect(insertWaypoint([[0, 0]], 1, 1)).toBeNull()
    expect(insertWaypoint(line, Number.NaN, 0)).toBeNull()
  })

  it('deletes interior waypoints only', () => {
    expect(deleteWaypoint(line, 1)).toEqual({ points: [[0, 0], [100, 100]], index: 1 })
    expect(deleteWaypoint(line, 0)).toBeNull()
    expect(deleteWaypoint(line, 2)).toBeNull()
    expect(deleteWaypoint([[0, 0], [10, 10]], 1)).toBeNull()
    expect(deleteWaypoint(line, 1.5)).toBeNull()
  })

  it('round-trips multi-waypoint paths through serialization', () => {
    const multi = { id: 'p', from: 'a', to: 'b', points: [[0, 0], [10, 5], [20, 15], [30, 15], [40, 0]] }
    expect(parseNavigationJson(serializeNavigation([multi]))).toEqual({ ok: true, paths: [multi] })
  })
})
