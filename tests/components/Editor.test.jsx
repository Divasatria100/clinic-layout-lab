import { fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EditorApp from '../../src/app/EditorApp.jsx'
import { useEditorStore } from '../../src/stores/editorStore.js'
import { useLayoutStore } from '../../src/stores/layoutStore.js'
import { useNavigationStore } from '../../src/stores/navigationStore.js'

// jsdom has no canvas 2d context, so react-konva primitives are stubbed to
// plain elements. Canvas-specific commit logic is covered by store unit
// tests; these tests verify the editor UI drives the same store.
vi.mock('react-konva', async () => {
  const ReactModule = await import('react')
  const create = ReactModule.createElement
  return {
    Stage: (props) => {
      const { children, onClick, onDblClick, ref } = props
      return create(
        'div',
        { 'data-testid': 'konva-stage', onClick, onDoubleClick: onDblClick, ref },
        children,
      )
    },
    Layer: ({ children, listening }) =>
      create('div', { 'data-layer-listening': String(listening) }, children),
    Group: ({ children, onClick }) => create('div', { onClick }, children),
    Rect: () => null,
    Line: ({ points, name, onClick }) =>
      name === 'nav-path'
        ? create('div', { 'data-testid': 'path-line', 'data-points': JSON.stringify(points), onClick })
        : null,
    Circle: ({ name }) => (name === 'nav-point' ? create('span', { 'data-testid': 'path-point' }) : null),
    Image: () => null,
    Transformer: () => create('div', { 'data-testid': 'transformer' }),
    Text: ({ text }) => create('span', null, text),
  }
})

function resetStores() {
  localStorage.clear()
  useLayoutStore.setState({ layout: { layoutId: 'test-layout', objects: [] } })
  useNavigationStore.setState({ paths: [], selectedPathId: null, draft: null })
  useEditorStore.setState({
    selectedId: null,
    activeTool: 'select',
    mode: 'edit',
    scale: 1,
    stageX: 0,
    stageY: 0,
    gridVisible: true,
    snapEnabled: true,
    stageSize: { width: 800, height: 600 },
    toast: null,
  })
}

describe('EditorApp (Phase 1 UI)', () => {
  beforeEach(() => {
    resetStores()
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('renders the editor layout: header, library, canvas, inspector, status (AC-001)', () => {
    render(<EditorApp />)
    expect(screen.getByRole('heading', { name: 'Clinic Layout Lab' })).toBeInTheDocument()
    expect(screen.getByRole('toolbar', { name: 'Editor tools' })).toBeInTheDocument()
    expect(screen.getByLabelText('Object library')).toBeInTheDocument()
    expect(screen.getByTestId('editor-stage-container')).toBeInTheDocument()
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument()
    expect(screen.getByText('Select an object to see its properties')).toBeInTheDocument()
    expect(screen.getByText('0 objects')).toBeInTheDocument()
    // All 9 specified asset types are offered (08 §4).
    for (const name of ['Entrance', 'Exit', 'Reception', 'Waiting Chair', 'Examination Room', 'Doctor Room', 'Pharmacy', 'Treatment Room', 'Toilet']) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument()
    }
  })

  it('keeps the Transformer layer listening so handles transform instead of panning', () => {
    // Regression: overlay <Layer listening={false}> made Transformer anchors
    // event-dead, so dragging a handle fell through to the draggable Stage
    // and panned the canvas instead of resizing the object.
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Entrance/ }))
    const transformer = screen.getByTestId('transformer')
    const overlay = transformer.closest('[data-layer-listening]')
    expect(overlay).not.toBeNull()
    expect(overlay.getAttribute('data-layer-listening')).not.toBe('false')
  })

  it('adds an object from the library and auto-selects it (AC-002)', () => {
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Reception/ }))
    expect(screen.getByText('1 object')).toBeInTheDocument()
    const inspector = screen.getByLabelText('Inspector')
    expect(within(inspector).getByText('reception')).toBeInTheDocument()
    // Canvas shows the object too (placeholder label while the image loads).
    expect(screen.getAllByText('reception')).toHaveLength(2)
    const objects = useLayoutStore.getState().layout.objects
    expect(objects).toHaveLength(1)
    expect(objects[0]).toMatchObject({ type: 'reception', asset: 'reception.png' })
    expect(useEditorStore.getState().selectedId).toBe(objects[0].id)
  })

  it('selects an object by clicking it on the canvas (AC-003)', () => {
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Entrance/ }))
    fireEvent.click(screen.getByRole('button', { name: /Exit/ }))
    const exitId = useLayoutStore.getState().layout.objects[1].id
    expect(useEditorStore.getState().selectedId).toBe(exitId)
    fireEvent.click(screen.getByText('entrance').parentElement)
    const entranceId = useLayoutStore.getState().layout.objects[0].id
    expect(useEditorStore.getState().selectedId).toBe(entranceId)
    const inspector = screen.getByLabelText('Inspector')
    expect(within(inspector).getByText('entrance')).toBeInTheDocument()
  })

  it('duplicates the selected object with a new id (AC-008)', () => {
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Toilet/ }))
    const originalId = useLayoutStore.getState().layout.objects[0].id
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
    const objects = useLayoutStore.getState().layout.objects
    expect(objects).toHaveLength(2)
    expect(objects[1].id).not.toBe(originalId)
    expect(objects[1].type).toBe('toilet')
    expect(screen.getByText('2 objects')).toBeInTheDocument()
  })

  it('deletes the selected object after confirmation (AC-007)', () => {
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Pharmacy/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(window.confirm).toHaveBeenCalled()
    expect(useLayoutStore.getState().layout.objects).toHaveLength(0)
    expect(screen.getByText('0 objects')).toBeInTheDocument()
    expect(screen.getByText('Select an object to see its properties')).toBeInTheDocument()
  })

  it('disables Duplicate/Delete with no selection (AC-013)', () => {
    render(<EditorApp />)
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('edits object geometry through the inspector (AC-004/005/006)', () => {
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Reception/ }))
    const id = useLayoutStore.getState().layout.objects[0].id
    const inspector = screen.getByLabelText('Inspector')
    fireEvent.change(within(inspector).getByLabelText('Width'), { target: { value: '150' } })
    fireEvent.change(within(inspector).getByLabelText('Rotation (°)'), { target: { value: '45' } })
    expect(useLayoutStore.getState().layout.objects[0]).toMatchObject({
      id,
      width: 150,
      rotation: 45,
    })
  })

  it('toggles grid/snap and zooms without touching objects (AC-009..AC-012)', () => {
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Entrance/ }))
    const before = JSON.stringify(useLayoutStore.getState().layout.objects)

    fireEvent.click(screen.getByRole('button', { name: 'Zoom In' }))
    expect(screen.getByText('Zoom: 110%')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Zoom Out' }))
    expect(screen.getByText('Zoom: 100%')).toBeInTheDocument()

    const snap = screen.getByRole('button', { name: /Snap:/ })
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }))
    expect(snap).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }))
    expect(snap).not.toBeDisabled()

    expect(JSON.stringify(useLayoutStore.getState().layout.objects)).toBe(before)
  })
})

