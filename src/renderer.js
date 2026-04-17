/**
 * renderer.js
 *
 * Self-contained Blender node diagram SVG renderer.
 * Ported from the inline <script> in the specular blog post.
 *
 * Usage:
 *   import { renderDiagram } from './renderer';
 *   renderDiagram( svgElement, diagramData );
 *
 * diagramData shape:
 *   {
 *     nodes: [
 *       {
 *         id:      string,           // unique key
 *         type:    NodeType,         // controls header/body color
 *         label:   string,           // supports '\n' for two-line headers
 *         x:       number,           // left edge (diagram-space px)
 *         y:       number,           // top edge (diagram-space px)
 *         inputs:  Socket[],         // left-side sockets
 *         outputs: Socket[],         // right-side sockets
 *       },
 *       ...
 *     ],
 *     connections: [
 *       { from: nodeId, fromOut: outputIndex, to: nodeId, toIn: inputIndex },
 *       ...
 *     ]
 *   }
 *
 * NodeType values: 'geometry' | 'vectorMath' | 'math' | 'value' |
 *                  'emission' | 'output' | 'groupIn' | 'groupOut'
 *
 * Socket shape: { label: string, type: 'vector' | 'value' | 'shader' | 'color' }
 */

// ─── Layout constants ────────────────────────────────────────────────────────
const NS  = 'http://www.w3.org/2000/svg';
const NW  = 142;   // node width
const HH  = 22;    // header height
const SR  = 22;    // socket row height
const PV  = 8;     // vertical padding inside node body (above/below socket rows)
const SK  = 5;     // socket circle radius
const PAD = 20;    // canvas edge padding

// ─── Color palettes ──────────────────────────────────────────────────────────

/** @type {Record<string, { h: string, b: string }>} */
const NODE_COLORS = {
	geometry:   { h: '#2A5555', b: '#162828' },
	vectorMath: { h: '#253068', b: '#121638' },
	math:       { h: '#243E24', b: '#101A10' },
	value:      { h: '#3C3C3C', b: '#1E1E1E' },
	emission:   { h: '#3E2252', b: '#1A0E24' },
	output:     { h: '#2E1E1E', b: '#160E0E' },
	groupIn:    { h: '#3C2E0E', b: '#1E1608' },
	groupOut:   { h: '#3C2E0E', b: '#1E1608' },
};

/** @type {Record<string, string>} */
const SOCK_CLR = {
	vector: '#7878CC',
	value:  '#8E8E8E',
	shader: '#48AA80',
	color:  '#C8A840',
};

// ─── Geometry helpers ────────────────────────────────────────────────────────

/** Total height of a node based on its socket count. */
function nodeH( node ) {
	const rows = Math.max( node.inputs.length, node.outputs.length, 1 );
	return HH + PV + rows * SR + PV;
}

/** Canvas-space position of input socket i on a node. */
function inPos( node, i ) {
	return { x: node.x, y: node.y + HH + PV + i * SR + SR / 2 };
}

/** Canvas-space position of output socket i on a node. */
function outPos( node, i ) {
	return { x: node.x + NW, y: node.y + HH + PV + i * SR + SR / 2 };
}

/** Compute the bounding box of the whole diagram (used to set viewBox). */
function diagramBounds( diagram ) {
	let maxX = 0, maxY = 0;
	diagram.nodes.forEach( ( node ) => {
		maxX = Math.max( maxX, node.x + NW );
		maxY = Math.max( maxY, node.y + nodeH( node ) );
	} );
	return { width: maxX + PAD, height: maxY + PAD };
}

// ─── SVG element builders ────────────────────────────────────────────────────

/** Create an SVG element with given attributes. */
function el( tag, attrs ) {
	const e = document.createElementNS( NS, tag );
	for ( const [ k, v ] of Object.entries( attrs ) ) {
		e.setAttribute( k, v );
	}
	return e;
}

/** Create an SVG text node. */
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

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Render a diagram into the given SVG element.
 * The function clears any existing content, draws wires first (so they sit
 * behind nodes), then draws each node with its sockets and labels.
 * It also updates the SVG's viewBox and dimensions automatically.
 *
 * @param {SVGSVGElement} svgEl  - Target <svg> element (must already be in the DOM).
 * @param {object}        diagram - Diagram data object (nodes + connections).
 */
