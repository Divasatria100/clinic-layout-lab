import { act, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EditorApp from '../../src/app/EditorApp.jsx'
import { useEditorStore } from '../../src/stores/editorStore.js'
import { useLayoutStore } from '../../src/stores/layoutStore.js'
import { useMovementStore } from '../../src/stores/movementStore.js'
import { useNavigationStore } from '../../src/stores/navigationStore.js'
import { useSimulationStore } from '../../src/stores/simulationStore.js'

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
    Line: ({ points, name, onClick, onDblClick }) =>
      name === 'nav-path'
        ? create('div', { 'data-testid': 'path-line', 'data-points': JSON.stringify(points), onClick, onDoubleClick: onDblClick })
        : null,
    Circle: ({ name, x, y, onDblClick }) => {
      if (name === 'nav-point') {
        return create('span', { 'data-testid': 'path-point', onDoubleClick: onDblClick })
      }
      if (name === 'sim-agent') {
        return create('span', { 'data-testid': 'sim-agent', 'data-x': x, 'data-y': y })
      }
      return null
    },
    Image: () => null,
    Transformer: () => create('div', { 'data-testid': 'transformer' }),
    Text: ({ text }) => create('span', null, text),
  }
})

function resetStores() {
  localStorage.clear()
  useLayoutStore.setState({ layout: { layoutId: 'test-layout', objects: [] } })
  useNavigationStore.setState({ paths: [], selectedPathId: null, pendingSourceId: null, editingPathId: null })
  useSimulationStore.setState({ session: null, agent: null })
  useMovementStore.setState({ records: [] })
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

  // Spread objects apart through the Inspector (UI-driven) for a 210-unit
  // span: entrance center (240,340), reception center (450,340).
  function spreadObjects() {
    addTwoObjects()
    fireEvent.click(screen.getByText('entrance').parentElement)
    const inspector = screen.getByLabelText('Inspector')
    fireEvent.change(within(inspector).getByLabelText('X'), { target: { value: '200' } })
  }

  function switchToPath() {
    fireEvent.click(screen.getByRole('button', { name: 'Path' }))
    expect(useEditorStore.getState().mode).toBe('path')
  }

  function clickPath() {
    // Source + destination clicks create the path immediately —
    // no canvas click, no Enter, no manual endpoint work.
    fireEvent.click(screen.getByText('entrance').parentElement)
    fireEvent.click(screen.getByText('reception').parentElement)
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
    spreadObjects()
    switchToPath()
    expect(screen.queryByLabelText('Object library')).not.toBeInTheDocument()
    expect(screen.getByRole('toolbar', { name: 'Path tools' })).toBeInTheDocument()
    expect(screen.getByLabelText('Path inspector')).toBeInTheDocument()

    const [entrance, reception] = useLayoutStore.getState().layout.objects
    const path = clickPath()
    // from/to bound immediately; 210 units -> 3 even segments, 2 waypoints.
    expect(path).toMatchObject({ from: entrance.id, to: reception.id })
    expect(path.points).toEqual([[240, 340], [310, 340], [380, 340], [450, 340]])
    // Path appears selected with editable interior waypoints, no canvas click.
    expect(screen.getByTestId('path-line')).toBeInTheDocument()
    expect(screen.getAllByTestId('path-point')).toHaveLength(2)
    expect(useNavigationStore.getState().selectedPathId).toBe(path.id)
    expect(screen.getByText('1 path')).toBeInTheDocument()
    const inspector = screen.getByLabelText('Path inspector')
    expect(within(inspector).getByText('Entrance → Reception')).toBeInTheDocument()
  })

  it('creates short paths without unnecessary waypoints', () => {
    addTwoObjects()
    switchToPath()
    const path = clickPath()
    // Overlapping centers (~10 units apart): plain segment, no waypoint.
    expect(path.points).toHaveLength(2)
    expect(screen.queryByTestId('path-point')).not.toBeInTheDocument()
    expect(screen.getByTestId('path-line')).toBeInTheDocument()
  })

  it('rejects same source and destination with feedback', () => {
    addTwoObjects()
    switchToPath()
    fireEvent.click(screen.getByText('entrance').parentElement)
    fireEvent.click(screen.getByText('entrance').parentElement)
    expect(screen.getByText('Select two different objects to create a path')).toBeInTheDocument()
    expect(useNavigationStore.getState().paths).toHaveLength(0)
  })

  it('cancels a pending source via empty-canvas click', () => {
    addTwoObjects()
    switchToPath()
    fireEvent.click(screen.getByText('entrance').parentElement)
    expect(useNavigationStore.getState().pendingSourceId).not.toBeNull()
    fireEvent.click(screen.getByTestId('konva-stage'))
    expect(useNavigationStore.getState().pendingSourceId).toBeNull()
    expect(useNavigationStore.getState().paths).toHaveLength(0)
  })

  it('toggles waypoint handles with Edit Path', () => {
    spreadObjects()
    switchToPath()
    clickPath()
    // Auto-created paths enter edit mode: interior handles visible.
    expect(screen.getAllByTestId('path-point')).toHaveLength(2)
    const toolbar = within(screen.getByRole('toolbar', { name: 'Path tools' }))
    fireEvent.click(toolbar.getByRole('button', { name: 'Done' }))
    expect(screen.queryByTestId('path-point')).not.toBeInTheDocument()
    expect(screen.getByTestId('path-line')).toBeInTheDocument()
    fireEvent.click(toolbar.getByRole('button', { name: 'Edit Path' }))
    expect(screen.getAllByTestId('path-point')).toHaveLength(2)
  })

  it('inserts and deletes waypoints via double-click', () => {
    spreadObjects()
    switchToPath()
    clickPath()
    const stage = screen.getByTestId('konva-stage')
    // Double-click near the third segment inserts there, not appended.
    stage.getPointerPosition = () => ({ x: 395, y: 340 })
    fireEvent.doubleClick(screen.getByTestId('path-line'))
    let points = useNavigationStore.getState().paths[0].points
    expect(points).toHaveLength(5)
    expect(points[3]).toEqual([395, 340])
    expect(screen.getAllByTestId('path-point')).toHaveLength(3)
    // Double-click an interior handle removes it; endpoints reconnect.
    const handles = screen.getAllByTestId('path-point')
    fireEvent.doubleClick(handles[0])
    points = useNavigationStore.getState().paths[0].points
    expect(points).toHaveLength(4)
    // from/to untouched by geometry edits.
    const [entrance, reception] = useLayoutStore.getState().layout.objects
    expect(useNavigationStore.getState().paths[0]).toMatchObject({ from: entrance.id, to: reception.id })
  })

  it('reconnects path endpoints after object movement (§11)', () => {
    spreadObjects()
    switchToPath()
    clickPath()
    const before = JSON.parse(JSON.stringify(useNavigationStore.getState().paths[0]))
    // Edit mode: move reception via the Inspector.
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByText('reception').parentElement)
    fireEvent.change(within(screen.getByLabelText('Inspector')).getByLabelText('X'), { target: { value: '600' } })
    // Stored navigation data is untouched by the move.
    expect(useNavigationStore.getState().paths[0].points).toEqual(before.points)
    // Path mode renders the endpoint at the new center (650,340).
    // (data-points is the flat Konva Line array: [x0,y0,x1,y1,...].)
    switchToPath()
    const rendered = JSON.parse(screen.getByTestId('path-line').getAttribute('data-points'))
    const flatBefore = before.points.flat()
    expect(rendered.slice(0, -2)).toEqual(flatBefore.slice(0, -2))
    expect(rendered.slice(-2)).toEqual([650, 340])
  })

  it('selects and deletes a path with confirmation (TC-031)', () => {
    addTwoObjects()
    switchToPath()
    clickPath()
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
    const created = clickPath()
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
    clickPath()
    fireEvent.keyDown(document.body, { key: 'Delete' })
    expect(window.confirm).not.toHaveBeenCalled()
    expect(useNavigationStore.getState().paths).toHaveLength(1)
  })

  it('returns to Edit mode with object editing intact', () => {
    addTwoObjects()
    switchToPath()
    clickPath()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(useEditorStore.getState().mode).toBe('edit')
    expect(screen.getByLabelText('Object library')).toBeInTheDocument()
    fireEvent.click(screen.getByText('entrance').parentElement)
    expect(useEditorStore.getState().selectedId).toBe(
      useLayoutStore.getState().layout.objects[0].id,
    )
  })
})

