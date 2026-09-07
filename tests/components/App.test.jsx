import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.jsx'
import { useEnvStore } from '../../src/stores/envStore.js'

// jsdom has no canvas 2d context, so the real Konva Stage cannot render
// here. Mock only the canvas smoke component; Konva itself is verified
// by tests/unit/konva.test.js and by `npm run build` / `npm run dev`.
vi.mock('../../src/components/canvas/StageSmoke.jsx', () => ({
  default: () => <div data-testid="stage-smoke" />,
}))

// Smoke test: proves React Component -> React Testing Library -> Vitest.
describe('App smoke', () => {
  beforeEach(() => {
    useEnvStore.setState({ count: 0 })
  })

  it('renders the environment status', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'Clinic Layout Lab' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Environment Ready')).toBeInTheDocument()
    for (const name of ['React', 'Tailwind', 'Konva', 'Zustand', 'Vitest', 'RTL']) {
      expect(screen.getByText(`${name}: Ready`)).toBeInTheDocument()
    }
    expect(screen.getByTestId('stage-smoke')).toBeInTheDocument()
  })

  it('uses Tailwind classes and the Zustand store', () => {
    render(<App />)
    expect(screen.getByTestId('app-root')).toHaveClass('p-4')
    const button = screen.getByRole('button', { name: 'Count is 0' })
    fireEvent.click(button)
    expect(
      screen.getByRole('button', { name: 'Count is 1' }),
    ).toBeInTheDocument()
  })
})
