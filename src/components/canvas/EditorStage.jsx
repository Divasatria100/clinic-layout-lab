import React, { useEffect, useRef, useState } from 'react'
import { Layer, Stage, Transformer } from 'react-konva'
import { ZOOM_FACTOR } from '../../domain/constants/editor.js'
import { zoomAtPoint } from '../../domain/models/viewport.js'
import { useEditorStore } from '../../stores/editorStore.js'
import { useLayoutStore } from '../../stores/layoutStore.js'
import { useNavigationStore } from '../../stores/navigationStore.js'
import { CANVAS_BACKGROUND, SELECTED_BORDER } from './canvasTheme.js'
import GridLayer from './GridLayer.jsx'
import LayoutObjectNode from './LayoutObjectNode.jsx'
import PathLayer from './PathLayer.jsx'

// Main Konva canvas (AC-001): Stage + Background(grid) / Object / Overlay
// layers (04 §8.1). Zoom/pan only change the view transform; object data is
// untouched (AC-009, AC-010). Commits go to the layout store on dragend /
// transformend (07 §7.3).
export default function EditorStage() {
  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const transformerRef = useRef(null)
  const nodeRefs = useRef(new Map())
  const [size, setSize] = useState({ width: 800, height: 600 })

  const objects = useLayoutStore((state) => state.layout.objects)
  const selectedId = useEditorStore((state) => state.selectedId)
  const activeTool = useEditorStore((state) => state.activeTool)
  const mode = useEditorStore((state) => state.mode)
  const scale = useEditorStore((state) => state.scale)
  const stageX = useEditorStore((state) => state.stageX)
  const stageY = useEditorStore((state) => state.stageY)
  const gridVisible = useEditorStore((state) => state.gridVisible)
  const paths = useNavigationStore((state) => state.paths)
  const selectedPathId = useNavigationStore((state) => state.selectedPathId)
  const draft = useNavigationStore((state) => state.draft)
  const isPathMode = mode === 'path'

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return undefined
    }
    const update = () => {
      const rect = element.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height })
        useEditorStore.getState().setStageSize({ width: rect.width, height: rect.height })
      }
    }
    update()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    if (observer) {
      observer.observe(element)
    } else {
      window.addEventListener('resize', update)
    }
    return () => {
      if (observer) {
        observer.disconnect()
      } else {
        window.removeEventListener('resize', update)
      }
    }
  }, [])

  // Attach the Transformer (resize corners + rotate handle) to the selected node.
  // Edit mode only: Path mode never transforms objects (04 §9, read-only).
  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) {
      return
    }
    const node = !isPathMode && selectedId ? nodeRefs.current.get(selectedId) : null
    transformer.nodes(node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [selectedId, objects, isPathMode])

  const handleWheel = (event) => {
    event.evt.preventDefault()
    const stage = event.target.getStage()
    const pointer = stage.getPointerPosition()
    if (!pointer) {
      return
    }
    const factor = event.evt.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR
    const editor = useEditorStore.getState()
    const next = zoomAtPoint(
      { scale: editor.scale, x: editor.stageX, y: editor.stageY },
      pointer,
      factor,
    )
    editor.setViewport(next)
  }

  const handleStageDragEnd = (event) => {
    // Only panning the stage itself updates the viewport (object drags are
    // handled by their own nodes).
    if (event.target === event.target.getStage()) {
      const editor = useEditorStore.getState()
      editor.setViewport({ scale: editor.scale, x: event.target.x(), y: event.target.y() })
    }
  }

  const handleEmptyClick = (event) => {
    // Only genuine empty-canvas clicks (target is the Stage itself).
    if (!stageRef.current || event.target !== stageRef.current) {
      return
    }
    if (isPathMode) {
      // Path mode: empty click appends a waypoint while drawing (04 §9).
      const nav = useNavigationStore.getState()
      if (nav.draft?.phase !== 'draw') {
        return
      }
      const pointer = stageRef.current.getPointerPosition?.()
      if (!pointer) {
        return
      }
      const editor = useEditorStore.getState()
      nav.addDraftPoint((pointer.x - editor.stageX) / editor.scale, (pointer.y - editor.stageY) / editor.scale)
      return
    }
    useEditorStore.getState().deselect()
  }

  const handleFinishDraw = (event) => {
    if (!isPathMode) {
      return
    }
    if (!stageRef.current || event.target !== stageRef.current) {
      return
    }
    const nav = useNavigationStore.getState()
    if (nav.draft?.phase !== 'draw') {
      return
    }
    const result = nav.finishDraft()
    if (!result.ok) {
      useEditorStore.getState().showToast('info', 'Add at least two points to finish the path')
    }
  }

  // Path mode object clicks pick source/destination (04 §9, UC-NAV-001).
  // Objects stay read-only: no drag, no transform, no Edit selection.
  const handlePathObjectClick = (id) => {
    const nav = useNavigationStore.getState()
    const current = nav.draft
    if (!current || current.phase === 'source') {
      nav.pickSourceObject(id)
    } else if (current.phase === 'dest') {
      const result = nav.pickDestObject(id)
      if (result.reason === 'same-object') {
        useEditorStore.getState().showToast('info', 'Select two different objects to create a path')
      }
    }
  }

  return (
    <div ref={containerRef} data-testid="editor-stage-container" className="h-full w-full">
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={scale}
        scaleY={scale}
        x={stageX}
        y={stageY}
        draggable
        onWheel={handleWheel}
        onDragEnd={handleStageDragEnd}
        onClick={handleEmptyClick}
        onTap={handleEmptyClick}
        onDblClick={handleFinishDraw}
        style={{ background: CANVAS_BACKGROUND }}
      >
        {gridVisible && (
          <GridLayer
            stageWidth={size.width}
            stageHeight={size.height}
            scale={scale}
            stageX={stageX}
            stageY={stageY}
          />
        )}
        {/* Object layer. The Transformer lives here (last child, rendered above
            the objects) instead of a separate listening overlay layer: this is
            the official react-konva pattern. Transformer anchors are
            draggable shapes and need a listening layer to receive pointer
            events — inside a listening={false} layer they go event-dead and a
            mousedown on a handle falls through to the draggable Stage, so
            dragging a handle pans the canvas instead of transforming.
            With anchors alive, Konva drags the anchor itself (nearest
            draggable wins, no bubble to Stage), so Stage pan only starts on
            genuinely empty canvas. */}
        <Layer>
          {objects.map((object) => (
            <LayoutObjectNode
              key={object.id}
              object={object}
              selected={!isPathMode && object.id === selectedId}
              interactive={!isPathMode && activeTool === 'select'}
              nodeRef={(node) => {
                if (node) {
                  nodeRefs.current.set(object.id, node)
                } else {
                  nodeRefs.current.delete(object.id)
                }
              }}
              onSelect={(id) => {
                if (isPathMode) {
                  handlePathObjectClick(id)
                } else {
                  useEditorStore.getState().select(id)
                }
              }}
              onMove={(id, x, y) => useLayoutStore.getState().moveObject(id, x, y)}
              onTransform={(id, patch) => {
                const store = useLayoutStore.getState()
                store.resizeObject(id, patch.width, patch.height)
                store.rotateObject(id, patch.rotation)
              }}
            />
          ))}
          <Transformer
            ref={transformerRef}
            borderStroke={SELECTED_BORDER}
            borderStrokeWidth={2}
            anchorStroke={SELECTED_BORDER}
            anchorFill="#0A0A0A"
            anchorSize={10}
            rotateEnabled
          />
        </Layer>
        {/* Path overlay is Path-mode only: keeps Edit selection unambiguous
            (§21) and matches mode-dependent overlay content (07 §7.1). */}
        {isPathMode && (
          <Layer>
            <PathLayer
              paths={paths}
              selectedPathId={selectedPathId}
              draft={draft}
              scale={scale}
              onSelectPath={(id) => useNavigationStore.getState().selectPath(id)}
              onPointDrag={(id, index, x, y) => useNavigationStore.getState().updatePathPoint(id, index, x, y)}
            />
          </Layer>
        )}
      </Stage>
    </div>
  )
}
