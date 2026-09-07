import React, { useEffect } from 'react'
import { loadSavedNavigation, saveCurrentNavigation } from '../../services/navigationService.js'
import { useEditorStore } from '../../stores/editorStore.js'
import { useNavigationStore } from '../../stores/navigationStore.js'

// Path-mode toolbar (04 §7.3 subset): drawing guidance + Delete Path +
// navigation Save/Load. Edit tools (Select/Pan/Duplicate/...) stay in the
// Edit toolbar; objects are read-only in Path mode.
function isEditableTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

const buttonClass = (disabled) =>
  `rounded px-2 py-1 text-xs ${
    disabled ? 'cursor-not-allowed text-neutral-600' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
  }`

export default function PathToolbar() {
  const draft = useNavigationStore((state) => state.draft)
  const selectedPathId = useNavigationStore((state) => state.selectedPathId)
  const pathCount = useNavigationStore((state) => state.paths.length)

  // Enter finishes the path, like double-click (04 §9).
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Enter' || event.defaultPrevented || isEditableTarget(event.target)) {
        return
      }
      if (useEditorStore.getState().mode !== 'path') {
        return
      }
      const nav = useNavigationStore.getState()
      if (nav.draft?.phase !== 'draw') {
        return
      }
      const result = nav.finishDraft()
      if (!result.ok) {
        useEditorStore.getState().showToast('info', 'Add at least two points to finish the path')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const hint = !draft
    ? 'Click an object to pick the path source'
    : draft.phase === 'dest'
      ? 'Click a different object as the destination'
      : 'Click the canvas to add points · Double-click or Enter to finish'

  const handleDelete = () => {
    const id = useNavigationStore.getState().selectedPathId
    if (!id) {
      return
    }
    if (window.confirm('Delete the selected path?')) {
      useNavigationStore.getState().deletePath(id)
    }
  }

  const handleSave = () => {
    const result = saveCurrentNavigation()
    useEditorStore.getState().showToast(
      result.ok ? 'success' : 'error',
      result.ok ? 'Navigation saved' : 'Could not save navigation',
    )
  }

  const handleLoad = () => {
    const result = loadSavedNavigation()
    if (result.ok) {
      return
    }
    if (result.reason === 'missing') {
      useEditorStore.getState().showToast('info', 'No saved navigation found')
    } else if (result.reason === 'malformed' || result.reason === 'invalid') {
      useEditorStore.getState().showToast('error', 'Navigation data tidak valid')
    } else {
      useEditorStore.getState().showToast('error', 'Could not load navigation')
    }
  }

  return (
    <div role="toolbar" aria-label="Path tools" className="flex flex-wrap items-center gap-1 border-b border-neutral-800 bg-neutral-950 px-4 py-2">
      <span className="pr-2 text-xs text-neutral-400">{hint}</span>
      {draft && (
        <button type="button" onClick={() => useNavigationStore.getState().cancelDraft()} className={buttonClass(false)}>
          Cancel
        </button>
      )}
      <button type="button" disabled={!selectedPathId} onClick={handleDelete} className={buttonClass(!selectedPathId)}>
        Delete Path
      </button>
      <span className="mx-1 h-4 w-px bg-neutral-800" />
      <button type="button" disabled={pathCount === 0} onClick={handleSave} className={buttonClass(pathCount === 0)}>
        Save
      </button>
      <button type="button" onClick={handleLoad} className={buttonClass(false)}>
        Load
      </button>
    </div>
  )
}