describe('Delete keyboard shortcut', () => {
  beforeEach(() => {
    resetStores()
  })

  function addSelected() {
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Pharmacy/ }))
    return useLayoutStore.getState().layout.objects[0].id
  }

  it('routes keyboard Delete through the confirmation flow', () => {
    window.confirm = vi.fn(() => true)
    addSelected()
    fireEvent.keyDown(document.body, { key: 'Delete' })
    expect(window.confirm).toHaveBeenCalledWith('Delete the selected object?')
  })

  it('keeps the object when confirmation is cancelled', () => {
    window.confirm = vi.fn(() => false)
    const id = addSelected()
    fireEvent.keyDown(document.body, { key: 'Delete' })
    expect(useLayoutStore.getState().layout.objects).toHaveLength(1)
    expect(useEditorStore.getState().selectedId).toBe(id)
  })

  it('deletes the object and clears selection when confirmed', () => {
    window.confirm = vi.fn(() => true)
    addSelected()
    fireEvent.keyDown(document.body, { key: 'Delete' })
    expect(useLayoutStore.getState().layout.objects).toHaveLength(0)
    expect(useEditorStore.getState().selectedId).toBeNull()
  })

  it('does nothing without a selection', () => {
    window.confirm = vi.fn(() => true)
    render(<EditorApp />)
    fireEvent.keyDown(document.body, { key: 'Delete' })
    expect(window.confirm).not.toHaveBeenCalled()
  })

  it('ignores Delete while typing in the Inspector', () => {
    window.confirm = vi.fn(() => true)
    addSelected()
    const widthInput = within(screen.getByLabelText('Inspector')).getByLabelText('Width')
    widthInput.focus()
    fireEvent.keyDown(widthInput, { key: 'Delete' })
    expect(window.confirm).not.toHaveBeenCalled()
    expect(useLayoutStore.getState().layout.objects).toHaveLength(1)
  })
})

