import React, { useState } from 'react'
import { Group, Image, Rect, Text } from 'react-konva'
import { resolveAssetUrl } from '../../domain/constants/assets.js'
import { SELECTED_BORDER, SELECTION_GLOW } from './canvasTheme.js'
import { useAssetImage } from './useAssetImage.js'

// Visual representation of one layout object (AC-002..AC-008).
// The Zustand layout object is the source of truth; this node only renders
// it and commits interactions (dragend / transformend) back to the store.
export default function LayoutObjectNode({
  object,
  selected,
  interactive,
  nodeRef,
  onSelect,
  onMove,
  onTransform,
}) {
  const { image } = useAssetImage(resolveAssetUrl(object.asset))
  const [hovered, setHovered] = useState(false)

  const handleDragEnd = (event) => {
    onMove(object.id, event.target.x(), event.target.y())
  }

  const handleTransformEnd = (event) => {
    const node = event.target
    // Transformer works in scale space: bake scale into width/height and
    // reset scale so structured data stays in plain numbers (07 §7.3).
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    onTransform(object.id, {
      width: Math.max(1, object.width * scaleX),
      height: Math.max(1, object.height * scaleY),
      rotation: node.rotation(),
    })
  }

  return (
    <Group
      x={object.x}
      y={object.y}
      rotation={object.rotation}
      draggable={interactive}
      ref={nodeRef}
      onClick={(event) => {
        event.cancelBubble = true
        onSelect(object.id)
      }}
      onTap={(event) => {
        event.cancelBubble = true
        onSelect(object.id)
      }}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
      onMouseEnter={(event) => {
        event.cancelBubble = true
        setHovered(true)
      }}
      onMouseLeave={() => setHovered(false)}
    >
      {image ? (
        <Image image={image} width={object.width} height={object.height} />
      ) : (
        <>
          <Rect
            width={object.width}
            height={object.height}
            fill="#111111"
            stroke={selected ? SELECTED_BORDER : '#6b7280'}
            strokeWidth={selected ? 2 : 1}
            shadowColor={selected ? SELECTION_GLOW : undefined}
            shadowBlur={selected ? 8 : 0}
          />
          <Text
            text={object.type}
            width={object.width}
            align="center"
            y={object.height / 2 - 8}
            fontSize={12}
            fill="#e5e7eb"
            listening={false}
          />
        </>
      )}
      {!selected && hovered && image && (
        <Rect
          width={object.width}
          height={object.height}
          stroke={SELECTED_BORDER}
          strokeWidth={1}
          opacity={0.6}
          listening={false}
        />
      )}
    </Group>
  )
}
