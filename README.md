# Clinic Layout Lab

Prototype: visual editor (Konva.js) producing structured layout + navigation data for a simulation engine.

> Phase 1 (Visual Editor) is implemented. Phase 2–6 are NOT STARTED.

## Using the Editor (Phase 1)

```text
Object Library (left) -> click an asset to place it at the viewport center
Canvas                -> click to select, drag to move, handles to resize/rotate,
                         drag empty area to pan, scroll to zoom
Toolbar               -> Select/Pan tools, Zoom In/Out, Grid + Snap toggles,
                         Duplicate/Delete (need a selection; delete asks to confirm)
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
| LocalStorage | MVP persistence (later phase) |
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
  domain/{models,constants}/ stores/ utils/
tests/
  unit/ components/ integration/ e2e/
public/assets/objects/
```
