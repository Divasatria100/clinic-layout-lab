import { describe, expect, it } from 'vitest'

// Smoke test: proves konva + react-konva can be imported.
// No editor behavior is tested here (Phase 1+ is NOT STARTED).
describe('konva smoke', () => {
  it('exposes the Konva namespace', async () => {
    const Konva = (await import('konva')).default
    expect(Konva.version).toBeDefined()
  })

  it('exposes react-konva primitives', async () => {
    const { Layer, Rect, Stage } = await import('react-konva')
    expect(Stage).toBeDefined()
    expect(Layer).toBeDefined()
    expect(Rect).toBeDefined()
  })
})
