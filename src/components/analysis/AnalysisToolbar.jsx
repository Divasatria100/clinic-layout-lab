import React from 'react'

// Slim Analysis-mode bar: controls live in the Analysis Panel; this bar
// only states the mode contract.
export default function AnalysisToolbar() {
  return (
    <div role="toolbar" aria-label="Analysis tools" className="flex flex-wrap items-center gap-1 border-b border-neutral-800 bg-neutral-950 px-4 py-2">
      <span className="pr-2 text-xs text-neutral-400">
        Analysis mode — heatmap derives from movement records, read-only
      </span>
    </div>
  )
}
