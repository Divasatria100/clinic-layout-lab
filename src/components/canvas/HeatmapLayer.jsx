import React from 'react'
import { Rect } from 'react-konva'
import { HEATMAP_FILL } from './canvasTheme.js'
import { HEATMAP_MAX_OPACITY, HEATMAP_MIN_OPACITY } from '../../domain/constants/analysis.js'

// Heatmap overlay (04 §12, 07 §12.2): world-space rects below objects,
// single-hue cyan with density-driven opacity. Pure projection of derived
// heatmap data — never reads Movement Records directly (06 §7.1).
export default function HeatmapLayer({ cells, maxDensity, masterOpacity }) {
  if (!Array.isArray(cells) || cells.length === 0 || !(maxDensity > 0)) {
    return null
  }
  return (
    <>
      {cells.map((cell) => {
        const intensity = Math.min(1, cell.intensityValue / maxDensity)
        const opacity =
          (HEATMAP_MIN_OPACITY + (HEATMAP_MAX_OPACITY - HEATMAP_MIN_OPACITY) * intensity) *
          masterOpacity
        return (
          <Rect
            key={cell.areaRef}
            name="heatmap-cell"
            x={cell.x}
            y={cell.y}
            width={cell.size}
            height={cell.size}
            fill={HEATMAP_FILL}
            opacity={Math.max(0, opacity)}
            listening={false}
          />
        )
      })}
    </>
  )
}
