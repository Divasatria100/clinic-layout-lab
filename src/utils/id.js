// Unique ID generation (pure JS, no DOM/React/Konva dependency).

let fallbackCounter = 0

export function generateId(prefix = 'obj') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  fallbackCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${fallbackCounter}`
}
