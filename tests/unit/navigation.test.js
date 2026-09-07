import { describe, expect, it } from 'vitest'
import { MAX_SEGMENT_LENGTH } from '../../src/domain/constants/navigation.js'
import {
  assembleNavigationGraph,
  createNavigationPath,
  deleteWaypoint,
  generateSegmentPoints,
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

describe('generateSegmentPoints', () => {
  it('uses MAX_SEGMENT_LENGTH = 100 world units', () => {
    expect(MAX_SEGMENT_LENGTH).toBe(100)
  })

  it('adds no waypoint below the threshold (80)', () => {
    expect(generateSegmentPoints([0, 0], [80, 0])).toEqual([[0, 0], [80, 0]])
  })

  it('adds no waypoint at the exact threshold (100)', () => {
    expect(generateSegmentPoints([0, 0], [100, 0])).toEqual([[0, 0], [100, 0]])
  })

  it('adds one waypoint slightly above threshold (101)', () => {
    expect(generateSegmentPoints([0, 0], [101, 0])).toEqual([[0, 0], [50.5, 0], [101, 0]])
  })

  it('splits 250 into 3 even segments (2 waypoints)', () => {
    const points = generateSegmentPoints([0, 0], [250, 0])
    expect(points).toHaveLength(4)
    expect(points[0]).toEqual([0, 0])
    expect(points[3]).toEqual([250, 0])
    expect(points[1][0]).toBeCloseTo(250 / 3, 10)
    expect(points[2][0]).toBeCloseTo((2 * 250) / 3, 10)
  })

  it('splits 350 into 4 even segments (3 waypoints)', () => {
    expect(generateSegmentPoints([100, 100], [450, 100])).toEqual([
      [100, 100],
      [187.5, 100],
      [275, 100],
      [362.5, 100],
      [450, 100],
    ])
  })

  it('interpolates horizontal, vertical, and diagonal lines', () => {
    const horizontal = generateSegmentPoints([0, 50], [250, 50])
    expect(horizontal.every(([, y]) => y === 50)).toBe(true)
    expect(horizontal.map(([x]) => x)).toEqual([0, 250 / 3, (2 * 250) / 3, 250])
    const vertical = generateSegmentPoints([50, 0], [50, 250])
    expect(vertical.every(([x]) => x === 50)).toBe(true)
    expect(vertical.map(([, y]) => y)).toEqual([0, 250 / 3, (2 * 250) / 3, 250])
    const diagonal = generateSegmentPoints([0, 0], [90, 120])
    // distance 150 -> 1 waypoint at midpoint.
    expect(diagonal).toEqual([[0, 0], [45, 60], [90, 120]])
  })

  it('is directionally consistent for A->B vs B->A', () => {
    const round = (points) => points.map(([x, y]) => [Number(x.toFixed(10)), Number(y.toFixed(10))])
    const forward = generateSegmentPoints([0, 0], [250, 0])
    const backward = generateSegmentPoints([250, 0], [0, 0])
    expect(round(backward)).toEqual(round([...forward].reverse()))
  })

  it('is deterministic and defensive', () => {
    const a = generateSegmentPoints([10, 20], [300, 400])
    const b = generateSegmentPoints([10, 20], [300, 400])
    expect(a).toEqual(b)
    expect(generateSegmentPoints([5, 5], [5, 5])).toEqual([[5, 5], [5, 5]])
    expect(generateSegmentPoints([[0, 0]], [1, 1])).toBeNull()
    expect(generateSegmentPoints([Number.NaN, 0], [1, 1])).toBeNull()
    expect(generateSegmentPoints([0, 0], [Infinity, 0])).toBeNull()
  })
})
