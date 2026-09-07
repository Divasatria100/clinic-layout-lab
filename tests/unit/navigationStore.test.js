import { beforeEach, describe, expect, it } from 'vitest'
import { useLayoutStore } from '../../src/stores/layoutStore.js'
import { useNavigationStore } from '../../src/stores/navigationStore.js'

function resetAll() {
  useLayoutStore.setState({ layout: { layoutId: 'test-layout', objects: [] } })
  useNavigationStore.setState({ paths: [], selectedPathId: null, draft: null })
}

function addTwoObjects() {
  const store = useLayoutStore.getState()
  const a = store.addObject({ type: 'entrance', x: 0, y: 0 })
  const b = store.addObject({ type: 'reception', x: 200, y: 0 })
  return [a, b]
}

describe('navigationStore draft flow (TC-027, TC-028)', () => {
  beforeEach(resetAll)

  it('picks source then destination, draws points, and finishes a path', () => {
    const [a, b] = addTwoObjects()
    const nav = () => useNavigationStore.getState()
    expect(nav().pickSourceObject(a)).toMatchObject({ ok: true })
    expect(nav().draft).toMatchObject({ sourceId: a, phase: 'dest' })
    expect(nav().pickDestObject(b)).toMatchObject({ ok: true })
    expect(nav().addDraftPoint(10, 10)).toMatchObject({ ok: true })
    expect(nav().addDraftPoint(190, 10)).toMatchObject({ ok: true })
    const finished = nav().finishDraft()
    expect(finished.ok).toBe(true)
    expect(nav().paths).toHaveLength(1)
    expect(nav().paths[0]).toMatchObject({ from: a, to: b, points: [[10, 10], [190, 10]] })
    expect(nav().selectedPathId).toBe(finished.id)
    expect(nav().draft).toBeNull()
  })

  it('rejects same source/destination and too-few-points completion', () => {
    const [a, b] = addTwoObjects()
    const nav = () => useNavigationStore.getState()
    nav().pickSourceObject(a)
    expect(nav().pickDestObject(a)).toMatchObject({ ok: false, reason: 'same-object' })
    expect(nav().draft.phase).toBe('dest')
    nav().pickDestObject(b)
    expect(nav().finishDraft()).toMatchObject({ ok: false, reason: 'too-few-points' })
    nav().addDraftPoint(5, 5)
    expect(nav().finishDraft()).toMatchObject({ ok: false, reason: 'too-few-points' })
    expect(nav().paths).toHaveLength(0)
  })

  it('cancels drafts without creating paths', () => {
    const [a] = addTwoObjects()
    const nav = () => useNavigationStore.getState()
    nav().pickSourceObject(a)
    nav().cancelDraft()
    expect(nav().draft).toBeNull()
    expect(nav().paths).toHaveLength(0)
  })
})

describe('navigationStore edit/delete (TC-030, TC-031)', () => {
  beforeEach(resetAll)

  it('updates point geometry and deletes with selection cleanup', () => {
    const [a, b] = addTwoObjects()
    const nav = () => useNavigationStore.getState()
    nav().pickSourceObject(a)
    nav().pickDestObject(b)
    nav().addDraftPoint(0, 0)
    nav().addDraftPoint(50, 50)
    const { id } = nav().finishDraft()
    nav().updatePathPoint(id, 1, 60, 70)
    expect(useNavigationStore.getState().paths[0].points).toEqual([[0, 0], [60, 70]])
    // Invalid point edits are ignored.
    nav().updatePathPoint(id, 1, Number.NaN, 70)
    expect(useNavigationStore.getState().paths[0].points).toEqual([[0, 0], [60, 70]])
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
