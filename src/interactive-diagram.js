/**
 * interactive-diagram.js
 *
 * React component that renders an interactive Blender node diagram.
 *
 * Interactions:
 *   Drag node header      → reposition (onNodeMove)
 *   Click node header     → select / open accordion (onNodeSelect)
 *   Drag output socket    → live bezier wire; drop on input to connect (onConnect)
 *   Hover input sockets   → highlight compatible drop targets
 *
 * Supported special node types (from node-layout.js):
 *   colorRamp  — renders a gradient bar; reads node.rampStops
 *   mixColor   — renders a blend-mode pill; reads node.blendMode
 */

import { useState, useRef, useCallback, useMemo } from '@wordpress/element';
import {
	NW, HH, SK, PAD,
	nodeColors, nodeSubtype, SOCK_CLR,
	nodeH, nodeExtraH, inPos, outPos,
	DEFAULT_RAMP_STOPS, rampBarRect,
	mixPillRect,
	SWATCH_W, SWATCH_H, SWATCH_GAP,
} from './node-layout';

const SK_HOV = 7;   // socket radius when highlighted during wiring

// ─── Bezier wire path ─────────────────────────────────────────────────────────

function wirePath( x1, y1, x2, y2 ) {
	const dx = Math.max( 60, Math.abs( x2 - x1 ) * 0.42 );
	return `M ${ x1 } ${ y1 } C ${ x1 + dx } ${ y1 }, ${ x2 - dx } ${ y2 }, ${ x2 } ${ y2 }`;
}

// ─── Color Ramp body (JSX) ────────────────────────────────────────────────────

function ColorRampBody( { node } ) {
	const stops  = node.rampStops?.length ? node.rampStops : DEFAULT_RAMP_STOPS;
	const gradId = `ramp-${ node.id.replace( /[^a-zA-Z0-9]/g, '_' ) }`;
	const bar    = rampBarRect( node );

	return (
		<>
			<defs>
				<linearGradient id={ gradId } x1="0%" y1="0%" x2="100%" y2="0%">
					{ stops.map( ( s, i ) => (
						<stop
							key={ i }
							offset={ `${ Math.round( s.pos * 100 ) }%` }
							stopColor={ s.color }
							stopOpacity={ s.alpha ?? 1 }
						/>
					) ) }
				</linearGradient>
			</defs>

			{/* Dark backing */}
			<rect x={ bar.x } y={ bar.y } width={ bar.w } height={ bar.h }
				rx="2" fill="#1A1A1A"
				style={ { pointerEvents: 'none' } }
			/>

			{/* Gradient fill */}
			<rect x={ bar.x } y={ bar.y } width={ bar.w } height={ bar.h }
				rx="2" fill={ `url(#${ gradId })` }
				stroke="#2A2A2A" strokeWidth="0.5"
				style={ { pointerEvents: 'none' } }
			/>

			{/* Stop markers */}
			{ stops.map( ( s, i ) => {
				const mx = bar.x + s.pos * bar.w;
				return (
					<polygon
						key={ i }
						points={ `${ mx },${ bar.y + bar.h + 1 } ${ mx - 3 },${ bar.y + bar.h + 6 } ${ mx + 3 },${ bar.y + bar.h + 6 }` }
						fill="#CCCCCC"
						style={ { pointerEvents: 'none' } }
					/>
				);
			} ) }
		</>
	);
}

// ─── Mix Color body (JSX) ─────────────────────────────────────────────────────

function MixColorBody( { node } ) {
	const mode = node.blendMode ?? 'Mix';
	const pill = mixPillRect( node );

	return (
		<>
			<rect x={ pill.x } y={ pill.y } width={ pill.w } height={ pill.h }
				rx="3" fill="#111111" stroke="#333333" strokeWidth="0.5"
				style={ { pointerEvents: 'none' } }
			/>
			<text
				x={ pill.x + pill.w / 2 }
				y={ pill.y + pill.h / 2 + 3.5 }
				fontFamily="JetBrains Mono, monospace"
				fontSize="8.5"
				fill="#BBBBBB"
				textAnchor="middle"
				style={ { pointerEvents: 'none' } }
			>
				{ mode }
			</text>
		</>
	);
}

// ─── Committed wire ───────────────────────────────────────────────────────────

