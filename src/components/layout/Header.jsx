import React from 'react'
import { useEditorStore } from '../../stores/editorStore.js'
import { useLayoutStore } from '../../stores/layoutStore.js'
import { useNavigationStore } from '../../stores/navigationStore.js'

// App header (04 §5.1): app name + mode switcher. Edit and Path modes are
// implemented; Simulation/Analysis stay disabled (later phases).
// Path mode requires >= 2 objects (04 §7.3, UC-NAV-001 A1); otherwise the
// switch is blocked with feedback and the user stays in Edit mode.
export default function Header() {
  const mode = useEditorStore((state) => state.mode)

  const switchMode = (next) => {
    if (next === mode) {
      return
    }
    if (next === 'path') {
      const count = useLayoutStore.getState().layout.objects.length
      if (count < 2) {
        useEditorStore.getState().showToast('info', 'Add at least two objects to create paths')
        return
      }
    }
    // Mode switches clear transient selection/pending/edit state so Edit and
    // Path interactions never leak into each other.
    useEditorStore.getState().deselect()
    useNavigationStore.getState().deselectPath()
    useNavigationStore.getState().clearPendingSource()
    useNavigationStore.getState().stopEditing()
    useEditorStore.getState().setMode(next)
  }

  const modeButton = (name, enabled, active) => (
    <button
      key={name}
      type="button"
      disabled={!enabled}
      aria-pressed={active}
      title={enabled ? undefined : name === 'Path' ? 'Needs at least two objects' : 'Available in a later phase'}
      onClick={() => switchMode(name.toLowerCase())}
      className={
        !enabled
          ? 'cursor-not-allowed rounded px-3 py-1 text-xs text-neutral-500'
          : active
            ? 'rounded bg-cyan-400 px-3 py-1 text-xs font-medium text-neutral-950'
            : 'rounded px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800'
      }
    >
      {name}
    </button>
  )

  return (
    <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-2">
      <h1 className="text-sm font-semibold tracking-wide text-neutral-100">Clinic Layout Lab</h1>
      <nav aria-label="Editor mode" className="flex gap-1">
        {modeButton('Edit', true, mode === 'edit')}
        {modeButton('Path', true, mode === 'path')}
        {modeButton('Simulation', false, false)}
        {modeButton('Analysis', false, false)}
      </nav>
    </header>
  )
}
