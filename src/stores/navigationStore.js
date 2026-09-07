import { create } from 'zustand'
import {
  createNavigationPath,
  validateNavigationPath,
  validateNavigationStructure,
} from '../domain/models/navigation.js'
import { useLayoutStore } from './layoutStore.js'

// Navigation state — source of truth for Navigation Path runtime
// (07 §13, §9.1): paths[] sibling collection, separate from layoutStore.
// Konva only renders this state; temporary drawing state lives here too
// (07 §9.3) and never enters `paths` until a path is finished.

function layoutObjectIds() {
  return useLayoutStore.getState().layout.objects.map((obj) => obj.id)
}

const EMPTY_DRAFT = { sourceId: null, destId: null, points: [], phase: 'source' }

export const useNavigationStore = create((set, get) => ({
  paths: [],
  selectedPathId: null,
  draft: null,

  ensureDraft: () => {
    if (!get().draft) {
      set({ draft: { ...EMPTY_DRAFT } })
    }
    return get().draft
  },

  // Steps 1-2 of UC-NAV-001: click source, then destination object.
  pickSourceObject: (id) => {
    if (!layoutObjectIds().includes(id)) {
      return { ok: false, reason: 'unknown-object' }
    }
    set({ draft: { ...EMPTY_DRAFT, sourceId: id, phase: 'dest' }, selectedPathId: null })
    return { ok: true }
  },

  pickDestObject: (id) => {
    const { draft } = get()
    if (!draft || draft.phase !== 'dest') {
      return { ok: false, reason: 'no-draft' }
    }
    if (id === draft.sourceId) {
      return { ok: false, reason: 'same-object' }
    }
    if (!layoutObjectIds().includes(id)) {
      return { ok: false, reason: 'unknown-object' }
    }
    set({ draft: { ...draft, destId: id, phase: 'draw' } })
    return { ok: true }
  },

  // Step 3: click canvas to append waypoints (world coordinates).
  addDraftPoint: (x, y) => {
    const { draft } = get()
    if (!draft || draft.phase !== 'draw') {
      return { ok: false, reason: 'not-drawing' }
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return { ok: false, reason: 'invalid-point' }
    }
    set({ draft: { ...draft, points: [...draft.points, [x, y]] } })
    return { ok: true }
  },

  // Finish on double-click/Enter (04 §9). <2 points rejects completion.
  finishDraft: () => {
    const { draft } = get()
    if (!draft || draft.phase !== 'draw' || draft.points.length < 2) {
      return { ok: false, reason: 'too-few-points' }
    }
    let path
    try {
      path = createNavigationPath(
        { from: draft.sourceId, to: draft.destId, points: draft.points },
        layoutObjectIds(),
      )
    } catch {
      return { ok: false, reason: 'invalid-path' }
    }
    set((state) => ({ paths: [...state.paths, path], selectedPathId: path.id, draft: null }))
    return { ok: true, id: path.id }
  },

  cancelDraft: () => set({ draft: null }),

  selectPath: (id) => set((state) => (state.paths.some((p) => p.id === id) ? { selectedPathId: id } : state)),
  deselectPath: () => set({ selectedPathId: null }),
  deselectPathIfSelected: (id) =>
    set((state) => (state.selectedPathId === id ? { selectedPathId: null } : state)),

  // Edit geometry: drag a point handle (FR-PATH-003, UC-NAV-003).
  updatePathPoint: (id, index, x, y) =>
    set((state) => ({
      paths: state.paths.map((path) => {
        if (path.id !== id || !Number.isFinite(x) || !Number.isFinite(y)) {
          return path
        }
        const points = path.points.map((point, i) => (i === index ? [x, y] : point))
        const next = { ...path, points }
        return validateNavigationPath(next, layoutObjectIds()).valid ? next : path
      }),
    })),

  deletePath: (id) => {
    set((state) => ({ paths: state.paths.filter((path) => path.id !== id) }))
    get().deselectPathIfSelected(id)
  },

  // Wholesale replace from validated load data (FR-PATH-006).
  // Structural check only: broken refs are kept and marked invalid at
  // assembly/inspection time, never silently dropped (07 §15.3, §17.2).
  replaceAll: (paths) => {
    if (!validateNavigationStructure(paths).valid) {
      return false
    }
    set({ paths: paths.map((path) => ({ ...path, points: path.points.map(([x, y]) => [x, y]) })), selectedPathId: null, draft: null })
    return true
  },

  clearAll: () => set({ paths: [], selectedPathId: null, draft: null }),
}))

export function selectNavigationPath(state, id) {
  return state.paths.find((path) => path.id === id) ?? null
}
