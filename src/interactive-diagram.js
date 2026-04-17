/**
 * interactive-diagram.js
 *
 * React component that renders a Blender node diagram as a fully interactive SVG.
 *
 * Interactions:
 *   Drag node header   → reposition node (onNodeMove)
 *   Click node header  → select / open accordion (onNodeSelect)
 *   Drag output socket → draw a bezier wire; drop on input socket to connect (onConnect)
 *   Hover sockets      → highlight compatible drop targets while wiring
 *
 * Props:
 *   nodes          {Array}    Committed nodes (with live draft merged in by parent)
 *   connections    {Array}    Connection array
 *   editingId      {string}   ID of the node whose accordion is open (amber outline)
 *   onNodeMove     {Function} (id, x, y) — called during drag
 *   onNodeSelect   {Function} (id)        — called on header click
 *   onConnect      {Function} (fromId, fromOut, toId, toIn) — called on successful wire drop
 */

import { useState, useRef, useCallback, useMemo } from '@wordpress/element';

// ─── Layout constants ─────────────────────────────────────────────────────────
const NW  = 142;
const HH  = 22;
const SR  = 22;
const PV  = 8;
const SK  = 5;       // socket radius (normal)
const SK_HOV = 7;    // socket radius (hovered / active)
const PAD = 32;

// ─── Colour tables ────────────────────────────────────────────────────────────
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

const SOCK_CLR = {
	vector: '#7878CC',
	value:  '#8E8E8E',
	shader: '#48AA80',
	color:  '#C8A840',
};

// ─── Geometry helpers ─────────────────────────────────────────────────────────
function nodeH( node ) {
	return HH + PV + Math.max( node.inputs.length, node.outputs.length, 1 ) * SR + PV;
}
function inPos( node, i ) {
	return { x: node.x,      y: node.y + HH + PV + i * SR + SR / 2 };
}
function outPos( node, i ) {
	return { x: node.x + NW, y: node.y + HH + PV + i * SR + SR / 2 };
}

// ─── Bezier path between two points ──────────────────────────────────────────
function wirePath( x1, y1, x2, y2 ) {
	const dx = Math.max( 60, Math.abs( x2 - x1 ) * 0.42 );
	return `M ${ x1 } ${ y1 } C ${ x1 + dx } ${ y1 }, ${ x2 - dx } ${ y2 }, ${ x2 } ${ y2 }`;
}

// ─── Wire (committed connection) ──────────────────────────────────────────────
function Wire( { conn, nodeMap } ) {
	const fNode = nodeMap[ conn.from ];
	const tNode = nodeMap[ conn.to ];
	if ( ! fNode || ! tNode ) return null;

	const f     = outPos( fNode, conn.fromOut );
	const t     = inPos(  tNode, conn.toIn    );
	const color = SOCK_CLR[ fNode.outputs[ conn.fromOut ]?.type ] ?? '#888';

	return (
		<path
			d={ wirePath( f.x, f.y, t.x, t.y ) }
			fill="none" stroke={ color }
			strokeWidth="1.8" opacity="0.75"
			style={ { pointerEvents: 'none' } }
		/>
	);
}

