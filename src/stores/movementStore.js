import { create } from 'zustand'

// Movement records (Phase 4): append-only runtime output (05 §5.6, 09 §16).
// Records are frozen on append — never mutated afterwards (AC-059).
export const useMovementStore = create((set) => ({
  records: [],

  append: (record) =>
    set((state) => ({ records: [...state.records, Object.freeze({ ...record })] })),

  clear: () => set({ records: [] }),
}))
