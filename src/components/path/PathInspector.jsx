import React from 'react'
import { getAssetType } from '../../domain/constants/assets.js'
import { validateNavigationPath } from '../../domain/models/navigation.js'
import { useLayoutStore } from '../../stores/layoutStore.js'
import { selectNavigationPath, useNavigationStore } from '../../stores/navigationStore.js'

// Path Inspector (04 §9, right panel in Path mode): path list + selected
// path detail + delete. Paths with broken from/to refs are marked invalid
// (07 §17.2) and excluded from graph assembly — never silently dropped.
function endpointLabel(objects, id) {
  const object = objects.find((entry) => entry.id === id)
  if (!object) {
    return `${id.slice(0, 12)}… (missing)`
  }
  return getAssetType(object.type)?.displayName ?? object.type
}

export default function PathInspector() {
  const paths = useNavigationStore((state) => state.paths)
  const selectedPathId = useNavigationStore((state) => state.selectedPathId)
  const objects = useLayoutStore((state) => state.layout.objects)
  const objectIds = objects.map((object) => object.id)
  const selected = selectNavigationPath(useNavigationStore.getState(), selectedPathId)

  const handleDelete = () => {
    if (!selected) {
      return
    }
    if (window.confirm('Delete the selected path?')) {
      useNavigationStore.getState().deletePath(selected.id)
    }
  }

  return (
    <aside aria-label="Path inspector" className="w-64 shrink-0 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-3">
      <h2 className="pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Paths</h2>
      {paths.length === 0 ? (
        <p className="text-xs text-neutral-500">No navigation paths yet. Click two objects, then draw points.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1">
          {paths.map((path) => {
            const invalid = !validateNavigationPath(path, objectIds).valid
            const active = path.id === selectedPathId
            return (
              <li key={path.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => useNavigationStore.getState().selectPath(path.id)}
                  className={`w-full rounded px-2 py-1.5 text-left text-xs ${
                    active ? 'bg-cyan-400 text-neutral-950' : 'bg-neutral-900 text-neutral-200 hover:bg-neutral-800'
                  }`}
                >
                  <span className="block truncate">
                    {endpointLabel(objects, path.from)} → {endpointLabel(objects, path.to)}
                  </span>
                  {invalid && (
                    <span className={`block text-[11px] ${active ? 'text-neutral-800' : 'text-amber-400'}`}>
                      Invalid reference
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {selected && (
        <div className="border-t border-neutral-800 pt-2 text-xs">
          <dl>
            <div className="flex justify-between py-0.5">
              <dt className="text-neutral-500">ID</dt>
              <dd className="max-w-36 truncate font-mono text-neutral-300" title={selected.id}>{selected.id}</dd>
            </div>
            <div className="flex justify-between py-0.5">
              <dt className="text-neutral-500">From</dt>
              <dd className="max-w-36 truncate text-neutral-300" title={selected.from}>{endpointLabel(objects, selected.from)}</dd>
            </div>
            <div className="flex justify-between py-0.5">
              <dt className="text-neutral-500">To</dt>
              <dd className="max-w-36 truncate text-neutral-300" title={selected.to}>{endpointLabel(objects, selected.to)}</dd>
            </div>
            <div className="flex justify-between py-0.5">
              <dt className="text-neutral-500">Points</dt>
              <dd className="text-neutral-300">{selected.points.length}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={handleDelete}
            className="mt-2 rounded border border-red-500 px-2 py-1 text-xs text-red-400 hover:bg-red-950"
          >
            Delete Path
          </button>
        </div>
      )}
    </aside>
  )
}
