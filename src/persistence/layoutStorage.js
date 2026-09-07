// LocalStorage adapter for layout persistence (Phase 2: Layout Data).
//
// Thin wrapper only: serialization lives in domain/models/layout.js,
// orchestration in services/layoutService.js. UI never touches
// localStorage directly. Key name is an implementation choice — the spec
// mandates a dedicated Layout key, separate from the future Navigation
// Path key (07 §9.2, §15.1, §21).

export const LAYOUT_STORAGE_KEY = 'clinic-layout-lab:layout'

function storage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readLayoutJson() {
  const store = storage()
  if (!store) {
    return { ok: false, reason: 'unavailable' }
  }
  let text
  try {
    text = store.getItem(LAYOUT_STORAGE_KEY)
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  if (text == null) {
    return { ok: false, reason: 'missing' }
  }
  return { ok: true, text }
}

export function writeLayoutJson(json) {
  const store = storage()
  if (!store) {
    return { ok: false, reason: 'unavailable' }
  }
  try {
    store.setItem(LAYOUT_STORAGE_KEY, json)
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  return { ok: true }
}

export function clearLayoutJson() {
  const store = storage()
  if (!store) {
    return { ok: false, reason: 'unavailable' }
  }
  try {
    store.removeItem(LAYOUT_STORAGE_KEY)
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  return { ok: true }
}
