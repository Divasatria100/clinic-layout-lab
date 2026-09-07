import React, { useEffect, useRef, useState } from 'react'
import { Layer, Stage, Transformer } from 'react-konva'
import { ZOOM_FACTOR } from '../../domain/constants/editor.js'
import { zoomAtPoint } from '../../domain/models/viewport.js'
import { useEditorStore } from '../../stores/editorStore.js'
import { useLayoutStore } from '../../stores/layoutStore.js'
import { CANVAS_BACKGROUND, SELECTED_BORDER } from './canvasTheme.js'
import GridLayer from './GridLayer.jsx'
import LayoutObjectNode from './LayoutObjectNode.jsx'

// Main Konva canvas (AC-001): Stage + Background(grid) / Object / Overlay
// layers (04 §8.1). Zoom/pan only change the view transform; object data is
// untouched (AC-009, AC-010). Commits go to the layout store on dragend /
// transformend (07 §7.3).
export default function EditorStage() {
  const containerRef = useRef(null)
  const transformerRef = useRef(null)
  const nodeRefs = useRef(new Map())
  const [size, setSize] = useState({ width: 800, height: 600 })

  const objects = useLayoutStore((state) => state.layout.objects)
  const selectedId = useEditorStore((state) => state.selectedId)
  const activeTool = useEditorStore((state) => state.activeTool)
  const scale = useEditorStore((state) => state.scale)
  const stageX = useEditorStore((state) => state.stageX)
  const stageY = useEditorStore((state) => state.stageY)
  const gridVisible = useEditorStore((state) => state.gridVisible)

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
  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) {
      return
    }
    const node = selectedId ? nodeRefs.current.get(selectedId) : null
    transformer.nodes(node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [selectedId, objects])

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
    if (event.target === event.target.getStage()) {
      useEditorStore.getState().deselect()
    }
  }

  return (
    <div ref={containerRef} data-testid="editor-stage-container" className="h-full w-full">
      <Stage
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
        <Layer>
          {objects.map((object) => (
            <LayoutObjectNode
              key={object.id}
              object={object}
              selected={object.id === selectedId}
              interactive={activeTool === 'select'}
              nodeRef={(node) => {
                if (node) {
                  nodeRefs.current.set(object.id, node)
                } else {
                  nodeRefs.current.delete(object.id)
                }
              }}
              onSelect={(id) => useEditorStore.getState().select(id)}
              onMove={(id, x, y) => useLayoutStore.getState().moveObject(id, x, y)}
              onTransform={(id, patch) => {
                const store = useLayoutStore.getState()
                store.resizeObject(id, patch.width, patch.height)
                store.rotateObject(id, patch.rotation)
              }}
            />
          ))}
        </Layer>
        <Layer listening={false}>
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
      </Stage>
    </div>
  )
}
