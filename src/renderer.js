/**
 * renderer.js
 *
 * Self-contained Blender node diagram SVG renderer (imperative DOM API).
 * Used by the frontend view script and the static editor preview.
 *
 * Supported node types:
 *   geometry | vectorMath | math | value | emission | output |
 *   groupIn  | groupOut   | colorRamp | mixColor
 *
 * Extended node data for specialised types:
 *
 *   colorRamp nodes accept an optional `rampStops` array:
 *     rampStops: [
 *       { pos: 0.0, color: '#000000' },
 *       { pos: 0.5, color: '#ff8800' },
 *       { pos: 1.0, color: '#ffffff' },
 *     ]
 *   Defaults to black → white if omitted.
 *
 *   mixColor nodes accept an optional `blendMode` string:
 *     blendMode: 'Multiply'
 *   Defaults to 'Mix' if omitted.
 */

import {
	NW, HH, SK, PAD,
	NODE_COLORS, SOCK_CLR,
	nodeH, inPos, outPos,
	DEFAULT_RAMP_STOPS, rampBarRect,
	mixPillRect,
	SWATCH_W, SWATCH_H, SWATCH_GAP,
} from './node-layout';

const NS = 'http://www.w3.org/2000/svg';

// ─── SVG element builders ─────────────────────────────────────────────────────

function el( tag, attrs ) {
	const e = document.createElementNS( NS, tag );
	for ( const [ k, v ] of Object.entries( attrs ) ) e.setAttribute( k, v );
	return e;
}

function txt( x, y, content, opts = {} ) {
	const t = document.createElementNS( NS, 'text' );
	t.setAttribute( 'x', x );
	t.setAttribute( 'y', y );
	t.setAttribute( 'font-family', 'JetBrains Mono, monospace' );
	t.setAttribute( 'font-size', opts.size || '9' );
	t.setAttribute( 'fill', opts.fill || '#AAAAAA' );
	if ( opts.anchor ) t.setAttribute( 'text-anchor', opts.anchor );
	if ( opts.weight ) t.setAttribute( 'font-weight', opts.weight );
	t.textContent = content;
	return t;
}

// ─── Bounds ───────────────────────────────────────────────────────────────────

function diagramBounds( diagram ) {
	let maxX = 0, maxY = 0;
	diagram.nodes.forEach( ( n ) => {
		maxX = Math.max( maxX, n.x + NW );
		maxY = Math.max( maxY, n.y + nodeH( n ) );
	} );
	return { width: maxX + PAD, height: maxY + PAD };
}

// ─── Special node extras ──────────────────────────────────────────────────────

/**
 * Render the Color Ramp gradient bar into svgEl.
 * Adds a <linearGradient> def to `defs` so it can be referenced by fill url().
 */
function renderColorRamp( svgEl, defs, node ) {
	const stops  = node.rampStops?.length ? node.rampStops : DEFAULT_RAMP_STOPS;
	const gradId = `ramp-${ node.id.replace( /[^a-zA-Z0-9]/g, '_' ) }`;
	const bar    = rampBarRect( node );

	// ── Gradient definition ──
	const grad = el( 'linearGradient', { id: gradId, x1: '0%', y1: '0%', x2: '100%', y2: '0%' } );
	stops.forEach( ( s ) => {
		const stop = el( 'stop', {
			offset:         `${ Math.round( s.pos * 100 ) }%`,
			'stop-color':   s.color,
			'stop-opacity': s.alpha ?? 1,
		} );
		grad.appendChild( stop );
	} );
	defs.appendChild( grad );

	// ── Dark backing (visible through transparent stops) ──
	svgEl.appendChild( el( 'rect', {
		x: bar.x, y: bar.y, width: bar.w, height: bar.h,
		rx: '2', fill: '#1A1A1A',
	} ) );

	// ── Gradient bar ──
	svgEl.appendChild( el( 'rect', {
		x: bar.x, y: bar.y, width: bar.w, height: bar.h,
		rx: '2', fill: `url(#${ gradId })`,
		stroke: '#2A2A2A', 'stroke-width': '0.5',
	} ) );

	// ── Stop markers (small white triangles below bar) ──
	stops.forEach( ( s ) => {
		const mx = bar.x + s.pos * bar.w;
		svgEl.appendChild( el( 'polygon', {
			points: `${ mx },${ bar.y + bar.h + 1 } ${ mx - 3 },${ bar.y + bar.h + 6 } ${ mx + 3 },${ bar.y + bar.h + 6 }`,
			fill: '#CCCCCC',
		} ) );
	} );
}

/**
 * Render the Mix Color blend-mode pill into svgEl.
 */
