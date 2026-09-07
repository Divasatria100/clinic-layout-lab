import React from 'react'
import { Circle, Line } from 'react-konva'
import { PATH_LINE, SELECTED_BORDER, SELECTION_GLOW } from './canvasTheme.js'

// Projection of navigationStore paths onto canvas (AC-033/AC-025).
// Unselected: solid tertiary line + static dots. Selected: selection
// language. Editing (Edit Path active): interior waypoint handles —
// draggable to reshape, double-click a segment to insert, double-click
// a waypoint to remove it. Endpoints stay fixed to their objects:
// from/to never change on geometry edits.
// Pure rendering — all commits flow back to the navigation store.
function flat(points) {
  return points.flatMap(([x, y]) => [x, y])
}

export default function PathLayer({
  paths,
  selectedPathId,
  editingPathId,
  scale,
  onSelectPath,
  onPointDrag,
  onSegmentDoubleClick,
  onWaypointDoubleClick,
}) {
  const dotRadius = 4 / scale
  return (
    <>
      {paths.map((path) => {
        const selected = path.id === selectedPathId
        const editing = path.id === editingPathId
        return (
          <React.Fragment key={path.id}>
            <Line
              name="nav-path"
              points={flat(path.points)}
              stroke={selected ? SELECTED_BORDER : PATH_LINE}
              strokeWidth={(selected ? 3 : 2) / scale}
              lineCap="round"
              lineJoin="round"
              shadowColor={selected ? SELECTION_GLOW : undefined}
              shadowBlur={selected ? 8 : 0}
              onClick={(event) => {
                event.cancelBubble = true
                onSelectPath(path.id)
              }}
              onTap={(event) => {
                event.cancelBubble = true
                onSelectPath(path.id)
              }}
              onDblClick={(event) => {
                event.cancelBubble = true
                onSegmentDoubleClick(path.id)
              }}
            />
            {path.points.map(([x, y], index) => {
              const isEndpoint = index === 0 || index === path.points.length - 1
              if (editing && !isEndpoint) {
                return (
                  <Circle
                    key={index}
                    name="nav-point"
                    x={x}
                    y={y}
                    radius={dotRadius}
                    fill={SELECTED_BORDER}
                    draggable
                    onDragEnd={(event) => onPointDrag(path.id, index, event.target.x(), event.target.y())}
                    onDblClick={(event) => {
                      event.cancelBubble = true
                      onWaypointDoubleClick(path.id, index)
                    }}
                  />
                )
              }
              return (
                <Circle key={index} x={x} y={y} radius={dotRadius} fill={selected ? SELECTED_BORDER : PATH_LINE} listening={false} />
              )
            })}
          </React.Fragment>
        )
      })}
    </>
  )
}
