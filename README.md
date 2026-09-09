# Clinic Layout Lab

A technical prototype for exploring and validating **Konva.js** as an interactive, data-driven spatial editor.

The project transforms visual canvas interactions into structured layout and navigation data, which are then used for patient movement simulation, movement data collection, spatial analysis, and heatmap visualization.

## Overview

```text
Visual Editor
      ↓
Layout Data
      ↓
Navigation Path
      ↓
Patient Simulation
      ↓
Movement Data
      ↓
Movement Analysis
      ↓
Heatmap
```

## Features

```text
Object Library (left) -> click an asset to place it at the viewport center

Canvas                -> click to select, drag to move, handles to resize/rotate,
                         drag empty area to pan, scroll to zoom

Toolbar               -> Select/Pan tools, Zoom In/Out, Grid + Snap toggles,
                         Duplicate/Delete, Save/Load/Reset Layout

Path mode             -> connect two objects to create a navigation path,
                         edit waypoints by dragging, double-click segments
                         to insert waypoints, double-click waypoints to remove
                         them, with endpoints bound to their referenced objects

Simulation mode       -> configure 1-10 patients and simulate movement along
                         navigation paths using a fixed simulation clock,
                         with independent patient agents and movement records

Analysis mode         -> derive spatial density from movement records and
                         visualize it as a heatmap with configurable opacity
                         and density information

Inspector (right)     -> precise X/Y/Width/Height/Rotation editing

Status bar (bottom)   -> zoom %, grid/snap state, and object count
```

## Data Flow

The application separates visual editing, structured data, simulation, and analysis into distinct stages:

```text
Layout State
     ↓
Navigation Graph
     ↓
Patient Agents
     ↓
Movement Records
     ↓
Spatial Aggregation
     ↓
Heatmap
```

Layout and navigation data can be persisted using browser LocalStorage, while simulation and analysis data are derived during runtime.

## Asset Generation

Placeholder object assets are stored in:

```text
public/assets/objects/
```

Assets can be regenerated with:

```bash
npm run generate:assets
```

## Tech Stack

| Technology             | Purpose                                 |
| ---------------------- | --------------------------------------- |
| JavaScript             | Primary programming language            |
| React                  | Frontend application framework          |
| Vite                   | Build and development tool              |
| Konva.js + react-konva | Canvas rendering and interaction        |
| Tailwind CSS           | UI styling                              |
| Zustand                | Application and editor state management |
| LocalStorage           | Client-side persistence                 |
| Vitest                 | Unit and integration testing            |
| React Testing Library  | React component testing                 |

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
npm run test
npm run test:watch
```

## Build

```bash
npm run build
npm run preview
```

## Project Structure

```text
src/
  app/
  components/
    ui/
    layout/
    canvas/
  features/
    editor/
    layout/
    navigation/
    simulation/
    analysis/
    heatmap/
  domain/
    models/
    constants/
  stores/
  services/
  persistence/
  utils/

tests/
  unit/
  components/
  integration/
  e2e/

public/
  assets/
    objects/
```

## Project Goal

Clinic Layout Lab is built as a **technical proof-of-concept** to evaluate how visual editing, structured spatial data, navigation paths, simulation, and spatial analysis can be combined into a single browser-based application using Konva.js.
