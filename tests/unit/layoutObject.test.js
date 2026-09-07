import { describe, expect, it } from 'vitest'
import { ASSET_TYPES, isKnownAssetType, resolveAssetUrl } from '../../src/domain/constants/assets.js'
import {
  applySnapToPosition,
  applySnapToSize,
  createLayoutObject,
  duplicateLayoutObject,
  layoutObjectCenter,
  snapValue,
  validateLayoutObject,
} from '../../src/domain/models/layoutObject.js'

describe('createLayoutObject', () => {
  it('creates a valid object with id, type, and asset reference (AC-002/014/015/016)', () => {
    const obj = createLayoutObject({ type: 'reception', x: 100, y: 50 })
    expect(obj.id).toEqual(expect.any(String))
    expect(obj.id.length).toBeGreaterThan(0)
    expect(obj.type).toBe('reception')
    expect(obj.asset).toBe('reception.png')
    expect(obj.x).toBe(100)
    expect(obj.y).toBe(50)
    expect(obj.width).toBe(100)
    expect(obj.height).toBe(80)
    expect(obj.rotation).toBe(0)
    expect(validateLayoutObject(obj).valid).toBe(true)
  })

  it('uses reference default dimensions per asset type', () => {
    expect(createLayoutObject({ type: 'entrance' })).toMatchObject({ width: 80, height: 80 })
    expect(createLayoutObject({ type: 'examination-room' })).toMatchObject({ width: 160, height: 100 })
  })

  it('generates a unique id for every object (AC-014)', () => {
    const ids = new Set(
      Array.from({ length: 20 }, () => createLayoutObject({ type: 'toilet' }).id),
    )
    expect(ids.size).toBe(20)
  })

  it('rejects unknown types and invalid dimensions', () => {
    expect(() => createLayoutObject({ type: 'mri-scanner' })).toThrow()
    expect(() => createLayoutObject({ type: 'exit', width: 0 })).toThrow()
    expect(() => createLayoutObject({ type: 'exit', height: -5 })).toThrow()
    expect(() => createLayoutObject({ type: 'exit', x: Number.NaN })).toThrow()
  })
})

describe('duplicateLayoutObject (AC-008)', () => {
  it('copies visuals with a new unique id and offset position', () => {
    const original = createLayoutObject({ type: 'pharmacy', x: 64, y: 64 })
    const copy = duplicateLayoutObject(original)
    expect(copy.id).not.toBe(original.id)
    expect(copy.type).toBe(original.type)
    expect(copy.asset).toBe(original.asset)
    expect(copy.width).toBe(original.width)
    expect(copy.height).toBe(original.height)
    expect(copy.rotation).toBe(original.rotation)
    expect(copy.x).toBe(original.x + 32)
    expect(copy.y).toBe(original.y + 32)
  })

  it('produces independent objects', () => {
    const original = createLayoutObject({ type: 'pharmacy', x: 64, y: 64 })
    const copy = duplicateLayoutObject(original)
    copy.x = 999
    copy.width = 5
    expect(original.x).toBe(64)
    expect(original.width).toBe(100)
  })
})

describe('snap helpers (AC-012)', () => {
  it('snaps to the nearest grid multiple when enabled', () => {
    expect(snapValue(35, 32, true)).toBe(32)
    expect(snapValue(50, 32, true)).toBe(64)
    const obj = applySnapToPosition({ x: 35, y: 50 }, 32, true)
    expect(obj).toMatchObject({ x: 32, y: 64 })
  })

  it('leaves values untouched when grid is off', () => {
    expect(snapValue(35, 32, false)).toBe(35)
    const obj = applySnapToPosition({ x: 35, y: 50 }, 32, false)
    expect(obj).toMatchObject({ x: 35, y: 50 })
  })

  it('never snaps a dimension below the minimum', () => {
    const obj = applySnapToSize({ width: 10, height: 10 }, 32, true)
    expect(obj.width).toBeGreaterThanOrEqual(1)
    expect(obj.height).toBeGreaterThanOrEqual(1)
  })
})

describe('asset catalog', () => {
  it('exposes the 9 specified asset types with resolvable urls', () => {
    expect(ASSET_TYPES).toHaveLength(9)
    for (const entry of ASSET_TYPES) {
      expect(isKnownAssetType(entry.type)).toBe(true)
      expect(entry.file).toBe(`${entry.type}.png`)
      expect(resolveAssetUrl(entry.file)).toBe(`/assets/objects/${entry.file}`)
    }
  })
})

describe('layoutObjectCenter', () => {
  it('returns the data-level center in world coordinates', () => {
    expect(layoutObjectCenter({ x: 0, y: 0, width: 80, height: 80 })).toEqual([40, 40])
    expect(layoutObjectCenter({ x: 200, y: 10, width: 100, height: 80 })).toEqual([250, 50])
  })
})