function renderMixColor( svgEl, node ) {
	const mode = node.blendMode ?? 'Mix';
	const pill = mixPillRect( node );

	// Pill background
	svgEl.appendChild( el( 'rect', {
		x: pill.x, y: pill.y, width: pill.w, height: pill.h,
		rx: '3', fill: '#111111', stroke: '#333333', 'stroke-width': '0.5',
	} ) );

	// Blend mode label
	svgEl.appendChild( txt(
		pill.x + pill.w / 2,
		pill.y + pill.h / 2 + 3.5,
		mode,
		{ size: '8.5', fill: '#BBBBBB', anchor: 'middle' }
	) );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Render a diagram into the given SVG element.
 * Clears existing content, auto-sizes the viewBox, draws wires then nodes.
 *
 * @param {SVGSVGElement} svgEl
 * @param {object}        diagram  — { nodes, connections }
 */
export function renderDiagram( svgEl, diagram ) {
	// Clear
	while ( svgEl.firstChild ) svgEl.removeChild( svgEl.firstChild );

	// Size
	const { width, height } = diagramBounds( diagram );
	svgEl.setAttribute( 'viewBox', `0 0 ${ width } ${ height }` );
	svgEl.setAttribute( 'width',   width  );
	svgEl.setAttribute( 'height',  height );

	// <defs> — gradient definitions go here
	const defs = el( 'defs', {} );
	svgEl.appendChild( defs );

	// Node lookup
	const nodeMap = {};
	diagram.nodes.forEach( ( n ) => ( nodeMap[ n.id ] = n ) );

	// ── Pass 1: wires ─────────────────────────────────────────────────────────
	diagram.connections.forEach( ( conn ) => {
		const fNode = nodeMap[ conn.from ];
		const tNode = nodeMap[ conn.to ];
		if ( ! fNode || ! tNode ) return;

		const f     = outPos( fNode, conn.fromOut );
		const t     = inPos(  tNode, conn.toIn    );
		const color = SOCK_CLR[ fNode.outputs[ conn.fromOut ]?.type ] || '#888';
		const dx    = Math.max( 60, Math.abs( t.x - f.x ) * 0.42 );

		svgEl.appendChild( el( 'path', {
			d:              `M ${ f.x } ${ f.y } C ${ f.x + dx } ${ f.y }, ${ t.x - dx } ${ t.y }, ${ t.x } ${ t.y }`,
			fill:           'none',
			stroke:         color,
			'stroke-width': '1.8',
			opacity:        '0.75',
		} ) );
	} );

	// ── Pass 2: nodes ─────────────────────────────────────────────────────────
	diagram.nodes.forEach( ( node ) => {
		const colors = NODE_COLORS[ node.type ] || NODE_COLORS.value;
		const h      = nodeH( node );

		// Drop shadow
		svgEl.appendChild( el( 'rect', {
			x: node.x + 3, y: node.y + 3, width: NW, height: h,
			rx: '4', fill: 'rgba(0,0,0,0.45)',
		} ) );

		// Body
		svgEl.appendChild( el( 'rect', {
			x: node.x, y: node.y, width: NW, height: h,
			rx: '4', fill: colors.b, stroke: '#2A2A2A', 'stroke-width': '1',
		} ) );

		// Header
		svgEl.appendChild( el( 'rect', {
			x: node.x, y: node.y, width: NW, height: HH,
			rx: '4', fill: colors.h,
		} ) );
		// Square off header bottom
		svgEl.appendChild( el( 'rect', {
			x: node.x, y: node.y + HH - 4, width: NW, height: 4,
			fill: colors.h,
		} ) );

		// Label (supports \n for two-line headers)
		const lines = node.label.split( '\n' );
		const lh    = 11;
		lines.forEach( ( line, i ) => {
			const cy = node.y + HH / 2 + ( i - ( lines.length - 1 ) / 2 ) * lh + 4;
			svgEl.appendChild( txt( node.x + NW / 2, cy, line, {
				size:   lines.length > 1 ? '8' : '9.5',
				fill:   '#DDDDDD',
				anchor: 'middle',
				weight: '500',
			} ) );
		} );

		// ── Type-specific extras ──────────────────────────────────────────────
		if ( node.type === 'colorRamp' ) renderColorRamp( svgEl, defs, node );
		if ( node.type === 'mixColor'  ) renderMixColor(  svgEl, node );

		// ── Input sockets ─────────────────────────────────────────────────────
		// ── Input sockets ───────────────────────────────────────────
		node.inputs.forEach( ( sock, i ) => {
			const p         = inPos( node, i );
			const c         = SOCK_CLR[ sock.type ] || '#888';
			const hasSwatch = sock.type === 'color' && sock.defaultColor;

			// Socket dot
			svgEl.appendChild( el( 'circle', { cx: p.x, cy: p.y, r: SK, fill: c, stroke: '#111', 'stroke-width': '1' } ) );

			// Default-color swatch (color sockets with a defaultColor set)
			if ( hasSwatch ) {
				const sx = p.x + SK + SWATCH_GAP;
				const sy = p.y - SWATCH_H / 2;
				svgEl.appendChild( el( 'rect', { x: sx - 0.5, y: sy - 0.5, width: SWATCH_W + 1, height: SWATCH_H + 1, rx: '2', fill: '#111' } ) );
				svgEl.appendChild( el( 'rect', { x: sx,       y: sy,       width: SWATCH_W,     height: SWATCH_H,     rx: '1.5', fill: sock.defaultColor } ) );
			}

			// Label — shifted right to clear the swatch when present
			const labelX = hasSwatch
				? p.x + SK + SWATCH_GAP + SWATCH_W + SWATCH_GAP
				: p.x + SK + 4;
			svgEl.appendChild( txt( labelX, p.y + 3.5, sock.label, { size: '9', fill: '#999' } ) );
		} );
		// ── Output sockets ────────────────────────────────────────────────────
		node.outputs.forEach( ( sock, i ) => {
			const p = outPos( node, i );
			const c = SOCK_CLR[ sock.type ] || '#888';
			svgEl.appendChild( el( 'circle', { cx: p.x, cy: p.y, r: SK, fill: c, stroke: '#111', 'stroke-width': '1' } ) );
			svgEl.appendChild( txt( p.x - SK - 4, p.y + 3.5, sock.label, { size: '9', fill: '#999', anchor: 'end' } ) );
		} );
	} );
}
