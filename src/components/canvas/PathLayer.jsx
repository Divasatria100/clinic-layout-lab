import React from 'react'
import { Circle, Line } from 'react-konva'
import { PATH_LINE, SELECTED_BORDER, SELECTION_GLOW } from './canvasTheme.js'

// Projection of navigationStore paths onto canvas (AC-033/AC-025).
// Unselected: solid tertiary line + static dots. Selected: selection
// language + draggable point handles for geometry editing (FR-PATH-003).
// Draft preview: dashed line of in-progress points. Pure rendering — all
// commits flow back to the navigation store via callbacks.
function flat(points) {
  return points.flatMap(([x, y]) => [x, y])
}

export default function PathLayer({ paths, selectedPathId, draft, scale, onSelectPath, onPointDrag }) {
  const dotRadius = 4 / scale
  return (
    <>
      {paths.map((path) => {
        const selected = path.id === selectedPathId
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
            />
            {path.points.map(([x, y], index) =>
              selected ? (
                <Circle
                  key={index}
                  name="nav-point"
                  x={x}
                  y={y}
                  radius={dotRadius}
                  fill={SELECTED_BORDER}
                  draggable
                  onDragEnd={(event) => onPointDrag(path.id, index, event.target.x(), event.target.y())}
                />
              ) : (
                <Circle key={index} x={x} y={y} radius={dotRadius} fill={PATH_LINE} listening={false} />
              ),
            )}
          </React.Fragment>
        )
      })}
      {draft && draft.points.length > 0 && (
        <>
          <Line
            points={flat(draft.points)}
            stroke={SELECTED_BORDER}
            strokeWidth={2 / scale}
            dash={[8 / scale, 6 / scale]}
            lineCap="round"
            listening={false}
          />
          {draft.points.map(([x, y], index) => (
            <Circle key={index} x={x} y={y} radius={dotRadius} fill={SELECTED_BORDER} listening={false} />
          ))}
        </>
      )}
    </>
  )
}
