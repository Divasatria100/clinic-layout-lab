import { describe, expect, it } from 'vitest'
import { computeGridLines } from '../../src/domain/models/grid.js'

// Logic behind TC-011: grid lines render at grid multiples and cover the
// visible viewport (rendering itself needs a real canvas).
describe('computeGridLines', () => {
  it('covers the viewport with lines at grid multiples', () => {
    const lines = computeGridLines({
      stageWidth: 800,
      stageHeight: 600,
      scale: 1,
      stageX: 0,
      stageY: 0,
      gridSize: 32,
    })
    const vertical = lines.filter((line) => line.key.startsWith('v-'))
    const horizontal = lines.filter((line) => line.key.startsWith('h-'))
    expect(vertical.length).toBe(26) // 0..800 step 32
    expect(horizontal.length).toBe(19) // 0..576 step 32
    expect(vertical[0].points).toEqual([0, 0, 0, 600])
  })

  it('shifts with pan and scales with zoom', () => {
    const panned = computeGridLines({
      stageWidth: 800,
      stageHeight: 600,
      scale: 1,
      stageX: -64,
      stageY: 0,
      gridSize: 32,
    })
    expect(panned[0].points[0]).toBe(64)
    const zoomed = computeGridLines({
      stageWidth: 800,
      stageHeight: 600,
      scale: 2,
      stageX: 0,
      stageY: 0,
      gridSize: 32,
    })
    // Visible world is 400x300 at 2x zoom.
    expect(zoomed.filter((line) => line.key.startsWith('v-')).length).toBe(13)
  })
})
