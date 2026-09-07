// Editor-wide numeric constants for Phase 1: Visual Editor.
//
// Every value here is an implementation default: the spec leaves grid size
// (04 §8.1 TBD #1, 07 §7.4, 08 §8), zoom limits/factors, and snap threshold
// unspecified. Snap rounds to the nearest grid multiple (no threshold).

export const GRID_SIZE = 32
export const MIN_DIMENSION = 1
export const MIN_SCALE = 0.25
export const MAX_SCALE = 3
export const ZOOM_FACTOR = 1.1
export const DUPLICATE_OFFSET = GRID_SIZE