describe('Simulation mode (TC-039 UI)', () => {
  beforeEach(() => {
    resetStores()
    vi.stubGlobal('confirm', vi.fn(() => true))
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function buildPathWorld() {
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Entrance/ }))
    fireEvent.click(screen.getByRole('button', { name: /Reception/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Path' }))
    fireEvent.click(screen.getByText('entrance').parentElement)
    fireEvent.click(screen.getByText('reception').parentElement)
    expect(useNavigationStore.getState().paths).toHaveLength(1)
  }

  function switchToSimulation() {
    fireEvent.click(screen.getByRole('button', { name: 'Simulation' }))
    expect(useEditorStore.getState().mode).toBe('simulation')
  }

  it('blocks Simulation mode without valid navigation', () => {
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Entrance/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Simulation' }))
    expect(useEditorStore.getState().mode).toBe('edit')
    expect(screen.getByText('Needs a valid layout and navigation path')).toBeInTheDocument()
  })

  it('starts, shows the agent marker, and advances on ticks', () => {
    buildPathWorld()
    switchToSimulation()
    expect(screen.getByRole('toolbar', { name: 'Simulation tools' })).toBeInTheDocument()
    expect(screen.getByLabelText('Simulation control')).toBeInTheDocument()
    expect(screen.queryByLabelText('Object library')).not.toBeInTheDocument()
    expect(screen.getByTestId('sim-status')).toHaveTextContent('Ready')

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByTestId('sim-status')).toHaveTextContent('Running')
    const marker = screen.getByTestId('sim-agent')
    const x0 = Number(marker.getAttribute('data-x'))
    expect(useMovementStore.getState().records).toHaveLength(1)

    act(() => {
      useSimulationStore.getState().tick()
      useSimulationStore.getState().tick()
    })
    expect(useMovementStore.getState().records).toHaveLength(3)
    expect(Number(screen.getByTestId('sim-agent').getAttribute('data-x'))).toBeGreaterThan(x0)
    expect(within(screen.getByLabelText('Simulation control')).getByText(/records/)).toBeInTheDocument()
  })

  it('pauses, resumes, stops, and resets from the panel', () => {
    buildPathWorld()
    switchToSimulation()
    const panel = within(screen.getByLabelText('Simulation control'))
    fireEvent.click(panel.getByRole('button', { name: 'Start' }))
    useSimulationStore.getState().tick()

    fireEvent.click(panel.getByRole('button', { name: 'Pause' }))
    expect(screen.getByTestId('sim-status')).toHaveTextContent('Paused')
    const frozen = screen.getByTestId('sim-agent').getAttribute('data-x')
    act(() => {
      useSimulationStore.getState().tick()
    })
    expect(screen.getByTestId('sim-agent').getAttribute('data-x')).toBe(frozen)

    fireEvent.click(panel.getByRole('button', { name: 'Resume' }))
    expect(screen.getByTestId('sim-status')).toHaveTextContent('Running')

    fireEvent.click(panel.getByRole('button', { name: 'Stop' }))
    expect(screen.getByTestId('sim-status')).toHaveTextContent('Stopped')

    fireEvent.click(panel.getByRole('button', { name: 'Reset' }))
    expect(screen.getByTestId('sim-status')).toHaveTextContent('Running')
    expect(useMovementStore.getState().records).toHaveLength(1)
    expect(useSimulationStore.getState().session.time).toBe(0)
  })

  it('returns to Edit mode with Phase 1 editing intact', () => {    buildPathWorld()
    switchToSimulation()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(useEditorStore.getState().mode).toBe('edit')
    expect(screen.getByLabelText('Object library')).toBeInTheDocument()
    expect(screen.queryByTestId('sim-agent')).not.toBeInTheDocument()
  })

  it('completes a chained journey through every node', () => {
    render(<EditorApp />)
    fireEvent.click(screen.getByRole('button', { name: /Entrance/ }))
    fireEvent.click(screen.getByRole('button', { name: /Pharmacy/ }))
    fireEvent.click(screen.getByRole('button', { name: /Reception/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Path' }))
    // entrance -> pharmacy -> reception.
    fireEvent.click(screen.getAllByText('entrance')[0].parentElement)
    fireEvent.click(screen.getAllByText('pharmacy')[0].parentElement)
    fireEvent.click(screen.getAllByText('pharmacy')[0].parentElement)
    fireEvent.click(screen.getAllByText('reception')[0].parentElement)
    expect(useNavigationStore.getState().paths).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Simulation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    act(() => {
      for (let i = 0; i < 500 && useSimulationStore.getState().session?.status === 'running'; i += 1) {
        useSimulationStore.getState().tick()
      }
    })
    expect(screen.getByTestId('sim-status')).toHaveTextContent('Completed')
    expect(useSimulationStore.getState().agent.status).toBe('arrived')
    const objects = useLayoutStore.getState().layout.objects
    expect(useSimulationStore.getState().agent.currentNode).toBe(
      objects.find((o) => o.type === 'reception').id,
    )
  })
})

