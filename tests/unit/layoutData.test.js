import { describe, expect, it } from 'vitest'
import { canExportLayout, parseLayoutJson, serializeLayout, validateLayout } from '../../src/domain/models/layout.js'
import { createLayoutObject } from '../../src/domain/models/layoutObject.js'

function sampleLayout() {
  return {
    layoutId: 'layout-test',
    objects: [
      { ...createLayoutObject({ type: 'entrance', x: 32, y: 64 }), rotation: 90 },
      createLayoutObject({ type: 'reception', x: 160, y: 96 }),
    ],
  }
}

describe('validateLayout (TC-024, TC-072)', () => {
  it('accepts a complete valid layout', () => {
    expect(validateLayout(sampleLayout()).valid).toBe(true)
  })

  it('rejects non-objects, missing layoutId, and non-array objects', () => {
    expect(validateLayout(null).valid).toBe(false)
    expect(validateLayout({ objects: [] }).valid).toBe(false)
    expect(validateLayout({ layoutId: 'x', objects: {} }).valid).toBe(false)
  })

  it('rejects objects with missing fields, unknown types, or bad values', () => {
    const base = sampleLayout()
    const { id, ...withoutId } = base.objects[0]
    expect(id.length).toBeGreaterThan(0)
    expect(validateLayout({ ...base, objects: [withoutId] }).valid).toBe(false)
    expect(validateLayout({ ...base, objects: [{ ...base.objects[0], type: 'mri' }] }).valid).toBe(false)
    expect(validateLayout({ ...base, objects: [{ ...base.objects[0], width: 0 }] }).valid).toBe(false)
    expect(validateLayout({ ...base, objects: [{ ...base.objects[0], x: 'left' }] }).valid).toBe(false)
    expect(validateLayout({ ...base, objects: [{ ...base.objects[0], asset: '' }] }).valid).toBe(false)
  })

  it('rejects duplicate ids within one layout', () => {
    const base = sampleLayout()
    const twin = { ...base.objects[0], x: 999 }
    expect(validateLayout({ ...base, objects: [base.objects[0], twin] }).valid).toBe(false)
  })
})

describe('serializeLayout / parseLayoutJson (TC-018, TC-021, TC-026)', () => {
  it('exports canonical JSON with the exact schema fields', () => {
    const json = serializeLayout(sampleLayout())
    const parsed = JSON.parse(json)
    expect(Object.keys(parsed)).toEqual(['layoutId', 'objects'])
    expect(Object.keys(parsed.objects[0])).toEqual([
      'id',
      'type',
      'asset',
      'x',
      'y',
      'width',
      'height',
      'rotation',
    ])
    expect(parsed.objects[0]).toMatchObject({ type: 'entrance', rotation: 90 })
  })

  it('blocks export of empty or invalid layouts (TC-022)', () => {
    expect(canExportLayout({ layoutId: 'x', objects: [] })).toBe(false)
    expect(() => serializeLayout({ layoutId: 'x', objects: [] })).toThrow()
    expect(canExportLayout(sampleLayout())).toBe(true)
  })

  it('round-trips without silent loss (TC-026, TC-074)', () => {
    const original = sampleLayout()
    const result = parseLayoutJson(serializeLayout(original))
    expect(result.ok).toBe(true)
    expect(result.layout).toEqual(original)
  })

  it('reports malformed JSON and schema mismatches without throwing (TC-072, TC-073)', () => {
    expect(parseLayoutJson('{oops')).toMatchObject({ ok: false, reason: 'malformed' })
    const bad = parseLayoutJson(JSON.stringify({ layoutId: 'x', objects: [{ id: 'a' }] }))
    expect(bad).toMatchObject({ ok: false, reason: 'invalid' })
    expect(bad.errors.length).toBeGreaterThan(0)
  })
})