describe('Save / Load / Reset layout (TC-020, TC-025, TC-026)', () => {
  beforeEach(() => {
    resetStores()
    localStorage.clear()
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('disables Save and Reset on an empty canvas (TC-022)', () => {
    render(<EditorApp />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset Layout' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Load' })).not.toBeDisabled()
  })

  it('saves with toast feedback and reloads identically after reset (TC-025, TC-026)', () => {
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Entrance/ }))
    fireEvent.click(screen.getByRole('button', { name: /Reception/ }))
    const before = useLayoutStore.getState().layout.objects.map((obj) => ({ ...obj }))

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Layout saved')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reset Layout' }))
    expect(window.confirm).toHaveBeenCalled()
    expect(screen.getByText('0 objects')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    expect(screen.getByText('2 objects')).toBeInTheDocument()
    const after = useLayoutStore.getState().layout.objects
    expect(after).toHaveLength(2)
    expect(after[0]).toMatchObject({ id: before[0].id, type: 'entrance', x: before[0].x, y: before[0].y })
    expect(after[1]).toMatchObject({ id: before[1].id, type: 'reception' })
    // Reconstructed objects behave like Phase 1 objects: selectable.
    fireEvent.click(screen.getByText('entrance').parentElement)
    expect(useEditorStore.getState().selectedId).toBe(before[0].id)
  })

  it('keeps the canvas when reset is cancelled (TC-020)', () => {
    window.confirm = vi.fn(() => false)
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Exit/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset Layout' }))
    expect(useLayoutStore.getState().layout.objects).toHaveLength(1)
    expect(screen.getByText('1 object')).toBeInTheDocument()
  })

  it('reports missing and corrupt data without touching the canvas', () => {
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Toilet/ }))

    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    expect(screen.getByText('No saved layout found')).toBeInTheDocument()
    expect(useLayoutStore.getState().layout.objects).toHaveLength(1)

    localStorage.setItem('clinic-layout-lab:layout', '{corrupt')
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    expect(screen.getByText('Layout data tidak valid')).toBeInTheDocument()
    expect(useLayoutStore.getState().layout.objects).toHaveLength(1)
    expect(useLayoutStore.getState().layout.objects[0].type).toBe('toilet')
  })
})

