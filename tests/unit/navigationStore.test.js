import { beforeEach, describe, expect, it } from 'vitest'
import { useLayoutStore } from '../../src/stores/layoutStore.js'
import { useNavigationStore } from '../../src/stores/navigationStore.js'

function resetAll() {
  useLayoutStore.setState({ layout: { layoutId: 'test-layout', objects: [] } })
  useNavigationStore.setState({ paths: [], selectedPathId: null, pendingSourceId: null, editingPathId: null })
}

function addTwoObjects() {
  const store = useLayoutStore.getState()
  const a = store.addObject({ type: 'entrance', x: 0, y: 0 })
  const b = store.addObject({ type: 'reception', x: 200, y: 0 })
  return [a, b]
}

describe('navigationStore auto-create flow (TC-027, TC-028)', () => {
  beforeEach(resetAll)

  it('creates a path immediately on destination click, with center geometry', () => {
    const [a, b] = addTwoObjects()
    const nav = () => useNavigationStore.getState()
    expect(nav().pickSourceObject(a)).toMatchObject({ ok: true })
    expect(nav().pendingSourceId).toBe(a)
    expect(nav().paths).toHaveLength(0)

    // No canvas click needed: destination click creates the path.
    const created = nav().pickDestObject(b)
    expect(created.ok).toBe(true)
    expect(nav().paths).toHaveLength(1)
    // Initial geometry connects object centers with a middle waypoint:
    // entrance (0,0,80x80) -> center (40,40); reception (200,0,100x80) -> (250,40).
    expect(nav().paths[0]).toMatchObject({
      id: created.id,
      from: a,
      to: b,
      points: [[40, 40], [145, 40], [250, 40]],
    })
    // New path is immediately selected, pending state cleared.
    expect(nav().selectedPathId).toBe(created.id)
    expect(nav().pendingSourceId).toBeNull()
  })

  it('generates a unique id per path', () => {
    const [a, b] = addTwoObjects()
    const nav = () => useNavigationStore.getState()
    nav().pickSourceObject(a)
    const first = nav().pickDestObject(b).id
    nav().pickSourceObject(a)
    const second = nav().pickDestObject(b).id
    expect(first).not.toBe(second)
  })

  it('rejects same source/destination and unknown objects', () => {
    const [a] = addTwoObjects()
    const nav = () => useNavigationStore.getState()
    nav().pickSourceObject(a)
    expect(nav().pickDestObject(a)).toMatchObject({ ok: false, reason: 'same-object' })
    expect(nav().paths).toHaveLength(0)
    expect(nav().pickDestObject('ghost')).toMatchObject({ ok: false, reason: 'unknown-object' })
    expect(nav().pickSourceObject('ghost')).toMatchObject({ ok: false, reason: 'unknown-object' })
  })

  it('cancels pending source explicitly without creating paths', () => {
    const [a, b] = addTwoObjects()
    const nav = () => useNavigationStore.getState()
    nav().pickSourceObject(a)
    nav().clearPendingSource()
    expect(nav().pendingSourceId).toBeNull()
    expect(nav().pickDestObject(b)).toMatchObject({ ok: false, reason: 'no-source' })
    expect(nav().paths).toHaveLength(0)
  })
})

