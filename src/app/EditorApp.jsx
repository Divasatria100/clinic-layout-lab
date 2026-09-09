import React from 'react'
import EditorStage from '../components/canvas/EditorStage.jsx'
import Header from '../components/layout/Header.jsx'
import Inspector from '../components/layout/Inspector.jsx'
import ObjectLibrary from '../components/layout/ObjectLibrary.jsx'
import StatusBar from '../components/layout/StatusBar.jsx'
import Toast from '../components/layout/Toast.jsx'
import Toolbar from '../components/layout/Toolbar.jsx'
import AnalysisPanel from '../components/analysis/AnalysisPanel.jsx'
import AnalysisToolbar from '../components/analysis/AnalysisToolbar.jsx'
import PathInspector from '../components/path/PathInspector.jsx'
import PathToolbar from '../components/path/PathToolbar.jsx'
import SimToolbar from '../components/simulation/SimToolbar.jsx'
import SimulationPanel from '../components/simulation/SimulationPanel.jsx'
import { useDeleteShortcut } from '../features/editor/useDeleteShortcut.js'
import { useEditorStore } from '../stores/editorStore.js'

// Layout Studio (04 §5.1): Edit mode = SCR-002 object editing,
// Path mode = SCR-003 navigation editing, Simulation mode = SCR-004 run,
// Analysis mode = SCR-005 heatmap. Object Library is Edit-only; the right
// panel and toolbar swap per mode.
// Application composition only — no domain logic lives here.
export default function EditorApp() {
  useDeleteShortcut()
  const mode = useEditorStore((state) => state.mode)
  const panel =
    mode === 'path' ? <PathInspector />
    : mode === 'simulation' ? <SimulationPanel />
    : mode === 'analysis' ? <AnalysisPanel />
    : <Inspector />
  const toolbar =
    mode === 'path' ? <PathToolbar />
    : mode === 'simulation' ? <SimToolbar />
    : mode === 'analysis' ? <AnalysisToolbar />
    : <Toolbar />
  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <Header />
      {toolbar}
      <div className="flex min-h-0 flex-1">
        {mode === 'edit' && <ObjectLibrary />}
        <main aria-label="Canvas" className="min-w-0 flex-1">
          <EditorStage />
        </main>
        {panel}
      </div>
      <StatusBar />
      <Toast />
    </div>
  )
}
