import React from 'react'
import { Layer, Rect, Stage } from 'react-konva'

// Minimal smoke component: proves React -> react-konva -> Konva works.
// NOT a Phase 1 editor implementation.
export default function StageSmoke() {
  return (
    <Stage width={300} height={200} data-testid="stage-smoke-canvas">
      <Layer>
        <Rect x={20} y={20} width={100} height={60} fill="#0d9488" />
      </Layer>
    </Stage>
  )
}
