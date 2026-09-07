import { beforeEach, describe, expect, it } from 'vitest'
import { useEnvStore } from '../../src/stores/envStore.js'

// Smoke test: proves React -> Zustand Store -> State works.
// No editor/simulation/navigation/heatmap state is created here.
describe('envStore smoke', () => {
  beforeEach(() => {
    useEnvStore.setState({ count: 0 })
  })

  it('starts at zero and increments', () => {
    expect(useEnvStore.getState().count).toBe(0)
    useEnvStore.getState().increment()
    expect(useEnvStore.getState().count).toBe(1)
  })
})
