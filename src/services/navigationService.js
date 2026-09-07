// Navigation Management orchestration (Phase 3; 06 §7.2).
//
// Application-layer only: UI calls these functions, which coordinate
// Navigation Store -> Validation -> Serialization -> Persistence (and back).
// Separate save/load functions from Layout, per 07 §9.2. No React, Konva,
// or DOM imports.

import { parseNavigationJson, serializeNavigation, validateNavigationStructure } from '../domain/models/navigation.js'
import { readNavigationJson, writeNavigationJson } from '../persistence/navigationStorage.js'
import { useNavigationStore } from '../stores/navigationStore.js'

function canExport(paths) {
  // Structural gate only: broken-ref paths are kept (marked invalid at
  // assembly/inspection), never silently dropped on save (07 §15.3).
  return validateNavigationStructure(paths).valid && paths.length > 0
}

// Save: current paths -> validate -> serialize -> LocalStorage (FR-PATH-005).
export function saveCurrentNavigation() {
  const { paths } = useNavigationStore.getState()
  if (!canExport(paths)) {
    return { ok: false, reason: 'empty-or-invalid' }
  }
  let json
  try {
    json = serializeNavigation(paths)
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  const written = writeNavigationJson(json)
  if (!written.ok) {
    return { ok: false, reason: written.reason }
  }
  return { ok: true }
}

// Load: LocalStorage -> parse -> validate -> Navigation State (FR-PATH-006).
// Invalid data never reaches the store; missing data is not an error.
export function loadSavedNavigation() {
  const read = readNavigationJson()
  if (!read.ok) {
    return read
  }
  const parsed = parseNavigationJson(read.text)
  if (!parsed.ok) {
    return parsed
  }
  useNavigationStore.getState().replaceAll(parsed.paths)
  return { ok: true }
}
