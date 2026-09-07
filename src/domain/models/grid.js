// Grid line computation (Phase 1: Visual Editor).
//
// Pure geometry for the visual editing aid (FR-ED-011): given the stage size
// and view transform, return world-coordinate line segments at GRID_SIZE
// multiples covering the visible area. Rendering stays in GridLayer.
export function computeGridLines({ stageWidth, stageHeight, scale, stageX, stageY, gridSize }) {
  const left = -stageX / scale || 0
  const top = -stageY / scale || 0
  const right = (stageWidth - stageX) / scale || 0
  const bottom = (stageHeight - stageY) / scale || 0
  const lines = []
  for (let x = Math.floor(left / gridSize) * gridSize; x <= right; x += gridSize) {
    lines.push({ key: `v-${x}`, points: [x, top, x, bottom] })
  }
  for (let y = Math.floor(top / gridSize) * gridSize; y <= bottom; y += gridSize) {
    lines.push({ key: `h-${y}`, points: [left, y, right, y] })
  }
  return lines
}
