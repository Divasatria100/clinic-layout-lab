import { beforeEach, describe, expect, it } from 'vitest'
import { GRID_SIZE } from '../../src/domain/constants/editor.js'
import { clampScale, panViewportBy, zoomAtPoint } from '../../src/domain/models/viewport.js'
import { useEditorStore } from '../../src/stores/editorStore.js'
import { useLayoutStore } from '../../src/stores/layoutStore.js'

function resetStores() {
  useLayoutStore.setState({ layout: { layoutId: 'test-layout', objects: [] } })
  useEditorStore.setState({
    selectedId: null,
    activeTool: 'select',
    scale: 1,
    stageX: 0,
    stageY: 0,
    gridVisible: true,
    snapEnabled: true,
  })
}

describe('layoutStore (AC-002..AC-008, AC-013..AC-016)', () => {
  beforeEach(resetStores)

  it('adds an object with unique id/type/asset and auto-selects it', () => {
    const id = useLayoutStore.getState().addObject({ type: 'entrance', x: 10, y: 20 })
    const { objects } = useLayoutStore.getState().layout
    expect(objects).toHaveLength(1)
    expect(objects[0]).toMatchObject({ id, type: 'entrance', asset: 'entrance.png', x: 10, y: 20 })
    expect(useEditorStore.getState().selectedId).toBe(id)
  })

  it('selects and deselects without touching objects (AC-003, AC-013)', () => {
    expect(useEditorStore.getState().selectedId).toBeNull()
    const id = useLayoutStore.getState().addObject({ type: 'exit' })
    useEditorStore.getState().deselect()
    expect(useEditorStore.getState().selectedId).toBeNull()
    expect(useLayoutStore.getState().layout.objects).toHaveLength(1)
    useEditorStore.getState().select(id)
    expect(useEditorStore.getState().selectedId).toBe(id)
  })

  it('moves with snap when grid is on, raw when grid is off (AC-004, AC-012)', () => {
    const id = useLayoutStore.getState().addObject({ type: 'reception', x: 0, y: 0 })
    useLayoutStore.getState().moveObject(id, 35, 50)
    expect(useLayoutStore.getState().layout.objects[0]).toMatchObject({ x: 32, y: 64 })
    useEditorStore.getState().toggleGrid()
    useLayoutStore.getState().moveObject(id, 35, 50)
    expect(useLayoutStore.getState().layout.objects[0]).toMatchObject({ x: 35, y: 50 })
  })

  it('resizes and rotates consistently (AC-005, AC-006)', () => {
    const id = useLayoutStore.getState().addObject({ type: 'reception', x: 0, y: 0 })
    useEditorStore.getState().toggleGrid() // raw values for this assertion
    useLayoutStore.getState().resizeObject(id, 150, 90)
    useLayoutStore.getState().rotateObject(id, 45)
    expect(useLayoutStore.getState().layout.objects[0]).toMatchObject({
      width: 150,
      height: 90,
      rotation: 45,
    })
  })

  it('rejects invalid sizes, keeping the last valid value', () => {
    const id = useLayoutStore.getState().addObject({ type: 'reception' })
    useLayoutStore.getState().resizeObject(id, 0, -10)
    expect(useLayoutStore.getState().layout.objects[0]).toMatchObject({ width: 100, height: 80 })
  })

  it('duplicates with a new id and deletes cleanly (AC-007, AC-008)', () => {
    const id = useLayoutStore.getState().addObject({ type: 'toilet', x: GRID_SIZE, y: GRID_SIZE })
    const copyId = useLayoutStore.getState().duplicateObject(id)
    expect(copyId).not.toBe(id)
    expect(useLayoutStore.getState().layout.objects).toHaveLength(2)
    expect(useEditorStore.getState().selectedId).toBe(copyId)

    useLayoutStore.getState().deleteObject(id)
    const { objects } = useLayoutStore.getState().layout
    expect(objects).toHaveLength(1)
    expect(objects[0].id).toBe(copyId)
    // Deleting the selected object clears selection; deleting another keeps it.
    useLayoutStore.getState().deleteObject(copyId)
    expect(useLayoutStore.getState().layout.objects).toHaveLength(0)
    expect(useEditorStore.getState().selectedId).toBeNull()
  })

  it('ignores duplicate/delete of unknown ids', () => {
    expect(useLayoutStore.getState().duplicateObject('missing')).toBeNull()
    useLayoutStore.getState().deleteObject('missing')
    expect(useLayoutStore.getState().layout.objects).toHaveLength(0)
  })
})

describe('viewport math (AC-009, AC-010)', () => {
  it('zooms around a point without mutating objects', () => {
    resetStores()
    const id = useLayoutStore.getState().addObject({ type: 'entrance', x: 100, y: 100 })
    const before = JSON.stringify(useLayoutStore.getState().layout.objects)
    const next = zoomAtPoint({ scale: 1, x: 0, y: 0 }, { x: 100, y: 100 }, 1.5)
    expect(next.scale).toBeCloseTo(1.5)
    expect(JSON.stringify(useLayoutStore.getState().layout.objects)).toBe(before)
    expect(useLayoutStore.getState().layout.objects[0].id).toBe(id)
  })

  it('clamps scale and pans by delta', () => {
    expect(clampScale(99).valueOf()).toBeLessThanOrEqual(3)
    expect(clampScale(0.001)).toBeGreaterThanOrEqual(0.25)
    expect(panViewportBy({ scale: 1, x: 0, y: 0 }, 10, -5)).toMatchObject({ x: 10, y: -5 })
  })
})
