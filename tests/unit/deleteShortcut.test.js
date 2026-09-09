import { describe, expect, it } from 'vitest'
import { isEditableTarget } from '../../src/features/editor/useDeleteShortcut.js'

// Guard unit tests: jsdom lacks isContentEditable, so the contentEditable
// branch is verified with a stubbed HTMLElement (environment limitation
// documented; real browsers implement the property).
describe('isEditableTarget', () => {
  it('treats form fields as editable', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true)
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true)
    expect(isEditableTarget(document.createElement('select'))).toBe(true)
  })

  it('treats contentEditable elements as editable', () => {
    const stub = Object.create(HTMLElement.prototype)
    stub.isContentEditable = true
    expect(isEditableTarget(stub)).toBe(true)
    const plain = Object.create(HTMLElement.prototype)
    plain.isContentEditable = false
    expect(isEditableTarget(plain)).toBe(false)
  })

  it('treats plain targets as non-editable', () => {
    expect(isEditableTarget(document.createElement('div'))).toBe(false)
    expect(isEditableTarget(document.body)).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
    expect(isEditableTarget(undefined)).toBe(false)
    expect(isEditableTarget({})).toBe(false)
  })
})
