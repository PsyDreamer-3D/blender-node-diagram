# Blender Node Diagram — WordPress Block Plugin

Two Gutenberg blocks for rendering Blender shader node diagrams as interactive,
scrollable SVGs. Ships with three Blinn-Phong presets, a full-screen visual
diagram builder for custom node networks, and a static N/L/V/H concept
illustration block.

**No build step required to use.** The `build/` folder is included in the zip.
Just activate and use.

---

## Blocks

### 1. Blender Node Diagram  (`blender-node-diagram/diagram`)

A data-driven SVG renderer. Three preset **variations** appear directly in the
block inserter under the Media category:

| Variation              | Preset key | Diagram width |
|------------------------|------------|---------------|
| Blinn-Phong Node Chain | `blinn`    | ~1 710 px     |
| Sharpness Sub-Network  | `sharp`    | ~930 px       |
| Full NPR Glossy Group  | `group`    | ~2 260 px     |

All diagrams scroll horizontally inside a dot-grid container that matches
Blender's node editor aesthetic. The frontend renderer (`view.js`) is **only
enqueued on pages that contain the block** — no overhead on unrelated pages.

Switching the type to **Custom (JSON)** adds two options in the inspector:

- **Open Diagram Builder** — full-screen visual node editor (see below)
- **Raw JSON textarea** — paste/edit the `{ nodes, connections }` object directly

### 2. Blinn-Phong Vector Diagram  (`blender-node-diagram/concept`)

A static illustration of the N, L, V, H vector geometry at a shading point.
The SVG is embedded directly in the post HTML at save time — no frontend script
needed. The only editable attribute is the caption text.

---

## Diagram Builder

The visual editor opens full-screen as a WordPress Modal.

```
┌─ Left panel (380 px) ────────────┬─ Right panel (flex) ───────────────┐
│  NODES  (3)        [Auto-layout] │                                    │
│  ┌────────────────────────────┐  │   Live dot-grid SVG preview        │
│  │ geo  (geometry)  [Edit][✕] │  │   Re-renders in real-time as       │
│  │  ▾ accordion edit form     │  │   you edit each node               │
│  │    ID / Type / Label / X,Y │  │                                    │
│  │    Inputs  [+ Add]         │  │                                    │
│  │    Outputs [+ Add]         │  │                                    │
│  └────────────────────────────┘  │                                    │
│                                  │                                    │
│  CONNECTIONS  (2)                │                                    │
│  geo[0] → dot[0]           [✕]   │                                    │
│  ┌─ Add Connection ───────────┐  │                                    │
│  │  From node  Out #          │  │                                    │
│  │  To node    In  #   [Add]  │  │                                    │
│  └────────────────────────────┘  │                                    │
├──────────────────────────────────┴────────────────────────────────────┤
│  3 nodes / 2 connections                  [Cancel]  [Apply to Block]  │
└───────────────────────────────────────────────────────────────────────┘
```

**Editing a node** opens an accordion form covering:
- **ID** — the string key used in connections
- **Type** — controls header colour
- **Label** — use `\n` for a two-line header
- **X / Y** — explicit position (Auto-layout resets these)
- **Input / Output sockets** — label + type selector with a live colour dot

**Auto-layout** runs topological BFS and spaces nodes left-to-right by
connection depth (190 px horizontal, 160 px vertical per slot).

**Add Connection** validates that the output/input indices are in range before
adding, and reports the error inline if they are not.

**Apply to Block** writes the finished JSON to `customData` and closes the
modal. The in-editor SVG preview updates immediately.

---

## Custom JSON format

```jsonc
{
  "nodes": [
    {
      "id":      "geo",
      "type":    "geometry",
      "label":   "Geometry",
      "x":       10,
      "y":       80,
      "inputs":  [],
      "outputs": [
        { "label": "Normal",   "type": "vector" },
        { "label": "Incoming", "type": "vector" }
      ]
    }
  ],
  "connections": [
    { "from": "geo", "fromOut": 0, "to": "dot", "toIn": 0 }
  ]
}
```

### Node types → header colours

| `type`       | Colour   |
|--------------|----------|
| `geometry`   | Teal     |
| `vectorMath` | Blue     |
| `math`       | Green    |
| `value`      | Grey     |
| `emission`   | Purple   |
| `output`     | Dark red |
| `groupIn`    | Amber    |
| `groupOut`   | Amber    |

### Socket types → wire colours

| `type`   | Colour |
|----------|--------|
| `vector` | Purple |
| `value`  | Grey   |
| `shader` | Green  |
| `color`  | Gold   |

---

## Installation (no build step needed)

1. Download `blender-node-diagram.zip`
2. WordPress admin → Plugins → Add New → Upload Plugin
3. Activate

---

## Development

```bash
npm install
npm run build   # production build → build/
npm run start   # watch mode
```

Requires Node.js 20+.

### File structure

```
blender-node-diagram/
├── blender-node-diagram.php   Plugin entry — registers both blocks
├── block.json                 Diagram block metadata
├── concept-block.json         Concept block metadata
├── package.json
├── webpack.config.js
├── src/
│   ├── index.js               Block registration + variation declarations
│   ├── edit.js                Diagram block editor component
│   ├── save.js                Diagram block save function
│   ├── view.js                Frontend renderer init
│   ├── renderer.js            SVG rendering engine (no WP dependencies)
│   ├── diagrams.js            Preset data + getDiagramData()
│   ├── constants.js           Node/socket type maps and colours
│   ├── diagram-builder.js     Full-screen visual diagram builder modal
│   ├── concept-edit.js        Concept block editor component
│   ├── concept-save.js        Concept block save function
│   ├── concept-svg.js         Static N/L/V/H SVG as a React component
│   ├── frontend.css           Shared styles (frontend + editor canvas)
│   └── editor.css             Editor-only overrides
└── build/                     Pre-built; included in zip
    ├── index.js               Editor bundle (~31 KB)
    ├── view.js                Frontend bundle (~10 KB)
    ├── frontend.css           Shared styles
    ├── frontend-rtl.css       RTL variant
    ├── editor.css             Editor-only styles
    └── *.asset.php            WordPress dependency manifests
```

### Adding a new preset

1. Export the diagram data object from `src/diagrams.js` and add it to `PRESETS`.
2. Add a `registerBlockVariation` call in `src/index.js`.
3. `npm run build`.

### Using the renderer standalone

`src/renderer.js` has zero WordPress or React dependencies:

```js
import { renderDiagram } from './renderer';
renderDiagram( svgElement, { nodes: [...], connections: [...] } );
```

---

## Requirements

- WordPress 6.3+  
- PHP 8.0+  
- Node.js 20+ (development only)
