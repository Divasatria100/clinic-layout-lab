import React from 'react'
import EditorStage from '../components/canvas/EditorStage.jsx'
import Header from '../components/layout/Header.jsx'
import Inspector from '../components/layout/Inspector.jsx'
import ObjectLibrary from '../components/layout/ObjectLibrary.jsx'
import StatusBar from '../components/layout/StatusBar.jsx'
import Toast from '../components/layout/Toast.jsx'
import Toolbar from '../components/layout/Toolbar.jsx'
import PathInspector from '../components/path/PathInspector.jsx'
import PathToolbar from '../components/path/PathToolbar.jsx'
import SimToolbar from '../components/simulation/SimToolbar.jsx'
import SimulationPanel from '../components/simulation/SimulationPanel.jsx'
import { useDeleteShortcut } from '../features/editor/useDeleteShortcut.js'
import { useEditorStore } from '../stores/editorStore.js'

// Layout Studio (04 §5.1): Edit mode = SCR-002 object editing,
// Path mode = SCR-003 navigation editing, Simulation mode = SCR-004
// single-patient run. Object Library is Edit-only; the right panel swaps
// per mode. Application composition only — no domain logic lives here.
export default function EditorApp() {
  useDeleteShortcut()
  const mode = useEditorStore((state) => state.mode)
  const isPathMode = mode === 'path'
  const isSimMode = mode === 'simulation'
  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <Header />
      {isPathMode ? <PathToolbar /> : isSimMode ? <SimToolbar /> : <Toolbar />}
      <div className="flex min-h-0 flex-1">
        {!isPathMode && !isSimMode && <ObjectLibrary />}
        <main aria-label="Canvas" className="min-w-0 flex-1">
          <EditorStage />
        </main>
        {isPathMode ? <PathInspector /> : isSimMode ? <SimulationPanel /> : <Inspector />}
      </div>
      <StatusBar />
      <Toast />
    </div>
  )
}
