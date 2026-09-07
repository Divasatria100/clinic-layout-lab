# Clinic Layout Lab

Prototype: visual editor (Konva.js) producing structured layout + navigation data for a simulation engine.

> Environment setup only. Phase 1–6 are NOT STARTED.

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
