// Layout object model for Phase 1: Visual Editor.
//
// Pure functions only — no React, Konva, DOM, or canvas imports, so future
// simulation/analysis phases can reuse this module directly.
//
// Schema (docs/05-data-model.md §5.2, §7.1):
//   { id, type, asset, x, y, width, height, rotation }

import { getAssetType, isKnownAssetType } from '../constants/assets.js'
import { GRID_SIZE, MIN_DIMENSION } from '../constants/editor.js'
import { generateId } from '../../utils/id.js'

function isValidNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function createLayoutObject({ type, x = 0, y = 0, width, height, rotation = 0 }) {
  if (!isKnownAssetType(type)) {
    throw new Error(`Unknown object type: ${type}`)
  }
  const assetType = getAssetType(type)
  const candidate = {
    id: generateId('obj'),
    type,
    asset: assetType.file,
    x,
    y,
    width: width ?? assetType.defaultWidth,
    height: height ?? assetType.defaultHeight,
    rotation,
  }
  const { valid, errors } = validateLayoutObject(candidate)
  if (!valid) {
    throw new Error(`Invalid layout object: ${errors.join('; ')}`)
  }
  return candidate
}

// Non-throwing validation. width/height <= 0 are rejected (05 §9);
// callers keep the last valid value.
export function validateLayoutObject(obj) {
  const errors = []
  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['object must be an object'] }
  }
  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    errors.push('id must be a non-empty string')
  }
  if (!isKnownAssetType(obj.type)) {
    errors.push(`type must be one of the known asset types (got: ${obj.type})`)
  }
  if (typeof obj.asset !== 'string' || obj.asset.length === 0) {
    errors.push('asset must be a non-empty string')
  }
  if (!isValidNumber(obj.x)) {
    errors.push('x must be a finite number')
  }
  if (!isValidNumber(obj.y)) {
    errors.push('y must be a finite number')
  }
  if (!isValidNumber(obj.width) || obj.width < MIN_DIMENSION) {
    errors.push(`width must be a finite number >= ${MIN_DIMENSION}`)
  }
  if (!isValidNumber(obj.height) || obj.height < MIN_DIMENSION) {
    errors.push(`height must be a finite number >= ${MIN_DIMENSION}`)
  }
  if (!isValidNumber(obj.rotation)) {
    errors.push('rotation must be a finite number (degrees)')
  }
  return { valid: errors.length === 0, errors }
}

// Duplicate: same visuals, new unique id, offset position.
// Returns a fully independent object (no shared references).
export function duplicateLayoutObject(obj, offset = GRID_SIZE) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Cannot duplicate: object is required')
  }
  return {
    ...obj,
    id: generateId('obj'),
    x: obj.x + offset,
    y: obj.y + offset,
  }
}

// Snap a single value to the nearest grid multiple.
// Grid off (or invalid input) -> value unchanged (AC-012 alternative flow).
export function snapValue(value, gridSize = GRID_SIZE, enabled = true) {
  if (!enabled || !isValidNumber(value) || !isValidNumber(gridSize) || gridSize <= 0) {
    return value
  }
  return Math.round(value / gridSize) * gridSize
}

export function applySnapToPosition(obj, gridSize = GRID_SIZE, enabled = true) {
  return {
    ...obj,
    x: snapValue(obj.x, gridSize, enabled),
    y: snapValue(obj.y, gridSize, enabled),
  }
}

export function applySnapToSize(obj, gridSize = GRID_SIZE, enabled = true) {
  const width = snapValue(obj.width, gridSize, enabled)
  const height = snapValue(obj.height, gridSize, enabled)
  return {
    ...obj,
    // Snapping must never produce an invalid (<= 0) dimension.
    width: width < MIN_DIMENSION ? MIN_DIMENSION : width,
    height: height < MIN_DIMENSION ? MIN_DIMENSION : height,
  }
}

// Data-level center of an object (world coordinates). Used as the anchor
// for auto-created navigation path endpoints. Rotation is intentionally
// ignored: the center stays stable regardless of orientation.
export function layoutObjectCenter(obj) {
  return [obj.x + obj.width / 2, obj.y + obj.height / 2]
}
