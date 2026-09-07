import { create } from 'zustand'
import { layoutObjectCenter } from '../domain/models/layoutObject.js'
import {
  createNavigationPath,
  deleteWaypoint,
  generateSegmentPoints,
  insertWaypoint,
  validateNavigationPath,
  validateNavigationStructure,
} from '../domain/models/navigation.js'
import { useLayoutStore } from './layoutStore.js'

// Navigation state — source of truth for Navigation Path runtime
// (07 §13, §9.1): paths[] sibling collection, separate from layoutStore.
// Konva only renders this state.
//
// Interaction model: click object A (pending source), click object B —
// the path is created immediately with initial center-to-center geometry
// and auto-selected. Waypoints shape the route afterwards; from/to never
// change on geometry edits.

function findObject(id) {
  return useLayoutStore.getState().layout.objects.find((obj) => obj.id === id)
}

// Initial geometry: automatic center-to-center segmentation (§6-9).
// Long spans get evenly distributed interior waypoints; short spans get
// none. Runs ONLY here at creation — never regenerated afterwards (§11-12).
function initialPoints(fromObj, toObj) {
  const start = layoutObjectCenter(fromObj)
  const end = layoutObjectCenter(toObj)
  return generateSegmentPoints(start, end) ?? [start, end]
}

export const useNavigationStore = create((set, get) => ({
  paths: [],
  selectedPathId: null,
  pendingSourceId: null,
  editingPathId: null,

  // Click object with no pending source -> it becomes the source.
  // Pending state is cleared by empty-canvas click or mode switch (§25).
  pickSourceObject: (id) => {
    if (!findObject(id)) {
      return { ok: false, reason: 'unknown-object' }
    }
    set({ pendingSourceId: id, selectedPathId: null, editingPathId: null })
    return { ok: true }
  },

  // Click a different object -> path is created immediately (no canvas
  // clicks, no draft, no manual endpoint attachment).
  // Identical from/to pairs are allowed: no documented rule forbids
  // duplicate edges, so no new validation rule is invented (§14).
  pickDestObject: (id) => {
    const sourceId = get().pendingSourceId
    if (!sourceId) {
      return { ok: false, reason: 'no-source' }
    }
    if (id === sourceId) {
      return { ok: false, reason: 'same-object' }
    }
    const fromObj = findObject(sourceId)
    const toObj = findObject(id)
    if (!fromObj || !toObj) {
      return { ok: false, reason: 'unknown-object' }
    }
    let path
    try {
      path = createNavigationPath(
        { from: sourceId, to: id, points: initialPoints(fromObj, toObj) },
        [sourceId, id],
      )
    } catch {
      return { ok: false, reason: 'invalid-path' }
    }
    set((state) => ({ paths: [...state.paths, path], selectedPathId: path.id, pendingSourceId: null, editingPathId: path.id }))
    return { ok: true, id: path.id }
  },

  clearPendingSource: () => set({ pendingSourceId: null }),

  // Edit-mode gating (§7, §17): exactly one path exposes waypoint handles.
  // Selecting another path moves selection and drops the edit target.
  selectPath: (id) =>
    set((state) => {
      if (!state.paths.some((p) => p.id === id)) {
        return state
      }
      return {
        selectedPathId: id,
        editingPathId: state.editingPathId === id ? state.editingPathId : null,
      }
    }),
  deselectPath: () => set({ selectedPathId: null, editingPathId: null }),
  deselectPathIfSelected: (id) =>
    set((state) =>
      state.selectedPathId === id ? { selectedPathId: null, editingPathId: null } : state,
    ),

  // Edit Path toggle (§7): waypoint handles exist only for the editing path.
  startEditing: (id) =>
    set((state) =>
      state.paths.some((p) => p.id === id)
        ? { selectedPathId: id, editingPathId: id }
        : state,
    ),
  stopEditing: () => set({ editingPathId: null }),

  // Edit geometry: drag a waypoint handle (FR-PATH-003, UC-NAV-003).
  // Interior points only; from/to never change here.
  updatePathPoint: (id, index, x, y) => {
    if (get().editingPathId !== id) {
      return
    }
    set((state) => ({
      paths: state.paths.map((path) => {
        if (path.id !== id || !Number.isFinite(x) || !Number.isFinite(y)) {
          return path
        }
        if (index <= 0 || index >= path.points.length - 1) {
          return path
        }
        const points = path.points.map((point, i) => (i === index ? [x, y] : point))
        const next = { ...path, points }
        const objectIds = useLayoutStore.getState().layout.objects.map((obj) => obj.id)
        return validateNavigationPath(next, objectIds).valid ? next : path
      }),
    }))
  },

  // Insert a waypoint on its nearest segment (§10-11). Editing-gated.
  insertPathPoint: (id, x, y) => {
    const path = get().paths.find((p) => p.id === id)
    if (!path) {
      return { ok: false, reason: 'unknown-path' }
    }
    if (get().editingPathId !== id) {
      return { ok: false, reason: 'not-editing' }
    }
    const inserted = insertWaypoint(path.points, x, y)
    if (!inserted) {
      return { ok: false, reason: 'invalid-point' }
    }
    const next = { ...path, points: inserted.points }
    const objectIds = useLayoutStore.getState().layout.objects.map((obj) => obj.id)
    if (!validateNavigationPath(next, objectIds).valid) {
      return { ok: false, reason: 'invalid-path' }
    }
    set((state) => ({ paths: state.paths.map((p) => (p.id === id ? next : p)) }))
    return { ok: true, index: inserted.index }
  },

  // Delete an interior waypoint (§15). Endpoints and <2-point results stay.
  deletePathPoint: (id, index) => {
    const path = get().paths.find((p) => p.id === id)
    if (!path) {
      return { ok: false, reason: 'unknown-path' }
    }
    if (get().editingPathId !== id) {
      return { ok: false, reason: 'not-editing' }
    }
    const removed = deleteWaypoint(path.points, index)
    if (!removed) {
      return { ok: false, reason: 'not-allowed' }
    }
    const next = { ...path, points: removed.points }
    const objectIds = useLayoutStore.getState().layout.objects.map((obj) => obj.id)
    if (!validateNavigationPath(next, objectIds).valid) {
      return { ok: false, reason: 'invalid-path' }
    }
    set((state) => ({ paths: state.paths.map((p) => (p.id === id ? next : p)) }))
    return { ok: true }
  },

  deletePath: (id) => {
    set((state) => ({
      paths: state.paths.filter((path) => path.id !== id),
      editingPathId: state.editingPathId === id ? null : state.editingPathId,
    }))
    get().deselectPathIfSelected(id)
  },

  // Wholesale replace from validated load data (FR-PATH-006).
  // Structural check only: broken refs are kept and marked invalid at
  // assembly/inspection time, never silently dropped (07 §15.3, §17.2).
  replaceAll: (paths) => {
    if (!validateNavigationStructure(paths).valid) {
      return false
    }
    set({ paths: paths.map((path) => ({ ...path, points: path.points.map(([x, y]) => [x, y]) })), selectedPathId: null, pendingSourceId: null, editingPathId: null })
    return true
  },

  clearAll: () => set({ paths: [], selectedPathId: null, pendingSourceId: null, editingPathId: null }),
}))

export function selectNavigationPath(state, id) {
  return state.paths.find((path) => path.id === id) ?? null
}
