import { describe, expect, it } from 'vitest'
import { HEATMAP_CELL_SIZE } from '../../src/domain/constants/analysis.js'
import {
  aggregateMovementDensity,
  buildHeatmapData,
  cellKeyFor,
  filterValidMovementRecords,
  isValidMovementRecord,
  summarizeMovement,
} from '../../src/domain/models/analysis.js'

function record(overrides = {}) {
  return { movementId: 'm', sessionId: 's', patientId: 'p', timestamp: 0, x: 0, y: 0, ...overrides }
}

describe('movement processing (TC-060/063/064)', () => {
  it('accepts valid records and rejects invalid coordinates/ids', () => {
    expect(isValidMovementRecord(record({ x: 120, y: 80, timestamp: 100 }))).toBe(true)
    expect(isValidMovementRecord(record({ x: Number.NaN }))).toBe(false)
    expect(isValidMovementRecord(record({ y: Infinity }))).toBe(false)
    expect(isValidMovementRecord(record({ timestamp: '100' }))).toBe(false)
    expect(isValidMovementRecord(record({ patientId: '' }))).toBe(false)
    expect(isValidMovementRecord(record({ sessionId: '' }))).toBe(false)
    expect(isValidMovementRecord(null)).toBe(false)
    expect(isValidMovementRecord({ x: 1 })).toBe(false)
  })

  it('filters safely on empty/non-array input', () => {
    expect(filterValidMovementRecords([])).toEqual([])
    expect(filterValidMovementRecords(null)).toEqual([])
    const input = [record({ x: 1, y: 1 }), record({ x: Number.NaN, y: 1 })]
    const filtered = filterValidMovementRecords(input)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]).toBe(input[0])
    expect(input).toHaveLength(2)
  })
})

describe('grid generation (TC-061)', () => {
  it('uses cellSize 20 world units by default', () => {
    expect(HEATMAP_CELL_SIZE).toBe(20)
    expect(cellKeyFor(120, 80)).toBe('6,4')
  })

  it('maps boundary coordinates deterministically', () => {
    expect(cellKeyFor(40, 40)).toBe('2,2')
    expect(cellKeyFor(39.9, 40)).toBe('1,2')
    expect(cellKeyFor(0, 0)).toBe('0,0')
  })

  it('maps negative coordinates deterministically', () => {
    expect(cellKeyFor(-1, -1)).toBe('-1,-1')
    expect(cellKeyFor(-20, -20)).toBe('-1,-1')
    expect(cellKeyFor(-21, -21)).toBe('-2,-2')
  })

  it('honors custom cell sizes and large coordinates', () => {
    expect(cellKeyFor(100, 100, 50)).toBe('2,2')
    expect(cellKeyFor(1000000, 2000000)).toBe('50000,100000')
  })
})

describe('density calculation (TC-061/065)', () => {
  it('counts a single record as density 1', () => {
    expect(aggregateMovementDensity([record({ x: 5, y: 5 })])).toEqual([
      { areaRef: '0,0', intensityValue: 1 },
    ])
  })

  it('accumulates duplicates in the same cell (raw counts, no normalization)', () => {
    const records = Array.from({ length: 5 }, (_, i) => record({ movementId: `m${i}`, x: 5, y: 5 }))
    expect(aggregateMovementDensity(records)).toEqual([{ areaRef: '0,0', intensityValue: 5 }])
  })

  it('separates records in different cells deterministically', () => {
    const records = [record({ x: 5, y: 5 }), record({ x: 25, y: 5 }), record({ x: 5, y: 5 })]
    expect(aggregateMovementDensity(records)).toEqual([
      { areaRef: '0,0', intensityValue: 2 },
      { areaRef: '1,0', intensityValue: 1 },
    ])
  })

  it('returns empty for empty input and rejects bad cell sizes', () => {
    expect(aggregateMovementDensity([])).toEqual([])
    expect(aggregateMovementDensity([record()], 0)).toEqual([])
    expect(aggregateMovementDensity([record()], -5)).toEqual([])
  })
})

describe('heatmap data (TC-066)', () => {
  it('attaches world geometry with correct max density', () => {
    const { cells, maxDensity } = buildHeatmapData(
      [
        { areaRef: '6,4', intensityValue: 12 },
        { areaRef: '1,0', intensityValue: 5 },
      ],
      20,
    )
    expect(maxDensity).toBe(12)
    expect(cells).toEqual([
      { areaRef: '1,0', cellX: 1, cellY: 0, x: 20, y: 0, size: 20, intensityValue: 5 },
      { areaRef: '6,4', cellX: 6, cellY: 4, x: 120, y: 80, size: 20, intensityValue: 12 },
    ])
  })

  it('handles empty data safely (maxDensity 0, no division hazards)', () => {
    expect(buildHeatmapData([], 20)).toEqual({ cells: [], maxDensity: 0 })
    expect(buildHeatmapData(null, 20)).toEqual({ cells: [], maxDensity: 0 })
    expect(buildHeatmapData([{ areaRef: 'x' }], 20).cells).toEqual([])
  })
})

describe('movement summary', () => {
  it('counts positions and contributing agents', () => {
    const records = [
      record({ patientId: 'patient-1' }),
      record({ movementId: 'n', patientId: 'patient-1' }),
      record({ movementId: 'o', patientId: 'patient-2' }),
      record({ movementId: 'bad', x: Number.NaN }),
    ]
    expect(summarizeMovement(records)).toEqual({ totalPositions: 3, agentCount: 2 })
    expect(summarizeMovement([])).toEqual({ totalPositions: 0, agentCount: 0 })
  })
})
