// LocalStorage adapter for navigation persistence (Phase 3).
//
// Same thin-wrapper shape as layoutStorage: serialization lives in
// domain/models/navigation.js, orchestration in services/navigationService.js.
// Dedicated key, separate from Layout (07 §9.2, §15.1).

export const NAVIGATION_STORAGE_KEY = 'clinic-layout-lab:navigation'

function storage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readNavigationJson() {
  const store = storage()
  if (!store) {
    return { ok: false, reason: 'unavailable' }
  }
  let text
  try {
    text = store.getItem(NAVIGATION_STORAGE_KEY)
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  if (text == null) {
    return { ok: false, reason: 'missing' }
  }
  return { ok: true, text }
}

export function writeNavigationJson(json) {
  const store = storage()
  if (!store) {
    return { ok: false, reason: 'unavailable' }
  }
  try {
    store.setItem(NAVIGATION_STORAGE_KEY, json)
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  return { ok: true }
}