export function renderDiagram( svgEl, diagram ) {
	// Clear previous render
	while ( svgEl.firstChild ) {
		svgEl.removeChild( svgEl.firstChild );
	}

	// Auto-size the SVG to fit the diagram
	const { width, height } = diagramBounds( diagram );
	svgEl.setAttribute( 'viewBox', `0 0 ${ width } ${ height }` );
	svgEl.setAttribute( 'width', width );
	svgEl.setAttribute( 'height', height );

	// Build a lookup map for fast node access
	const nodeMap = {};
	diagram.nodes.forEach( ( n ) => ( nodeMap[ n.id ] = n ) );

	// ── Pass 1: wires (drawn under nodes) ────────────────────────────────────
	diagram.connections.forEach( ( conn ) => {
		const fNode = nodeMap[ conn.from ];
		const tNode = nodeMap[ conn.to ];
		if ( ! fNode || ! tNode ) return;

		const f     = outPos( fNode, conn.fromOut );
		const t     = inPos( tNode, conn.toIn );
		const color = SOCK_CLR[ fNode.outputs[ conn.fromOut ]?.type ] || '#888';
		const dx    = Math.max( 60, Math.abs( t.x - f.x ) * 0.42 );

		svgEl.appendChild(
			el( 'path', {
				d: `M ${ f.x } ${ f.y } C ${ f.x + dx } ${ f.y }, ${ t.x - dx } ${ t.y }, ${ t.x } ${ t.y }`,
				fill:           'none',
				stroke:         color,
				'stroke-width': '1.8',
				opacity:        '0.75',
			} )
		);
	} );

	// ── Pass 2: nodes ─────────────────────────────────────────────────────────
	diagram.nodes.forEach( ( node ) => {
		const colors = NODE_COLORS[ node.type ] || NODE_COLORS.value;
		const h      = nodeH( node );

		// Drop shadow
		svgEl.appendChild(
			el( 'rect', {
				x: node.x + 3, y: node.y + 3, width: NW, height: h,
				rx: '4', fill: 'rgba(0,0,0,0.45)',
			} )
		);

		// Body
		svgEl.appendChild(
			el( 'rect', {
				x: node.x, y: node.y, width: NW, height: h,
				rx: '4', fill: colors.b, stroke: '#2A2A2A', 'stroke-width': '1',
			} )
		);

		// Header background (rounded top, square bottom)
		svgEl.appendChild(
			el( 'rect', {
				x: node.x, y: node.y, width: NW, height: HH,
				rx: '4', fill: colors.h,
			} )
		);
		svgEl.appendChild(
			el( 'rect', {
				x: node.x, y: node.y + HH - 4, width: NW, height: 4,
				fill: colors.h,
			} )
		);

		// Node label — supports '\n' for two-line headers
		const lines = node.label.split( '\n' );
		const lh    = 11;
		lines.forEach( ( line, i ) => {
			const cy = node.y + HH / 2 + ( i - ( lines.length - 1 ) / 2 ) * lh + 4;
			svgEl.appendChild(
				txt( node.x + NW / 2, cy, line, {
					size:   lines.length > 1 ? '8' : '9.5',
					fill:   '#DDDDDD',
					anchor: 'middle',
					weight: '500',
				} )
			);
		} );

		// Input sockets (left side)
		node.inputs.forEach( ( sock, i ) => {
			const p = inPos( node, i );
			const c = SOCK_CLR[ sock.type ] || '#888';
			svgEl.appendChild(
				el( 'circle', { cx: p.x, cy: p.y, r: SK, fill: c, stroke: '#111', 'stroke-width': '1' } )
			);
			svgEl.appendChild( txt( p.x + SK + 4, p.y + 3.5, sock.label, { size: '9', fill: '#999' } ) );
		} );

		// Output sockets (right side)
		node.outputs.forEach( ( sock, i ) => {
			const p = outPos( node, i );
			const c = SOCK_CLR[ sock.type ] || '#888';
			svgEl.appendChild(
				el( 'circle', { cx: p.x, cy: p.y, r: SK, fill: c, stroke: '#111', 'stroke-width': '1' } )
			);
			svgEl.appendChild(
				txt( p.x - SK - 4, p.y + 3.5, sock.label, { size: '9', fill: '#999', anchor: 'end' } )
			);
		} );
	} );
}
