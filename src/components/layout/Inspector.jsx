import React, { useState } from 'react'
import { useEditorStore } from '../../stores/editorStore.js'
import { useLayoutStore } from '../../stores/layoutStore.js'

// Inspector (04 §8.4, right panel in Edit mode):
// ID + Type read-only; X/Y/Width/Height/Rotation editable numerics with
// real-time commit. Inspector edits are precise: they bypass grid snap and
// invalid input keeps the last valid value (05 §9).
const FIELDS = [
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'width', label: 'Width' },
  { key: 'height', label: 'Height' },
  { key: 'rotation', label: 'Rotation (°)' },
]

function Field({ label, value, outOfCanvas, onCommit }) {
  const [draft, setDraft] = useState(null)
  return (
    <label className="flex flex-col gap-0.5 text-xs text-neutral-400">
      {label}
      <input
        aria-label={label}
        type="number"
        value={draft ?? value}
        onChange={(event) => {
          const raw = event.target.value
          setDraft(raw)
          const parsed = Number(raw)
          // Reject non-numeric input inline (04 §8.4).
          if (raw !== '' && Number.isFinite(parsed)) {
            onCommit(parsed)
          }
        }}
        onBlur={() => setDraft(null)}
        className={`rounded border bg-neutral-900 px-2 py-1 text-neutral-100 ${
          outOfCanvas ? 'border-amber-400' : 'border-neutral-700'
        }`}
      />
    </label>
  )
}

export default function Inspector() {
  const selectedId = useEditorStore((state) => state.selectedId)
  const object = useLayoutStore((state) =>
    state.layout.objects.find((entry) => entry.id === selectedId),
  )

  if (!object) {
    return (
      <aside aria-label="Inspector" className="w-64 shrink-0 border-l border-neutral-800 bg-neutral-950 p-3">
        <h2 className="pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Inspector</h2>
        <p className="text-xs text-neutral-500">Select an object to see its properties</p>
      </aside>
    )
  }

  const commit = (key, parsed) => {
    useLayoutStore.getState().updateObject(object.id, { [key]: parsed })
  }

  return (
    <aside aria-label="Inspector" className="w-64 shrink-0 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-3">
      <h2 className="pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Inspector</h2>
      <dl className="mb-3 text-xs">
        <div className="flex justify-between py-0.5">
          <dt className="text-neutral-500">ID</dt>
          <dd className="max-w-36 truncate font-mono text-neutral-300" title={object.id}>{object.id}</dd>
        </div>
        <div className="flex justify-between py-0.5">
          <dt className="text-neutral-500">Type</dt>
          <dd className="text-neutral-300">{object.type}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2">
        {FIELDS.map(({ key, label }) => (
          <Field
            key={key}
            label={label}
            value={object[key]}
            outOfCanvas={(key === 'x' || key === 'y') && object[key] < 0}
            onCommit={(parsed) => commit(key, parsed)}
          />
        ))}
      </div>
      {object.x < 0 || object.y < 0 ? (
        <p className="pt-2 text-[11px] text-amber-400">Object is outside the canvas area</p>
      ) : null}
    </aside>
  )
}
