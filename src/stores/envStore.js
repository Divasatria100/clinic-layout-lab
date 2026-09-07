import { create } from 'zustand'

// Minimal smoke store: proves Zustand can be imported and used.
// NOT a Phase 1+ editor/simulation/navigation/heatmap store.
export const useEnvStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}))
