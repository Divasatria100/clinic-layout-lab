import React from 'react'
import { Layer, Line } from 'react-konva'
import { GRID_SIZE } from '../../domain/constants/editor.js'
import { computeGridLines } from '../../domain/models/grid.js'
import { GRID_LINE } from './canvasTheme.js'

// Visual editing aid only (FR-ED-011): never becomes layout data and never
// touches object state.
export default function GridLayer({ stageWidth, stageHeight, scale, stageX, stageY }) {
  const lines = computeGridLines({ stageWidth, stageHeight, scale, stageX, stageY, gridSize: GRID_SIZE })
  return (
    <Layer listening={false}>
      {lines.map((line) => (
        <Line key={line.key} points={line.points} stroke={GRID_LINE} strokeWidth={1 / scale} listening={false} />
      ))}
    </Layer>
  )
}