// ─── NodeGroup ────────────────────────────────────────────────────────────────
function NodeGroup( {
	node,
	isEditing,
	isDragging,
	onHeaderMouseDown,
	onHeaderClick,
	// Socket wiring
	pendingWireType,        // type string if a wire is being dragged, else null
	onOutputSocketMouseDown, // (e, nodeId, idx, type, svgX, svgY)
	onInputSocketMouseUp,    // (e, nodeId, idx)
} ) {
	const colors    = NODE_COLORS[ node.type ] ?? NODE_COLORS.value;
	const h         = nodeH( node );
	const ringColor = isEditing  ? '#E07840'
	                : isDragging ? '#5A8AEE'
	                : 'transparent';

	return (
		<g style={ { userSelect: 'none' } }>
			{/* Drop shadow */}
			<rect x={ node.x + 3 } y={ node.y + 3 } width={ NW } height={ h }
				rx="4" fill="rgba(0,0,0,0.45)" style={ { pointerEvents: 'none' } } />

			{/* Body */}
			<rect x={ node.x } y={ node.y } width={ NW } height={ h }
				rx="4" fill={ colors.b }
				stroke={ ringColor }
				strokeWidth={ isEditing || isDragging ? 1.5 : 1 }
				style={ { pointerEvents: 'none' } }
			/>

			{/* Header — drag + click target */}
			<rect x={ node.x } y={ node.y } width={ NW } height={ HH }
				rx="4" fill={ colors.h }
				style={ { cursor: isDragging ? 'grabbing' : 'grab' } }
				onMouseDown={ ( e ) => onHeaderMouseDown( e, node.id, node.x, node.y ) }
				onClick={ () => onHeaderClick( node.id ) }
			/>
			<rect x={ node.x } y={ node.y + HH - 4 } width={ NW } height={ 4 }
				fill={ colors.h } style={ { pointerEvents: 'none' } } />

			{/* Node label */}
			{ node.label.split( '\n' ).map( ( line, i, arr ) => {
				const lh = 11;
				const cy = node.y + HH / 2 + ( i - ( arr.length - 1 ) / 2 ) * lh + 4;
				return (
					<text key={ i }
						x={ node.x + NW / 2 } y={ cy }
						fontFamily="JetBrains Mono, monospace"
						fontSize={ arr.length > 1 ? 8 : 9.5 }
						fontWeight="500" fill="#DDDDDD" textAnchor="middle"
						style={ { pointerEvents: 'none' } }>
						{ line }
					</text>
				);
			} ) }

			{/* ── Input sockets (left side) ─────────────────────────────────── */}
			{ node.inputs.map( ( sock, i ) => {
				const p        = inPos( node, i );
				const baseColor = SOCK_CLR[ sock.type ] ?? '#888';
				// Highlight if a wire of matching type is being dragged toward us
				const isTarget  = pendingWireType !== null && pendingWireType === sock.type;
				const isAnyWire = pendingWireType !== null;
				const r         = isTarget ? SK_HOV : SK;
				const stroke    = isTarget ? '#fff' : '#111';
				const opacity   = isAnyWire && ! isTarget ? 0.35 : 1;

				return (
					<g key={ i }>
						{/* Larger invisible hit area for easier dropping */}
						<circle cx={ p.x } cy={ p.y } r={ SK_HOV + 4 }
							fill="transparent"
							style={ { cursor: isAnyWire ? 'cell' : 'default' } }
							onMouseUp={ ( e ) => onInputSocketMouseUp( e, node.id, i ) }
						/>
						<circle cx={ p.x } cy={ p.y } r={ r }
							fill={ baseColor } stroke={ stroke } strokeWidth="1"
							opacity={ opacity }
							style={ { pointerEvents: 'none' } }
						/>
						{ isTarget && (
							/* Glow ring */
							<circle cx={ p.x } cy={ p.y } r={ SK_HOV + 3 }
								fill="none" stroke={ baseColor }
								strokeWidth="1.5" opacity="0.45"
								style={ { pointerEvents: 'none' } }
							/>
						) }
						<text x={ p.x + SK + 4 } y={ p.y + 3.5 }
							fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#999"
							opacity={ opacity }
							style={ { pointerEvents: 'none' } }>
							{ sock.label }
						</text>
					</g>
				);
			} ) }

			{/* ── Output sockets (right side) ───────────────────────────────── */}
			{ node.outputs.map( ( sock, i ) => {
				const p         = outPos( node, i );
				const baseColor = SOCK_CLR[ sock.type ] ?? '#888';
				const isSource  = ! pendingWireType;  // can start a wire if nothing in-flight

				return (
					<g key={ i }>
						{/* Larger invisible hit area */}
						<circle cx={ p.x } cy={ p.y } r={ SK_HOV + 4 }
							fill="transparent"
							style={ { cursor: isSource ? 'crosshair' : 'not-allowed' } }
							onMouseDown={ ( e ) =>
								isSource && onOutputSocketMouseDown( e, node.id, i, sock.type, p.x, p.y )
							}
						/>
						<circle cx={ p.x } cy={ p.y } r={ SK }
							fill={ baseColor } stroke="#111" strokeWidth="1"
							style={ { pointerEvents: 'none' } }
						/>
						<text x={ p.x - SK - 4 } y={ p.y + 3.5 }
							fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#999"
							textAnchor="end"
							style={ { pointerEvents: 'none' } }>
							{ sock.label }
						</text>
					</g>
				);
			} ) }
		</g>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function InteractiveDiagram( {
	nodes,
	connections,
	editingId,
	onNodeMove,
	onNodeSelect,
	onConnect,
} ) {
	const svgRef = useRef( null );

	// Drag state for node repositioning
	const [ dragState,    setDragState    ] = useState( null );
	// { nodeId, startSvgX, startSvgY, startNodeX, startNodeY }

	// Pending wire state for socket connection
	const [ pendingWire,  setPendingWire  ] = useState( null );
	// { fromId, fromOut, type, x1, y1, x2, y2 }

	// ── SVG coordinate helper ────────────────────────────────────────────────
	const toSVGPoint = useCallback( ( e ) => {
		const svg = svgRef.current;
		if ( ! svg ) return { x: 0, y: 0 };
		const pt = svg.createSVGPoint();
		pt.x = e.clientX;
		pt.y = e.clientY;
		return pt.matrixTransform( svg.getScreenCTM().inverse() );
	}, [] );

	// ── Node drag ────────────────────────────────────────────────────────────
	const handleHeaderMouseDown = useCallback( ( e, nodeId, nodeX, nodeY ) => {
		if ( pendingWire ) return;   // don't start a drag while wiring
		e.preventDefault();
		e.stopPropagation();
		const pt = toSVGPoint( e );
		setDragState( { nodeId, startSvgX: pt.x, startSvgY: pt.y, startNodeX: nodeX, startNodeY: nodeY } );
	}, [ pendingWire, toSVGPoint ] );

	// ── Output socket mousedown → begin wire ─────────────────────────────────
	const handleOutputSocketMouseDown = useCallback( ( e, nodeId, socketIdx, socketType, svgX, svgY ) => {
		e.preventDefault();
		e.stopPropagation();   // prevent triggering header drag
		setPendingWire( { fromId: nodeId, fromOut: socketIdx, type: socketType, x1: svgX, y1: svgY, x2: svgX, y2: svgY } );
	}, [] );

	// ── Input socket mouseup → complete wire ─────────────────────────────────
	const handleInputSocketMouseUp = useCallback( ( e, nodeId, socketIdx ) => {
		if ( ! pendingWire ) return;
		e.stopPropagation();
		// Don't allow self-connections
		if ( pendingWire.fromId !== nodeId ) {
			onConnect( pendingWire.fromId, pendingWire.fromOut, nodeId, socketIdx );
		}
		setPendingWire( null );
	}, [ pendingWire, onConnect ] );

	// ── Mouse move → update drag position OR wire endpoint ───────────────────
	const handleMouseMove = useCallback( ( e ) => {
		const pt = toSVGPoint( e );
		if ( dragState ) {
			const x = Math.round( dragState.startNodeX + ( pt.x - dragState.startSvgX ) );
			const y = Math.round( dragState.startNodeY + ( pt.y - dragState.startSvgY ) );
			onNodeMove( dragState.nodeId, x, y );
		}
		if ( pendingWire ) {
			setPendingWire( ( pw ) => pw ? { ...pw, x2: pt.x, y2: pt.y } : pw );
		}
	}, [ dragState, pendingWire, toSVGPoint, onNodeMove ] );

	// ── Mouse up / leave → release everything ────────────────────────────────
	const handleRelease = useCallback( () => {
		setDragState( null );
		setPendingWire( null );
	}, [] );

	// ── ViewBox ───────────────────────────────────────────────────────────────
	const { vbWidth, vbHeight } = useMemo( () => {
		let maxX = 400, maxY = 200;
		nodes.forEach( ( n ) => {
			maxX = Math.max( maxX, n.x + NW );
			maxY = Math.max( maxY, n.y + nodeH( n ) );
		} );
		return { vbWidth: maxX + PAD, vbHeight: maxY + PAD };
	}, [ nodes ] );

	// ── Node lookup ───────────────────────────────────────────────────────────
	const nodeMap = useMemo( () => {
		const m = {};
		nodes.forEach( ( n ) => ( m[ n.id ] = n ) );
		return m;
	}, [ nodes ] );

	// ── Cursor style ──────────────────────────────────────────────────────────
	const cursor = dragState   ? 'grabbing'
	             : pendingWire ? 'crosshair'
	             : 'default';

	// ─────────────────────────────────────────────────────────────────────────
	return (
		<svg
			ref={ svgRef }
			viewBox={ `0 0 ${ vbWidth } ${ vbHeight }` }
			width={ vbWidth }
			height={ vbHeight }
			onMouseMove={ handleMouseMove }
			onMouseUp={ handleRelease }
			onMouseLeave={ handleRelease }
			style={ { display: 'block', cursor } }
		>
			{/* ── Committed wires ── */}
			{ connections.map( ( conn, i ) => (
				<Wire key={ i } conn={ conn } nodeMap={ nodeMap } />
			) ) }

			{/* ── Nodes ── */}
			{ nodes.map( ( node ) => (
				<NodeGroup
					key={ node.id }
					node={ node }
					isEditing={ editingId === node.id }
					isDragging={ dragState?.nodeId === node.id }
					pendingWireType={ pendingWire?.type ?? null }
					onHeaderMouseDown={ handleHeaderMouseDown }
					onHeaderClick={ onNodeSelect }
					onOutputSocketMouseDown={ handleOutputSocketMouseDown }
					onInputSocketMouseUp={ handleInputSocketMouseUp }
				/>
			) ) }

			{/* ── Pending wire (drawn on top of everything) ── */}
			{ pendingWire && ( () => {
				const { x1, y1, x2, y2, type } = pendingWire;
				const color = SOCK_CLR[ type ] ?? '#888';
				return (
					<path
						d={ wirePath( x1, y1, x2, y2 ) }
						fill="none"
						stroke={ color }
						strokeWidth="2"
						opacity="0.9"
						strokeDasharray="6 3"
						style={ { pointerEvents: 'none' } }
					/>
				);
			} )() }
		</svg>
	);
}
