import React from 'react'
import EditorStage from '../components/canvas/EditorStage.jsx'
import Header from '../components/layout/Header.jsx'
import Inspector from '../components/layout/Inspector.jsx'
import ObjectLibrary from '../components/layout/ObjectLibrary.jsx'
import StatusBar from '../components/layout/StatusBar.jsx'
import Toolbar from '../components/layout/Toolbar.jsx'

// Layout Studio in Edit mode (04 §5.1, SCR-002): the full Phase 1 scope.
// Application composition only — no domain/simulation logic lives here.
export default function EditorApp() {
  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <Header />
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <ObjectLibrary />
        <main aria-label="Canvas" className="min-w-0 flex-1">
          <EditorStage />
        </main>
        <Inspector />
      </div>
      <StatusBar />
    </div>
  )
}
