import { beforeEach, describe, expect, it } from 'vitest'
import { NAVIGATION_STORAGE_KEY } from '../../src/persistence/navigationStorage.js'
import { loadSavedNavigation, saveCurrentNavigation } from '../../src/services/navigationService.js'
import { useEditorStore } from '../../src/stores/editorStore.js'
import { useLayoutStore } from '../../src/stores/layoutStore.js'
import { useNavigationStore } from '../../src/stores/navigationStore.js'

// Integration through real LocalStorage (jsdom): create navigation ->
// save -> reset/load -> reconstruct identically (TC-032, TC-033).
function resetAll() {
  localStorage.clear()
  useLayoutStore.setState({ layout: { layoutId: 'test-layout', objects: [] } })
  useNavigationStore.setState({ paths: [], selectedPathId: null, pendingSourceId: null, editingPathId: null })
  useEditorStore.setState({ toast: null })
}

function buildPath() {
  const store = useLayoutStore.getState()
  const a = store.addObject({ type: 'entrance', x: 0, y: 0 })
  const b = store.addObject({ type: 'reception', x: 400, y: 300 })
  const nav = useNavigationStore.getState()
  nav.pickSourceObject(a)
  const { id } = nav.pickDestObject(b)
  // Shape a multi-waypoint route around an imaginary obstacle.
  const live = () => useNavigationStore.getState()
  live().updatePathPoint(id, 1, 200, 40)
  live().insertPathPoint(id, 200, 150)
  live().insertPathPoint(id, 320, 200)
  live().insertPathPoint(id, 380, 260)
  return id
}

describe('navigation persistence', () => {
  beforeEach(resetAll)

  it('saves structured JSON and reconstructs the identical path', () => {
    const id = buildPath()
    const before = JSON.stringify(useNavigationStore.getState().paths)
    expect(saveCurrentNavigation()).toMatchObject({ ok: true })
    const raw = localStorage.getItem(NAVIGATION_STORAGE_KEY)
    expect(JSON.parse(raw)).toEqual({
      paths: [useNavigationStore.getState().paths[0]],
    })

    useNavigationStore.getState().clearAll()
    expect(loadSavedNavigation()).toMatchObject({ ok: true })
    const { paths } = useNavigationStore.getState()
    expect(paths).toHaveLength(1)
    // Edited multi-waypoint geometry persists; from/to identical; same id.
    // (~508 units auto-split into 6 segments, +1 moved +3 inserted = 10.)
    expect(paths[0].points).toHaveLength(10)
    expect(paths[0]).toMatchObject({ id })
    expect(paths[0].from).toBe(useLayoutStore.getState().layout.objects[0].id)
    expect(paths[0].to).toBe(useLayoutStore.getState().layout.objects[1].id)
    expect(JSON.stringify(paths)).toBe(before)
  })

  it('blocks save when no paths exist', () => {
    expect(saveCurrentNavigation()).toMatchObject({ ok: false, reason: 'empty-or-invalid' })
    expect(localStorage.getItem(NAVIGATION_STORAGE_KEY)).toBeNull()
  })

  it('rejects missing and corrupt data without touching state', () => {
    buildPath()
    const before = JSON.stringify(useNavigationStore.getState().paths)
    expect(loadSavedNavigation()).toMatchObject({ ok: false, reason: 'missing' })
    localStorage.setItem(NAVIGATION_STORAGE_KEY, '{corrupt')
    expect(loadSavedNavigation()).toMatchObject({ ok: false, reason: 'malformed' })
    localStorage.setItem(NAVIGATION_STORAGE_KEY, JSON.stringify({ paths: [{ id: 'x' }] }))
    expect(loadSavedNavigation()).toMatchObject({ ok: false, reason: 'invalid' })
    expect(JSON.stringify(useNavigationStore.getState().paths)).toBe(before)
  })

  it('loads over existing paths without duplicating', () => {
    buildPath()
    expect(saveCurrentNavigation()).toMatchObject({ ok: true })
    buildPath()
    expect(useNavigationStore.getState().paths).toHaveLength(2)
    expect(loadSavedNavigation()).toMatchObject({ ok: true })
    expect(useNavigationStore.getState().paths).toHaveLength(1)
  })

  it('leaves pre-refinement paths untouched (no silent migration)', () => {
    const legacy = { id: 'legacy-1', from: 'a', to: 'b', points: [[0, 0], [500, 0]] }
    localStorage.setItem(NAVIGATION_STORAGE_KEY, JSON.stringify({ paths: [legacy] }))
    expect(loadSavedNavigation()).toMatchObject({ ok: true })
    expect(useNavigationStore.getState().paths).toEqual([legacy])
  })
})
