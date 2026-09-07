import { useEffect } from 'react'
import { requestDeleteSelected } from './deleteSelected.js'

// Keyboard Delete triggers the exact same flow as the toolbar Delete button.
// Guards: no selection -> store no-ops; typing in an editable element ->
// ignored so Inspector/input editing is never hijacked.
function isEditableTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

export function useDeleteShortcut() {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Delete' || event.defaultPrevented) {
        return
      }
      if (isEditableTarget(event.target)) {
        return
      }
      requestDeleteSelected()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
}
