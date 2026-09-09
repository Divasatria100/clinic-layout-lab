import { describe, expect, it } from 'vitest'
import { heatmapColorFor, normalizeIntensity } from '../../src/components/canvas/heatmapColor.js'

describe('heatmapColorFor', () => {
  it('maps endpoints to low blue and high red', () => {
    expect(heatmapColorFor(0)).toBe('rgb(37, 99, 235)')
    expect(heatmapColorFor(1)).toBe('rgb(220, 38, 38)')
  })

  it('maps the midpoint to yellow', () => {
    expect(heatmapColorFor(0.5)).toBe('rgb(234, 179, 8)')
  })

  it('interpolates smoothly between stops', () => {
    expect(heatmapColorFor(0.25)).toBe('rgb(136, 139, 122)')
    expect(heatmapColorFor(0.75)).toBe('rgb(227, 109, 23)')
  })

  it('clamps out-of-range input and orders LOW < MEDIUM < HIGH', () => {
    expect(heatmapColorFor(-2)).toBe(heatmapColorFor(0))
    expect(heatmapColorFor(99)).toBe(heatmapColorFor(1))
    expect(heatmapColorFor(Number.NaN)).toBe(heatmapColorFor(0))
    const [low, mid, high] = [heatmapColorFor(0.1), heatmapColorFor(0.5), heatmapColorFor(0.9)]
    expect(new Set([low, mid, high]).size).toBe(3)
  })

  it('is deterministic for identical input', () => {
    expect(heatmapColorFor(0.33)).toBe(heatmapColorFor(0.33))
  })
})

describe('normalizeIntensity', () => {
  it('normalizes against maxDensity and guards empty data', () => {
    expect(normalizeIntensity(0, 10)).toBe(0)
    expect(normalizeIntensity(5, 10)).toBe(0.5)
    expect(normalizeIntensity(10, 10)).toBe(1)
    expect(normalizeIntensity(99, 10)).toBe(1)
    expect(normalizeIntensity(5, 0)).toBe(0)
    expect(normalizeIntensity(Number.NaN, 10)).toBe(0)
  })
})
