// Viewport math for zoom/pan (Phase 1: Visual Editor).
//
// Pure functions: zoom/pan only produce a view transform {scale, x, y} and
// must NEVER mutate layout object data (AC-009, AC-010).

import { MAX_SCALE, MIN_SCALE } from '../constants/editor.js'

export function clampScale(scale) {
  if (!Number.isFinite(scale)) {
    return 1
  }
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

// Scale around a pointer point (e.g. cursor or stage center).
export function zoomAtPoint(viewport, pointer, factor) {
  const newScale = clampScale(viewport.scale * factor)
  const ratio = newScale / viewport.scale
  return {
    scale: newScale,
    x: pointer.x - (pointer.x - viewport.x) * ratio,
    y: pointer.y - (pointer.y - viewport.y) * ratio,
  }
}

export function panViewportBy(viewport, dx, dy) {
  return { ...viewport, x: viewport.x + dx, y: viewport.y + dy }
}
