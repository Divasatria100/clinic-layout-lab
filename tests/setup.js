import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL auto-cleanup only hooks into global afterEach; with `globals: false`
// unmount explicitly so component tests stay isolated.
afterEach(() => {
  cleanup()
})
