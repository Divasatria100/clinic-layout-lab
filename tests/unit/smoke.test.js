import { describe, expect, it } from 'vitest'

// Smoke test: proves the Vitest runner discovers tests and runs assertions.
describe('environment smoke', () => {
  it('adds numbers', () => {
    expect(1 + 1).toBe(2)
  })
})
