# Clinic Layout Lab

Prototype: visual editor (Konva.js) producing structured layout + navigation data for a simulation engine.

> Phase 1 (Visual Editor) is implemented. Phase 2–6 are NOT STARTED.

## Using the Editor (Phase 1)

```text
Object Library (left) -> click an asset to place it at the viewport center
Canvas                -> click to select, drag to move, handles to resize/rotate,
                         drag empty area to pan, scroll to zoom
Toolbar               -> Select/Pan tools, Zoom In/Out, Grid + Snap toggles,
                         Duplicate/Delete (need a selection; delete asks to confirm),
                         Save/Load/Reset Layout (Save disabled when empty;
                         delete/reset ask to confirm)
Path mode (header)    -> click object A (source), click object B: path is
                         created immediately and selected; Edit Path shows
                         waypoint handles; double-click a segment to insert,
                         double-click a waypoint to remove, drag to reshape
                         (endpoints stay bound, from/to immutable)
Simulation mode       -> Start/Pause/Resume/Stop/Reset one patient agent
                         along the navigation path (fixed 100ms ticks);
                         movement records append per tick
Inspector (right)     -> precise X/Y/Width/Height/Rotation editing (bypasses snap)
Status bar (bottom)   -> zoom %, grid/snap state, object count
```

Placeholder object assets live in `public/assets/objects/` and can be
regenerated with:

```bash
npm run generate:assets
```

## Tech Stack

| Technology | Purpose |
| --- | --- |
| JavaScript | Primary programming language |
| React | Frontend application framework |
| Vite | Build/development tool |
| Konva.js + react-konva | Canvas rendering and interaction |
| Tailwind CSS | UI styling (outside canvas) |
| Zustand | Application/editor state management |
| LocalStorage | MVP layout persistence (Phase 2) |
| Vitest | Unit/integration-oriented testing |
| React Testing Library | React UI testing |

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Testing

```bash
npm run test        # single run (CI/verification)
npm run test:watch  # watch mode
```

## Build

```bash
npm run build
npm run preview     # preview the production build
```

## Project Structure

```text
src/
  app/ components/{ui,layout,canvas}/
  features/{editor,layout,navigation,simulation,analysis,heatmap}/
  domain/{models,constants}/ stores/ services/ persistence/ utils/
tests/
  unit/ components/ integration/ e2e/
public/assets/objects/
```
