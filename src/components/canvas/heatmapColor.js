// Heatmap color mapping (Phase 6 visual refinement).
//
// Pure function: normalized intensity [0,1] -> gradient color.
// No React, Konva, or DOM — deterministic and unit-testable.
// Gradient stops come from canvasTheme (single source): Blue (low) ->
// Yellow (mid) -> Red (high), piecewise-linear RGB interpolation.
import { HEATMAP_HIGH, HEATMAP_LOW, HEATMAP_MID } from './canvasTheme.js'

function hexToRgb(hex) {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16))
}

const STOPS = [
  { at: 0, color: hexToRgb(HEATMAP_LOW) },
  { at: 0.5, color: hexToRgb(HEATMAP_MID) },
  { at: 1, color: hexToRgb(HEATMAP_HIGH) },
]

function lerpChannel(a, b, t) {
  return Math.round(a + (b - a) * t)
}

export function heatmapColorFor(normalized) {
  const t = Number.isFinite(normalized) ? Math.min(1, Math.max(0, normalized)) : 0
  for (let i = 0; i < STOPS.length - 1; i += 1) {
    const lower = STOPS[i]
    const upper = STOPS[i + 1]
    if (t >= lower.at && t <= upper.at) {
      const span = upper.at - lower.at
      const local = span === 0 ? 0 : (t - lower.at) / span
      const [r, g, b] = lower.color.map((c, index) => lerpChannel(c, upper.color[index], local))
      return `rgb(${r}, ${g}, ${b})`
    }
  }
  const last = STOPS[STOPS.length - 1].color
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`
}

// Normalized intensity from canonical heatmap inputs (§5):
// intensityValue / maxDensity, safe for empty data.
export function normalizeIntensity(intensityValue, maxDensity) {
  if (!Number.isFinite(intensityValue) || !(maxDensity > 0)) {
    return 0
  }
  return Math.min(1, Math.max(0, intensityValue / maxDensity))
}
