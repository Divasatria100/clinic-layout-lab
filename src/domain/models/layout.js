// Layout-level validation + serialization (Phase 2: Layout Data).
//
// Pure functions — no React, Konva, DOM, or storage imports, so future
// phases reuse them directly. Schema (05 §5.1, §7.3; 07 §8.1):
//   { layoutId: string, objects: LayoutObject[] }
// No version field, no extra fields (05 §10.5, §14; 07 §8.1).

import { validateLayoutObject } from './layoutObject.js'

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Structural validation for load/save (FR-LD-005, 05 §9, 07 §17).
// An empty objects array is structurally valid; export additionally
// requires >= 1 object (UC-LD-001 A1, see canExportLayout).
export function validateLayout(data) {
  const errors = []
  if (!isRecord(data)) {
    return { valid: false, errors: ['layout must be an object'] }
  }
  if (typeof data.layoutId !== 'string' || data.layoutId.length === 0) {
    errors.push('layoutId must be a non-empty string')
  }
  if (!Array.isArray(data.objects)) {
    errors.push('objects must be an array')
    return { valid: false, errors }
  }
  const seenIds = new Set()
  data.objects.forEach((obj, index) => {
    const result = validateLayoutObject(obj)
    if (!result.valid) {
      errors.push(`objects[${index}]: ${result.errors.join('; ')}`)
      return
    }
    if (seenIds.has(obj.id)) {
      errors.push(`objects[${index}]: duplicate id "${obj.id}"`)
    } else {
      seenIds.add(obj.id)
    }
  })
  return { valid: errors.length === 0, errors }
}

// Export gate (UC-LD-001 A1): an empty layout cannot be exported.
export function canExportLayout(layout) {
  return validateLayout(layout).valid && layout.objects.length > 0
}

// Serialize to deterministic JSON: canonical shape + fixed field order,
// domain data only (no view state, no Konva/React artifacts).
export function serializeLayout(layout) {
  const { valid, errors } = validateLayout(layout)
  if (!valid) {
    throw new Error(`Cannot serialize invalid layout: ${errors.join('; ')}`)
  }
  if (layout.objects.length === 0) {
    throw new Error('Cannot serialize an empty layout')
  }
  return JSON.stringify({
    layoutId: layout.layoutId,
    objects: layout.objects.map((obj) => ({
      id: obj.id,
      type: obj.type,
      asset: obj.asset,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      rotation: obj.rotation,
    })),
  })
}

// Deserialize: parse, then validate. Never throws; invalid input is reported
// (07 §15.3, §17.4 — never silently mutate state from corrupt data).
export function parseLayoutJson(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'malformed', errors: ['layout JSON is malformed'] }
  }
  const { valid, errors } = validateLayout(parsed)
  if (!valid) {
    return { ok: false, reason: 'invalid', errors }
  }
  return {
    ok: true,
    layout: {
      layoutId: parsed.layoutId,
      objects: parsed.objects.map((obj) => ({
        id: obj.id,
        type: obj.type,
        asset: obj.asset,
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
        rotation: obj.rotation,
      })),
    },
  }
}
