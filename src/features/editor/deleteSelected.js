import { useEditorStore } from '../../stores/editorStore.js'
import { useLayoutStore } from '../../stores/layoutStore.js'

// Shared delete flow (toolbar button + keyboard shortcut).
// Single source of truth: confirmation is mandatory (04 §8.3, §13, §14),
// no selection -> no-op, cancel -> object kept.
export function requestDeleteSelected() {
  const id = useEditorStore.getState().selectedId
  if (!id) {
    return
  }
  if (window.confirm('Delete the selected object?')) {
    useLayoutStore.getState().deleteObject(id)
  }
}
