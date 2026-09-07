import React, { useEffect } from 'react'
import { useEditorStore } from '../../stores/editorStore.js'

// Transient toast feedback (04 §14, §15): e.g. exact "Layout saved" text on
// save success, error text on invalid load data. Auto-dismisses.
const KIND_CLASS = {
  success: 'border-cyan-400 text-cyan-300',
  error: 'border-red-500 text-red-400',
  info: 'border-neutral-500 text-neutral-300',
}

export default function Toast() {
  const toast = useEditorStore((state) => state.toast)

  useEffect(() => {
    if (!toast) {
      return undefined
    }
    const timer = setTimeout(() => {
      useEditorStore.getState().dismissToast()
    }, 2500)
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast) {
    return null
  }
  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={`pointer-events-none fixed bottom-10 left-1/2 z-50 -translate-x-1/2 rounded border bg-neutral-950/95 px-3 py-1.5 text-xs ${KIND_CLASS[toast.kind] ?? KIND_CLASS.info}`}
    >
      {toast.message}
    </div>
  )
}
