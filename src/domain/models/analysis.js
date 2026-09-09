// Movement analysis + heatmap domain (Phase 6).
//
// Pure functions — no React, Konva, DOM, timers, or storage. Read-only over
// Movement Records: raw records are never mutated, derived data is
// recomputed on demand (10 §27). Algorithms: ALG-DENS-001, ALG-HEAT-001.

import { HEATMAP_CELL_SIZE } from '../constants/analysis.js'

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// A record is usable iff its position, timestamp, and identities are valid.
export function isValidMovementRecord(record) {
  if (!isRecord(record)) {
    return false
  }
  return (
    typeof record.x === 'number' && Number.isFinite(record.x) &&
    typeof record.y === 'number' && Number.isFinite(record.y) &&
    typeof record.timestamp === 'number' && Number.isFinite(record.timestamp) &&
    typeof record.patientId === 'string' && record.patientId.length > 0 &&
    typeof record.sessionId === 'string' && record.sessionId.length > 0
  )
}

export function filterValidMovementRecords(records) {
  if (!Array.isArray(records)) {
    return []
  }
  return records.filter(isValidMovementRecord)
}

// Deterministic cell key for world coordinates (floor division, stable for
// negatives and exact boundaries as long as cellSize is unchanged).
export function cellKeyFor(x, y, cellSize = HEATMAP_CELL_SIZE) {
  return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`
}

// ALG-DENS-001 Movement Density Aggregation: O(M) count per cell.
// Output [{ areaRef, intensityValue }] with raw counts, no normalization
// (05 §7.8; 10 §20.1). Sorted by areaRef for deterministic output.
export function aggregateMovementDensity(records, cellSize = HEATMAP_CELL_SIZE) {
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    return []
  }
  const densityMap = new Map()
  for (const record of filterValidMovementRecords(records)) {
    const key = cellKeyFor(record.x, record.y, cellSize)
    densityMap.set(key, (densityMap.get(key) ?? 0) + 1)
  }
  return [...densityMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([areaRef, intensityValue]) => ({ areaRef, intensityValue }))
}

// ALG-HEAT-001 Heatmap Data Generation: density is already render-ready;
// this step attaches world geometry per cell for the Heatmap View
// (10 §21; 05 §7.8). Returns { cells, maxDensity } (maxDensity 0 when empty,
// avoiding division-by-zero downstream).
export function buildHeatmapData(density, cellSize = HEATMAP_CELL_SIZE) {
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    return { cells: [], maxDensity: 0 }
  }
  const cells = (Array.isArray(density) ? density : [])
    .filter((entry) => isRecord(entry) && typeof entry.areaRef === 'string' && Number.isFinite(entry.intensityValue))
    .map((entry) => {
      const [cellX, cellY] = entry.areaRef.split(',').map(Number)
      return {
        areaRef: entry.areaRef,
        cellX,
        cellY,
        x: cellX * cellSize,
        y: cellY * cellSize,
        size: cellSize,
        intensityValue: entry.intensityValue,
      }
    })
    .filter((cell) => Number.isFinite(cell.cellX) && Number.isFinite(cell.cellY))
    .sort((a, b) => (a.areaRef < b.areaRef ? -1 : a.areaRef > b.areaRef ? 1 : 0))
  return {
    cells,
    maxDensity: cells.reduce((max, cell) => Math.max(max, cell.intensityValue), 0),
  }
}

// Movement summary for the Analysis Panel (§11 traffic + statistics):
// total positions (FR-MOV-001) and contributing agents (FR-MOV-002).
export function summarizeMovement(records) {
  const valid = filterValidMovementRecords(records)
  return {
    totalPositions: valid.length,
    agentCount: new Set(valid.map((record) => record.patientId)).size,
  }
}
