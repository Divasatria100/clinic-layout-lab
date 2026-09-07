import React from 'react'
import StageSmoke from './components/canvas/StageSmoke.jsx'
import { useEnvStore } from './stores/envStore.js'

// Minimal environment smoke screen. NOT a final dashboard UI.
export default function App() {
  const count = useEnvStore((state) => state.count)
  const increment = useEnvStore((state) => state.increment)

  return (
    <div data-testid="app-root" className="p-4">
      <h1>Clinic Layout Lab</h1>
      <p>Environment Ready</p>
      <ul>
        <li>React: Ready</li>
        <li>Tailwind: Ready</li>
        <li>Konva: Ready</li>
        <li>Zustand: Ready</li>
        <li>Vitest: Ready</li>
        <li>RTL: Ready</li>
      </ul>
      <button type="button" onClick={increment}>
        Count is {count}
      </button>
      <StageSmoke />
    </div>
  )
}
