import { fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EditorApp from '../../src/app/EditorApp.jsx'
import { useEditorStore } from '../../src/stores/editorStore.js'
import { useLayoutStore } from '../../src/stores/layoutStore.js'

// jsdom has no canvas 2d context, so react-konva primitives are stubbed to
// plain elements. Canvas-specific commit logic is covered by store unit
// tests; these tests verify the editor UI drives the same store.
vi.mock('react-konva', async () => {
  const ReactModule = await import('react')
  const create = ReactModule.createElement
  return {
    Stage: ({ children }) => create('div', { 'data-testid': 'konva-stage' }, children),
    Layer: ({ children, listening }) =>
      create('div', { 'data-layer-listening': String(listening) }, children),
    Group: ({ children, onClick }) => create('div', { onClick }, children),
    Rect: () => null,
    Line: () => null,
    Image: () => null,
    Transformer: () => create('div', { 'data-testid': 'transformer' }),
    Text: ({ text }) => create('span', null, text),
  }
})

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
    stageSize: { width: 800, height: 600 },
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
