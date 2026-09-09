// Canvas visual tokens (docs/04-ui-ux-specification.md §3.1, §3.5, §8.1).
// Grid line color is an implementation default — the spec does not define one.

export const CANVAS_BACKGROUND = '#0A0A0A'
export const GRID_LINE = '#262626'
export const SELECTED_BORDER = '#00E5FF'
export const SELECTION_GLOW = 'rgb(0,229,255)'
// Navigation path visuals (04 §3.1, §9): tertiary for paths to differ from
// object selection cyan; selected path reuses the selection language.
export const PATH_LINE = '#0A3BFF'
export const PATH_POINT = '#0A3BFF'
// Patient agent marker (04 §10: per-agent color TBD — implementation default,
// distinct from path tertiary and selection cyan).
export const AGENT_FILL = '#4ADE80'
// Heatmap gradient stops (Phase 6 visual refinement): Blue (low) ->
// Yellow (medium) -> Red (high). Interpolated by heatmapColor.js;
// opacity still scales with density (master opacity preserved).
export const HEATMAP_LOW = '#2563EB'
export const HEATMAP_MID = '#EAB308'
export const HEATMAP_HIGH = '#DC2626'
