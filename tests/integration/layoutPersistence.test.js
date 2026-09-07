import { beforeEach, describe, expect, it } from 'vitest'
import { LAYOUT_STORAGE_KEY } from '../../src/persistence/layoutStorage.js'
import { loadSavedLayout, resetCurrentLayout, saveCurrentLayout } from '../../src/services/layoutService.js'
import { useEditorStore } from '../../src/stores/editorStore.js'
import { useLayoutStore } from '../../src/stores/layoutStore.js'

// Integration through real LocalStorage (jsdom) + real stores:
// Editor -> Layout State -> Validation -> Serialization -> LocalStorage
// -> Load -> Layout State -> (canvas reconstructs reactively).
function resetAll() {
  localStorage.clear()
  useLayoutStore.setState({ layout: { layoutId: 'test-layout', objects: [] } })
  useEditorStore.setState({
    selectedId: null,
    activeTool: 'select',
    scale: 1,
    stageX: 0,
    stageY: 0,
    gridVisible: true,
    snapEnabled: true,
    stageSize: { width: 800, height: 600 },
    toast: null,
  })
}

describe('layout persistence (TC-019, TC-021, TC-023, TC-026)', () => {
  beforeEach(resetAll)

  it('saves canvas-independent JSON and loads it back identically', () => {
    const store = useLayoutStore.getState()
    store.addObject({ type: 'entrance', x: 32, y: 64 })
    store.addObject({ type: 'pharmacy', x: 160, y: 96 })
    const firstId = useLayoutStore.getState().layout.objects[0].id
    useLayoutStore.getState().rotateObject(firstId, 90)
    const before = JSON.stringify(useLayoutStore.getState().layout)

    expect(saveCurrentLayout()).toMatchObject({ ok: true })
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
    expect(typeof raw).toBe('string')
    // Stored data is plain JSON: no Konva nodes, functions, or view state.
    expect(raw).not.toContain('scale')
    expect(raw).not.toContain('stageX')

    resetCurrentLayout()
    expect(useLayoutStore.getState().layout.objects).toHaveLength(0)

    expect(loadSavedLayout()).toMatchObject({ ok: true })
    const after = useLayoutStore.getState().layout
    expect(after.objects).toHaveLength(2)
    expect(JSON.stringify(after)).toBe(before)
    expect(after.objects[0]).toMatchObject({ type: 'entrance', rotation: 90 })
    // Reconstructed objects are independent copies, not shared references.
    expect(after.objects[0]).not.toBe(JSON.parse(before).objects[0])
  })

  it('keeps serialized data synchronized with canvas edits (TC-019)', () => {
    const id = useLayoutStore.getState().addObject({ type: 'exit', x: 0, y: 0 })
    expect(saveCurrentLayout()).toMatchObject({ ok: true })
    useEditorStore.getState().toggleGrid() // raw values for this assertion
    useLayoutStore.getState().moveObject(id, 96, 128)
    expect(saveCurrentLayout()).toMatchObject({ ok: true })
    const saved = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY))
    expect(saved.objects).toHaveLength(1)
    expect(saved.objects[0]).toMatchObject({ id, x: 96, y: 128 })
  })

  it('blocks save when the layout is empty (TC-022)', () => {
    expect(saveCurrentLayout()).toMatchObject({ ok: false, reason: 'empty-or-invalid' })
    expect(localStorage.getItem(LAYOUT_STORAGE_KEY)).toBeNull()
  })
})

describe('load failure paths (TC-072, TC-073)', () => {
  beforeEach(resetAll)

  it('reports missing data without touching state', () => {
    useLayoutStore.getState().addObject({ type: 'toilet', x: 10, y: 10 })
    const before = JSON.stringify(useLayoutStore.getState().layout)
    expect(loadSavedLayout()).toMatchObject({ ok: false, reason: 'missing' })
    expect(JSON.stringify(useLayoutStore.getState().layout)).toBe(before)
  })

  it('rejects malformed JSON without reconstructing', () => {
    useLayoutStore.getState().addObject({ type: 'toilet', x: 10, y: 10 })
    const before = JSON.stringify(useLayoutStore.getState().layout)
    localStorage.setItem(LAYOUT_STORAGE_KEY, '{corrupt')
    expect(loadSavedLayout()).toMatchObject({ ok: false, reason: 'malformed' })
    expect(JSON.stringify(useLayoutStore.getState().layout)).toBe(before)
  })

  it('rejects schema-invalid data without reconstructing', () => {
    useLayoutStore.getState().addObject({ type: 'toilet', x: 10, y: 10 })
    const before = JSON.stringify(useLayoutStore.getState().layout)
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({ layoutId: 'x', objects: [{ id: 'a', type: 'nope' }] }),
    )
    const result = loadSavedLayout()
    expect(result).toMatchObject({ ok: false, reason: 'invalid' })
    expect(JSON.stringify(useLayoutStore.getState().layout)).toBe(before)
  })

  it('loads over existing objects without duplicating (replace, not merge)', () => {
    useLayoutStore.getState().addObject({ type: 'entrance', x: 0, y: 0 })
    expect(saveCurrentLayout()).toMatchObject({ ok: true })
    useLayoutStore.getState().addObject({ type: 'exit', x: 64, y: 64 })
    expect(loadSavedLayout()).toMatchObject({ ok: true })
    const { objects } = useLayoutStore.getState().layout
    expect(objects).toHaveLength(1)
    expect(objects[0].type).toBe('entrance')
  })
})
