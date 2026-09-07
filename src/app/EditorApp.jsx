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
import { useDeleteShortcut } from '../features/editor/useDeleteShortcut.js'
import { useEditorStore } from '../stores/editorStore.js'

// Layout Studio (04 §5.1): Edit mode = SCR-002 object editing,
// Path mode = SCR-003 navigation editing. Object Library is an Edit-only
// panel; Inspector swaps to Path Inspector in Path mode.
// Application composition only — no domain/simulation logic lives here.
export default function EditorApp() {
  useDeleteShortcut()
  const mode = useEditorStore((state) => state.mode)
  const isPathMode = mode === 'path'
  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <Header />
      {isPathMode ? <PathToolbar /> : <Toolbar />}
      <div className="flex min-h-0 flex-1">
        {!isPathMode && <ObjectLibrary />}
        <main aria-label="Canvas" className="min-w-0 flex-1">
          <EditorStage />
        </main>
        {isPathMode ? <PathInspector /> : <Inspector />}
      </div>
      <StatusBar />
      <Toast />
    </div>
  )
}
