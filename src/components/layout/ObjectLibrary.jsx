import React from 'react'
import { ASSET_TYPES, resolveAssetUrl } from '../../domain/constants/assets.js'
import { useEditorStore } from '../../stores/editorStore.js'
import { useLayoutStore } from '../../stores/layoutStore.js'

// Object library (04 §8.2, left panel in Edit mode).
// Click an item to place it at the current viewport center; the new object
// is auto-selected (04 §8.2).
export default function ObjectLibrary() {
  const addAtViewportCenter = (type) => {
    const editor = useEditorStore.getState()
    const { width, height } = editor.stageSize
    useLayoutStore.getState().addObject({
      type,
      x: (width / 2 - editor.stageX) / editor.scale,
      y: (height / 2 - editor.stageY) / editor.scale,
    })
  }

  const groups = ASSET_TYPES.reduce((acc, entry) => {
    acc[entry.category] = [...(acc[entry.category] ?? []), entry]
    return acc
  }, {})

  return (
    <aside aria-label="Object library" className="w-56 shrink-0 overflow-y-auto border-r border-neutral-800 bg-neutral-950 p-2">
      <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Object Library
      </h2>
      {Object.entries(groups).map(([category, entries]) => (
        <div key={category} className="mb-3">
          <h3 className="px-1 pb-1 text-[11px] uppercase tracking-wider text-neutral-500">{category}</h3>
          <ul className="flex flex-col gap-1">
            {entries.map((entry) => (
              <li key={entry.type}>
                <button
                  type="button"
                  onClick={() => addAtViewportCenter(entry.type)}
                  className="flex w-full items-center gap-2 rounded bg-neutral-900 px-2 py-1.5 text-left text-xs text-neutral-200 hover:bg-neutral-800"
                >
                  <img
                    src={resolveAssetUrl(entry.file)}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 shrink-0 rounded-sm bg-neutral-950 object-contain"
                  />
                  {entry.displayName}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  )
}