describe('Path mode (TC-027, TC-028, TC-029)', () => {
  beforeEach(() => {
    resetStores()
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  function addTwoObjects() {
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Entrance/ }))
    fireEvent.click(screen.getByRole('button', { name: /Reception/ }))
  }

  function switchToPath() {
    fireEvent.click(screen.getByRole('button', { name: 'Path' }))
    expect(useEditorStore.getState().mode).toBe('path')
  }

  function drawPath() {
    // Source + destination via canvas object clicks (04 §9).
    fireEvent.click(screen.getByText('entrance').parentElement)
    fireEvent.click(screen.getByText('reception').parentElement)
    // Waypoints via empty-canvas clicks with a stubbed pointer.
    const stage = screen.getByTestId('konva-stage')
    stage.getPointerPosition = () => ({ x: 10, y: 10 })
    fireEvent.click(stage)
    stage.getPointerPosition = () => ({ x: 190, y: 10 })
    fireEvent.click(stage)
    // Finish with Enter (double-click alternative, 04 §9).
    fireEvent.keyDown(document.body, { key: 'Enter' })
    return useNavigationStore.getState().paths[0]
  }

  it('blocks Path mode with fewer than two objects (TC-029)', () => {
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Entrance/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Path' }))
    expect(useEditorStore.getState().mode).toBe('edit')
    expect(screen.getByText('Add at least two objects to create paths')).toBeInTheDocument()
    expect(screen.getByLabelText('Object library')).toBeInTheDocument()
  })

  it('switches panels and creates a path from source/dest/points (TC-027, TC-028)', () => {
    addTwoObjects()
    switchToPath()
    expect(screen.queryByLabelText('Object library')).not.toBeInTheDocument()
    expect(screen.getByRole('toolbar', { name: 'Path tools' })).toBeInTheDocument()
    expect(screen.getByLabelText('Path inspector')).toBeInTheDocument()

    const path = drawPath()
    expect(path).toMatchObject({ points: [[10, 10], [190, 10]] })
    expect(screen.getByTestId('path-line')).toBeInTheDocument()
    expect(screen.getByText('1 path')).toBeInTheDocument()
    const inspector = screen.getByLabelText('Path inspector')
    expect(within(inspector).getByText('Entrance → Reception')).toBeInTheDocument()
  })

  it('rejects same source and destination with feedback', () => {
    addTwoObjects()
    switchToPath()
    fireEvent.click(screen.getByText('entrance').parentElement)
    fireEvent.click(screen.getByText('entrance').parentElement)
    expect(screen.getByText('Select two different objects to create a path')).toBeInTheDocument()
    expect(useNavigationStore.getState().paths).toHaveLength(0)
  })

  it('selects and deletes a path with confirmation (TC-031)', () => {
    addTwoObjects()
    switchToPath()
    drawPath()
    const id = useNavigationStore.getState().paths[0].id
    useNavigationStore.getState().deselectPath()
    fireEvent.click(screen.getByTestId('path-line'))
    expect(useNavigationStore.getState().selectedPathId).toBe(id)
    fireEvent.click(within(screen.getByRole('toolbar', { name: 'Path tools' })).getByRole('button', { name: 'Delete Path' }))
    expect(window.confirm).toHaveBeenCalled()
    expect(useNavigationStore.getState().paths).toHaveLength(0)
    expect(screen.getByText('0 paths')).toBeInTheDocument()
  })

  it('saves and reloads navigation identically (TC-032, TC-033)', () => {
    addTwoObjects()
    switchToPath()
    const created = drawPath()
    const pathToolbar = within(screen.getByRole('toolbar', { name: 'Path tools' }))
    fireEvent.click(pathToolbar.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Navigation saved')).toBeInTheDocument()
    fireEvent.click(pathToolbar.getByRole('button', { name: 'Delete Path' }))
    expect(useNavigationStore.getState().paths).toHaveLength(0)
    fireEvent.click(pathToolbar.getByRole('button', { name: 'Load' }))
    const { paths } = useNavigationStore.getState()
    expect(paths).toHaveLength(1)
    expect(paths[0]).toEqual(created)
    expect(screen.getByTestId('path-line')).toBeInTheDocument()
  })

  it('does not delete the selected path on keyboard Delete (no double action)', () => {
    addTwoObjects()
    switchToPath()
    drawPath()
    fireEvent.keyDown(document.body, { key: 'Delete' })
    expect(window.confirm).not.toHaveBeenCalled()
    expect(useNavigationStore.getState().paths).toHaveLength(1)
  })

  it('returns to Edit mode with object editing intact', () => {
    addTwoObjects()
    switchToPath()
    drawPath()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(useEditorStore.getState().mode).toBe('edit')
    expect(screen.getByLabelText('Object library')).toBeInTheDocument()
    fireEvent.click(screen.getByText('entrance').parentElement)
    expect(useEditorStore.getState().selectedId).toBe(
      useLayoutStore.getState().layout.objects[0].id,
    )
  })
})
