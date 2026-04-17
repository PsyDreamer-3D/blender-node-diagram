/**
 * node-layout.js
 *
 * Single source of truth for all node geometry constants and layout helpers.
 * Both renderer.js (imperative SVG) and interactive-diagram.js (React JSX)
 * import from here so they always agree on node sizes and socket positions.
 *
 * Adding a new node type with extra body content:
 *   1. Add it to NODE_EXTRA_H with the pixel amount it needs.
 *   2. Everything else (nodeH, inPos, outPos) adjusts automatically.
 */

// ─── Canvas constants ─────────────────────────────────────────────────────────
export const NW  = 142;   // node width (px)
export const HH  = 22;    // header height
export const SR  = 22;    // socket row height
export const PV  = 8;     // vertical body padding (above + below socket rows)
export const SK  = 5;     // socket circle radius (normal)
export const PAD = 20;    // canvas edge clearance

// ─── Node colour palettes ─────────────────────────────────────────────────────
// Each entry: { h: headerFill, b: bodyFill }
export const NODE_COLORS = {
	geometry:   { h: '#2A5555', b: '#162828' },
	vectorMath: { h: '#253068', b: '#121638' },
	math:       { h: '#243E24', b: '#101A10' },
	value:      { h: '#3C3C3C', b: '#1E1E1E' },
	emission:   { h: '#3E2252', b: '#1A0E24' },
	output:     { h: '#2E1E1E', b: '#160E0E' },
	groupIn:    { h: '#3C2E0E', b: '#1E1608' },
	groupOut:   { h: '#3C2E0E', b: '#1E1608' },
	// ── New ──
	colorRamp:  { h: '#3A285A', b: '#1C1028' },  // purple  (Blender: Converter)
	mixColor:   { h: '#5A3820', b: '#2A1A0C' },  // amber   (Blender: Color)
};

// ─── Socket / wire colours ────────────────────────────────────────────────────
export const SOCK_CLR = {
	vector: '#7878CC',
	value:  '#8E8E8E',
	shader: '#48AA80',
	color:  '#C8A840',
};

// ─── Extra body height for specialised node types ─────────────────────────────
// These pixels are inserted between the header and the first socket row and
// are used to display the gradient bar (colorRamp) or blend-mode pill (mixColor).
const NODE_EXTRA_H = {
	colorRamp: 30,   // 6px pad + 16px gradient bar + 8px pad
	mixColor:  26,   // 5px pad + 16px blend-mode pill + 5px pad
};

/** Extra body pixels for this node type (0 if none). */
export function nodeExtraH( node ) {
	return NODE_EXTRA_H[ node.type ] ?? 0;
}

/** Total rendered height of a node. */
export function nodeH( node ) {
	const rows = Math.max( node.inputs.length, node.outputs.length, 1 );
	return HH + PV + nodeExtraH( node ) + rows * SR + PV;
}

/** SVG position of input socket i (left edge). */
export function inPos( node, i ) {
	return {
		x: node.x,
		y: node.y + HH + PV + nodeExtraH( node ) + i * SR + SR / 2,
	};
}

/** SVG position of output socket i (right edge). */
export function outPos( node, i ) {
	return {
		x: node.x + NW,
		y: node.y + HH + PV + nodeExtraH( node ) + i * SR + SR / 2,
	};
}

// ─── Color Ramp helpers ───────────────────────────────────────────────────────

/** Default stops when none are specified on the node. */
export const DEFAULT_RAMP_STOPS = [
	{ pos: 0.0, color: '#000000' },
	{ pos: 1.0, color: '#ffffff' },
];

/** Geometry of the gradient bar inside a colorRamp node. */
export function rampBarRect( node ) {
	return {
		x: node.x + 8,
		y: node.y + HH + 6,
		w: NW - 16,
		h: 14,
	};
}

// ─── Mix Color helpers ────────────────────────────────────────────────────────

export const MIX_BLEND_MODES = [
	'Mix', 'Darken', 'Multiply', 'Burn',
	'Lighten', 'Screen', 'Dodge', 'Add',
	'Overlay', 'Soft Light', 'Linear Light',
	'Difference', 'Exclusion', 'Subtract', 'Divide',
	'Hue', 'Saturation', 'Color', 'Value',
];

/** Geometry of the blend-mode pill inside a mixColor node. */
export function mixPillRect( node ) {
	return {
		x: node.x + 16,
		y: node.y + HH + 5,
		w: NW - 32,
		h: 16,
	};
}

// ─── Default color swatch helpers ─────────────────────────────────────────────

/**
 * Width of the default-color swatch drawn inside input socket rows.
 * Label text starts this many px further right when a swatch is present.
 */
export const SWATCH_W  = 20;
export const SWATCH_H  = 8;
export const SWATCH_GAP = 4;  // gap between socket dot and swatch
