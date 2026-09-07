import React from 'react'
import { AGENT_FILL } from './canvasTheme.js'
import { Circle } from 'react-konva'

// Single patient marker (Phase 4): follows simulation position only.
// Never part of layout objects, never persisted as layout data.
export default function AgentMarker({ position, scale }) {
  if (!position) {
    return null
  }
  return (
    <Circle
      name="sim-agent"
      x={position.x}
      y={position.y}
      radius={6 / scale}
      fill={AGENT_FILL}
      stroke="#ffffff"
      strokeWidth={2 / scale}
      listening={false}
    />
  )
}
