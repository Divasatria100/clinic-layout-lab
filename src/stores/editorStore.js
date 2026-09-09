import { create } from 'zustand'

// Editor/viewport state (Phase 1: Visual Editor).
//
// Session-only view state: NEVER persisted or serialized (05 §5.1).
// Depends on nothing — layoutStore reads this store, never vice versa.
export const useEditorStore = create((set) => ({
  selectedId: null,
  activeTool: 'select', // 'select' | 'pan'
  mode: 'edit', // 'edit' | 'path' | 'simulation' | 'analysis'
  scale: 1,
  stageX: 0,
  stageY: 0,
  gridVisible: true,
  snapEnabled: true,
  stageSize: { width: 800, height: 600 },
  toast: null, // { id, kind: 'success' | 'error' | 'info', message } | null
  heatmapVisible: true,
  heatmapOpacity: 1, // master opacity multiplier 0..1 (04 §12)

  select: (id) => set({ selectedId: id }),
  deselect: () => set({ selectedId: null }),
  deselectIfSelected: (id) =>
    set((state) => (state.selectedId === id ? { selectedId: null } : state)),

  setActiveTool: (tool) => set({ activeTool: tool }),
  setMode: (mode) => set({ mode }),
  setViewport: ({ scale, x, y }) => set({ scale, stageX: x, stageY: y }),
  setStageSize: (stageSize) => set({ stageSize }),
  toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  toggleHeatmap: () => set((state) => ({ heatmapVisible: !state.heatmapVisible })),
  setHeatmapOpacity: (value) =>
    set({ heatmapOpacity: Math.min(1, Math.max(0, Number(value) || 0)) }),

  // Transient UI feedback (toasts). Session-only, never persisted.
  showToast: (kind, message) =>
    set((state) => ({ toast: { id: (state.toast?.id ?? 0) + 1, kind, message } })),
  dismissToast: () => set({ toast: null }),
}))

// Snap only applies while the grid is visible (04 §8.3: snap disabled if grid off).
export function isSnapActive(state) {
  return state.gridVisible && state.snapEnabled
}