function Wire( { conn, nodeMap } ) {
	const fNode = nodeMap[ conn.from ];
	const tNode = nodeMap[ conn.to ];
	if ( ! fNode || ! tNode ) return null;

	const f     = outPos( fNode, conn.fromOut );
	const t     = inPos(  tNode, conn.toIn    );
	const color = SOCK_CLR[ fNode.outputs[ conn.fromOut ]?.type ] ?? '#888';

	return (
		<path d={ wirePath( f.x, f.y, t.x, t.y ) }
			fill="none" stroke={ color } strokeWidth="1.8" opacity="0.75"
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
	pendingWireType,
	onOutputSocketMouseDown,
	onInputSocketMouseUp,
} ) {
	const colors = nodeColors( node );
	const h      = nodeH( node );

	const ringColor = isEditing  ? '#E07840'
	                : isDragging ? '#5A8AEE'
	                : 'transparent';

	return (
		<g style={ { userSelect: 'none' } }>
			{/* Drop shadow */}
			<rect x={ node.x + 3 } y={ node.y + 3 } width={ NW } height={ h }
				rx="4" fill="rgba(0,0,0,0.45)"
				style={ { pointerEvents: 'none' } }
			/>

			{/* Body */}
			<rect x={ node.x } y={ node.y } width={ NW } height={ h }
				rx="4" fill={ colors.b }
				stroke={ ringColor } strokeWidth={ isEditing || isDragging ? 1.5 : 1 }
				style={ { pointerEvents: 'none' } }
			/>

			{/* Header — drag + select target */}
			<rect x={ node.x } y={ node.y } width={ NW } height={ HH }
				rx="4" fill={ colors.h }
				style={ { cursor: isDragging ? 'grabbing' : 'grab' } }
				onMouseDown={ ( e ) => onHeaderMouseDown( e, node.id, node.x, node.y ) }
				onClick={ () => onHeaderClick( node.id ) }
			/>
			{/* Square off bottom of header */}
			<rect x={ node.x } y={ node.y + HH - 4 } width={ NW } height={ 4 }
				fill={ colors.h }
				style={ { pointerEvents: 'none' } }
			/>

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
						style={ { pointerEvents: 'none' } }
					>
						{ line }
					</text>
				);
			} ) }

			{/* ── Subtype-specific body elements ──────────────────────────── */}
			{ nodeSubtype( node ) === 'colorRamp' && <ColorRampBody node={ node } /> }
			{ nodeSubtype( node ) === 'mixColor'  && <MixColorBody  node={ node } /> }

			{/* ── Input sockets ────────────────────────────────────── */}
			{ node.inputs.map( ( sock, i ) => {
				const p          = inPos( node, i );
				const baseColor  = SOCK_CLR[ sock.type ] ?? '#888';
				const isTarget   = pendingWireType !== null && pendingWireType === sock.type;
				const isAnyWire  = pendingWireType !== null;
				const r          = isTarget ? SK_HOV : SK;
				const opacity    = isAnyWire && ! isTarget ? 0.35 : 1;
				const hasSwatch  = sock.type === 'color' && sock.defaultColor;
				const labelX     = hasSwatch
					? p.x + SK + SWATCH_GAP + SWATCH_W + SWATCH_GAP
					: p.x + SK + 4;

				return (
					<g key={ i }>
						{/* Hit area */}
						<circle cx={ p.x } cy={ p.y } r={ SK_HOV + 4 }
							fill="transparent"
							style={ { cursor: isAnyWire ? 'cell' : 'default' } }
							onMouseUp={ ( e ) => onInputSocketMouseUp( e, node.id, i ) }
						/>
						{/* Socket dot */}
						<circle cx={ p.x } cy={ p.y } r={ r }
							fill={ baseColor } stroke={ isTarget ? '#fff' : '#111' } strokeWidth="1"
							opacity={ opacity }
							style={ { pointerEvents: 'none' } }
						/>
						{ isTarget && (
							<circle cx={ p.x } cy={ p.y } r={ SK_HOV + 3 }
								fill="none" stroke={ baseColor } strokeWidth="1.5" opacity="0.45"
								style={ { pointerEvents: 'none' } }
							/>
						) }
						{/* Default-color swatch */}
						{ hasSwatch && ( () => {
							const sx = p.x + SK + SWATCH_GAP;
							const sy = p.y - SWATCH_H / 2;
							return (
								<>
									<rect x={ sx - 0.5 } y={ sy - 0.5 }
										width={ SWATCH_W + 1 } height={ SWATCH_H + 1 }
										rx="2" fill="#111"
										opacity={ opacity }
										style={ { pointerEvents: 'none' } }
									/>
									<rect x={ sx } y={ sy }
										width={ SWATCH_W } height={ SWATCH_H }
										rx="1.5" fill={ sock.defaultColor }
										opacity={ opacity }
										style={ { pointerEvents: 'none' } }
									/>
								</>
							);
						} )() }
						{/* Label */}
						<text x={ labelX } y={ p.y + 3.5 }
							fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#999"
							opacity={ opacity }
							style={ { pointerEvents: 'none' } }
						>
							{ sock.label }
						</text>
					</g>
				);
			} ) }


			{/* ── Output sockets ──────────────────────────────────────────── */}
			{ node.outputs.map( ( sock, i ) => {
				const p         = outPos( node, i );
				const baseColor = SOCK_CLR[ sock.type ] ?? '#888';
				const canStart  = ! pendingWireType;

				return (
					<g key={ i }>
						{/* Hit area */}
						<circle cx={ p.x } cy={ p.y } r={ SK_HOV + 4 }
							fill="transparent"
							style={ { cursor: canStart ? 'crosshair' : 'not-allowed' } }
							onMouseDown={ ( e ) =>
								canStart && onOutputSocketMouseDown( e, node.id, i, sock.type, p.x, p.y )
							}
						/>
						<circle cx={ p.x } cy={ p.y } r={ SK }
							fill={ baseColor } stroke="#111" strokeWidth="1"
							style={ { pointerEvents: 'none' } }
						/>
						<text x={ p.x - SK - 4 } y={ p.y + 3.5 }
							fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#999"
							textAnchor="end"
							style={ { pointerEvents: 'none' } }
						>
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
	const svgRef                      = useRef( null );
	const [ dragState,    setDragState    ] = useState( null );
	const [ pendingWire,  setPendingWire  ] = useState( null );

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
		if ( pendingWire ) return;
		e.preventDefault();
		e.stopPropagation();
		const pt = toSVGPoint( e );
		setDragState( { nodeId, startSvgX: pt.x, startSvgY: pt.y, startNodeX: nodeX, startNodeY: nodeY } );
	}, [ pendingWire, toSVGPoint ] );

	// ── Output socket → begin wire ────────────────────────────────────────────
	const handleOutputSocketMouseDown = useCallback( ( e, nodeId, socketIdx, socketType, svgX, svgY ) => {
		e.preventDefault();
		e.stopPropagation();
		setPendingWire( { fromId: nodeId, fromOut: socketIdx, type: socketType, x1: svgX, y1: svgY, x2: svgX, y2: svgY } );
	}, [] );

	// ── Input socket → complete wire ──────────────────────────────────────────
	const handleInputSocketMouseUp = useCallback( ( e, nodeId, socketIdx ) => {
		if ( ! pendingWire ) return;
		e.stopPropagation();
		if ( pendingWire.fromId !== nodeId ) {
			onConnect( pendingWire.fromId, pendingWire.fromOut, nodeId, socketIdx );
		}
		setPendingWire( null );
	}, [ pendingWire, onConnect ] );

	// ── Mouse move ────────────────────────────────────────────────────────────
	const handleMouseMove = useCallback( ( e ) => {
		const pt = toSVGPoint( e );
		if ( dragState ) {
			onNodeMove(
				dragState.nodeId,
				Math.round( dragState.startNodeX + ( pt.x - dragState.startSvgX ) ),
				Math.round( dragState.startNodeY + ( pt.y - dragState.startSvgY ) )
			);
		}
		if ( pendingWire ) {
			setPendingWire( ( pw ) => pw ? { ...pw, x2: pt.x, y2: pt.y } : pw );
		}
	}, [ dragState, pendingWire, toSVGPoint, onNodeMove ] );

	// ── Release ───────────────────────────────────────────────────────────────
	const handleRelease = useCallback( () => {
		setDragState( null );
		setPendingWire( null );
	}, [] );

	// ── ViewBox (auto-sized) ──────────────────────────────────────────────────
	const { vbWidth, vbHeight } = useMemo( () => {
		let maxX = 400, maxY = 200;
		nodes.forEach( ( n ) => {
			maxX = Math.max( maxX, n.x + NW );
			maxY = Math.max( maxY, n.y + nodeH( n ) );
		} );
		return { vbWidth: maxX + PAD, vbHeight: maxY + PAD };
	}, [ nodes ] );

	// ── Node map ──────────────────────────────────────────────────────────────
	const nodeMap = useMemo( () => {
		const m = {};
		nodes.forEach( ( n ) => ( m[ n.id ] = n ) );
		return m;
	}, [ nodes ] );

	const cursor = dragState   ? 'grabbing'
	             : pendingWire ? 'crosshair'
	             : 'default';

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
			{/* Committed wires */}
			{ connections.map( ( conn, i ) => (
				<Wire key={ i } conn={ conn } nodeMap={ nodeMap } />
			) ) }

			{/* Nodes */}
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

			{/* Pending wire (dashed, follows cursor) */}
			{ pendingWire && (
				<path
					d={ wirePath( pendingWire.x1, pendingWire.y1, pendingWire.x2, pendingWire.y2 ) }
					fill="none"
					stroke={ SOCK_CLR[ pendingWire.type ] ?? '#888' }
					strokeWidth="2"
					opacity="0.9"
					strokeDasharray="6 3"
					style={ { pointerEvents: 'none' } }
				/>
			) }
		</svg>
	);
}
