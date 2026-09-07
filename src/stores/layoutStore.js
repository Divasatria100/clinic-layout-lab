import { create } from 'zustand'
import { GRID_SIZE, MIN_DIMENSION } from '../domain/constants/editor.js'
import {
  applySnapToPosition,
  applySnapToSize,
  createLayoutObject,
  duplicateLayoutObject,
  validateLayoutObject,
} from '../domain/models/layoutObject.js'
import { generateId } from '../utils/id.js'
import { isSnapActive, useEditorStore } from './editorStore.js'

// Layout state — the single source of truth for layout objects
// (docs/05 §5.1, 07 §13): { layout: { layoutId, objects[] } }.
// Konva nodes are transient visuals; every canvas interaction commits here.

function snapGridSize() {
  const editor = useEditorStore.getState()
  return isSnapActive(editor) ? GRID_SIZE : null
}

export const useLayoutStore = create((set, get) => ({
  layout: { layoutId: generateId('layout'), objects: [] },

  addObject: ({ type, x = 0, y = 0, width, height, rotation } = {}) => {
    const object = createLayoutObject({ type, x, y, width, height, rotation })
    set((state) => ({ layout: { ...state.layout, objects: [...state.layout.objects, object] } }))
    // New objects are auto-selected with highlight (04 §8.2).
    useEditorStore.getState().select(object.id)
    return object.id
  },

  // Merge a patch; invalid results keep the last valid object (05 §9).
  updateObject: (id, patch) =>
    set((state) => ({
      layout: {
        ...state.layout,
        objects: state.layout.objects.map((obj) => {
          if (obj.id !== id) {
            return obj
          }
          const next = { ...obj, ...patch, id: obj.id, type: obj.type, asset: obj.asset }
          return validateLayoutObject(next).valid ? next : obj
        }),
      },
    })),

  moveObject: (id, x, y) => {
    const gridSize = snapGridSize()
    const snapped = gridSize
      ? applySnapToPosition({ x, y }, gridSize, true)
      : { x, y }
    get().updateObject(id, { x: snapped.x, y: snapped.y })
  },

  resizeObject: (id, width, height) => {
    // Invalid raw input is rejected outright (05 §9); snap must never
    // resurrect it into a valid-looking dimension.
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width < MIN_DIMENSION ||
      height < MIN_DIMENSION
    ) {
      return
    }    const gridSize = snapGridSize()
    const snapped = gridSize
      ? applySnapToSize({ width, height }, gridSize, true)
      : { width, height }
    get().updateObject(id, { width: snapped.width, height: snapped.height })
  },

  rotateObject: (id, rotation) => {
    get().updateObject(id, { rotation })
  },

  duplicateObject: (id) => {
    const original = get().layout.objects.find((obj) => obj.id === id)
    if (!original) {
      return null
    }
    const copy = duplicateLayoutObject(original)
    set((state) => ({ layout: { ...state.layout, objects: [...state.layout.objects, copy] } }))
    useEditorStore.getState().select(copy.id)
    return copy.id
  },

  deleteObject: (id) => {
    set((state) => ({
      layout: { ...state.layout, objects: state.layout.objects.filter((obj) => obj.id !== id) },
    }))
    useEditorStore.getState().deselectIfSelected(id)
  },
}))

export function selectLayoutObject(state, id) {
  return state.layout.objects.find((obj) => obj.id === id) ?? null
}
