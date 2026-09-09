import React from 'react'
import { Rect } from 'react-konva'
import { HEATMAP_MAX_OPACITY, HEATMAP_MIN_OPACITY } from '../../domain/constants/analysis.js'
import { heatmapColorFor, normalizeIntensity } from './heatmapColor.js'

// Heatmap overlay (04 §12, 07 §12.2): world-space rects below objects,
// Blue->Yellow->Red gradient with density-driven opacity. Pure projection
// of derived heatmap data — never reads Movement Records directly (06 §7.1),
// never recalculates density (color maps per already-computed cell).
export default function HeatmapLayer({ cells, maxDensity, masterOpacity }) {
  if (!Array.isArray(cells) || cells.length === 0 || !(maxDensity > 0)) {
    return null
  }
  return (
    <>
      {cells.map((cell) => {
        const intensity = normalizeIntensity(cell.intensityValue, maxDensity)
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
            fill={heatmapColorFor(intensity)}
            opacity={Math.max(0, opacity)}
            listening={false}
          />
        )
      })}
    </>
  )
}
