// Layout Management orchestration (Phase 2: Layout Data; 06 §7.2).
//
// Application-layer only: UI calls these functions, which coordinate
// Layout Store -> Validation -> Serialization -> Persistence (and back).
// No React, Konva, or DOM imports.

import { canExportLayout, parseLayoutJson, serializeLayout } from '../domain/models/layout.js'
import { readLayoutJson, writeLayoutJson } from '../persistence/layoutStorage.js'
import { useLayoutStore } from '../stores/layoutStore.js'

// Save: current state -> validate -> serialize -> LocalStorage
// (FR-LD-003; UC-LD-001, incl. A1 empty-export block).
export function saveCurrentLayout() {
  const { layout } = useLayoutStore.getState()
  if (!canExportLayout(layout)) {
    return { ok: false, reason: 'empty-or-invalid' }
  }
  let json
  try {
    json = serializeLayout(layout)
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  const written = writeLayoutJson(json)
  if (!written.ok) {
    return { ok: false, reason: written.reason }
  }
  return { ok: true }
}

// Load: LocalStorage -> parse -> validate -> Layout State.
// Invalid data never reaches the store (07 §15.3; FR-LD-005).
// Missing data is a normal first-run case, not an error (07 §15.3).
export function loadSavedLayout() {
  const read = readLayoutJson()
  if (!read.ok) {
    return read
  }
  const parsed = parseLayoutJson(read.text)
  if (!parsed.ok) {
    return parsed
  }
  useLayoutStore.getState().replaceLayout(parsed.layout)
  return { ok: true }
}

// Reset/clear (FR-LD-007 COULD; UC-LD-003).
export function resetCurrentLayout() {
  useLayoutStore.getState().clearLayout()
  return { ok: true }
}