describe('navigationStore edit/delete (TC-030, TC-031)', () => {
  beforeEach(resetAll)

  it('updates waypoint geometry without touching from/to', () => {
    const [a, b] = addTwoObjects()
    const nav = () => useNavigationStore.getState()
    nav().pickSourceObject(a)
    const { id } = nav().pickDestObject(b)
    expect(useNavigationStore.getState().paths[0].points).toHaveLength(3)
    // Auto-created paths enter edit mode immediately; leaving it blocks edits.
    expect(useNavigationStore.getState().editingPathId).toBe(id)
    nav().stopEditing()
    nav().updatePathPoint(id, 1, 60, 70)
    expect(useNavigationStore.getState().paths[0].points[1]).not.toEqual([60, 70])
    nav().startEditing(id)
    nav().updatePathPoint(id, 1, 60, 70)
    const updated = useNavigationStore.getState().paths[0]
    expect(updated.points).toEqual([updated.points[0], [60, 70], updated.points[2]])
    expect(updated.from).toBe(a)
    expect(updated.to).toBe(b)
    // Invalid point edits are ignored; path stays valid.
    nav().updatePathPoint(id, 1, Number.NaN, 70)
    expect(useNavigationStore.getState().paths[0].points[1]).toEqual([60, 70])
    nav().deletePath(id)
    expect(useNavigationStore.getState().paths).toHaveLength(0)
    expect(useNavigationStore.getState().selectedPathId).toBeNull()
  })

  it('replaces wholesale on load without duplicating', () => {
    addTwoObjects()
    const nav = () => useNavigationStore.getState()
    expect(nav().replaceAll([{ id: 'p1', from: 'x', to: 'y', points: [[0, 0], [1, 1]] }])).toBe(true)
    expect(nav().replaceAll([{ id: 'p1', from: 'x', to: 'y', points: [[0, 0], [1, 1]] }])).toBe(true)
    expect(useNavigationStore.getState().paths).toHaveLength(1)
    expect(nav().replaceAll([{ id: 'bad' }])).toBe(false)
    expect(useNavigationStore.getState().paths).toHaveLength(1)
  })
})

describe('navigationStore waypoint insert/delete', () => {
  beforeEach(resetAll)

  function createPath() {
    const [a, b] = addTwoObjects()
    const nav = () => useNavigationStore.getState()
    nav().pickSourceObject(a)
    return nav().pickDestObject(b).id
  }

  it('inserts waypoints on the nearest segment, never blind-appended', () => {
    const id = createPath() // [(40,40),(145,40),(250,40)], editing active
    const nav = () => useNavigationStore.getState()
    // Click near the second segment -> inserted between index 1 and 2.
    expect(nav().insertPathPoint(id, 200, 40)).toMatchObject({ ok: true, index: 2 })
    expect(useNavigationStore.getState().paths[0].points).toEqual([
      [40, 40],
      [145, 40],
      [200, 40],
      [250, 40],
    ])
    // Click near the first segment -> inserted at index 1.
    expect(nav().insertPathPoint(id, 60, 40)).toMatchObject({ ok: true, index: 1 })
    expect(useNavigationStore.getState().paths[0].points).toEqual([
      [40, 40],
      [60, 40],
      [145, 40],
      [200, 40],
      [250, 40],
    ])
  })

  it('blocks insert/delete outside edit mode and for unknown paths', () => {
    const id = createPath()
    const nav = () => useNavigationStore.getState()
    nav().stopEditing()
    expect(nav().insertPathPoint(id, 200, 40)).toMatchObject({ ok: false, reason: 'not-editing' })
    expect(nav().deletePathPoint(id, 1)).toMatchObject({ ok: false, reason: 'not-editing' })
    expect(nav().insertPathPoint('ghost', 0, 0)).toMatchObject({ ok: false, reason: 'unknown-path' })
    nav().startEditing(id)
    expect(nav().insertPathPoint('ghost', 0, 0)).toMatchObject({ ok: false, reason: 'unknown-path' })
  })

  it('deletes interior waypoints only, keeping endpoints and validity', () => {
    const id = createPath()
    const nav = () => useNavigationStore.getState()
    nav().insertPathPoint(id, 200, 40)
    // Endpoints are not removable.
    expect(nav().deletePathPoint(id, 0)).toMatchObject({ ok: false, reason: 'not-allowed' })
    expect(nav().deletePathPoint(id, 3)).toMatchObject({ ok: false, reason: 'not-allowed' })
    expect(nav().deletePathPoint(id, 1)).toMatchObject({ ok: true })
    expect(useNavigationStore.getState().paths[0].points).toEqual([[40, 40], [200, 40], [250, 40]])
    // Deleting down to 2 points is fine; below that is blocked.
    expect(nav().deletePathPoint(id, 1)).toMatchObject({ ok: true })
    expect(useNavigationStore.getState().paths[0].points).toEqual([[40, 40], [250, 40]])
    expect(nav().deletePathPoint(id, 1)).toMatchObject({ ok: false, reason: 'not-allowed' })
  })
})
