/**
 * interactive-diagram.js
 *
 * React component that renders an interactive Blender node diagram.
 *
 * Interactions:
 *   Scroll wheel             → zoom toward cursor
 *   Middle-mouse drag        → pan canvas
 *   Drag node header         → reposition (onNodeMove)
 *   Click node header        → select / open accordion (onNodeSelect)
 *   Drag output socket       → live bezier wire; drop on input to connect (onConnect)
 *   Hover input sockets      → highlight compatible drop targets
 *
 * Imperative API (via ref):
 *   ref.current.zoomIn()
 *   ref.current.zoomOut()
 *   ref.current.fitView()
 */

import {
	useState, useRef, useCallback, useMemo,
	useEffect, forwardRef, useImperativeHandle,
} from '@wordpress/element';
import {
	NW, HH, SK, PAD,
	nodeColors, nodeSubtype, SOCK_CLR,
	nodeH, nodeExtraH, inPos, outPos,
	DEFAULT_RAMP_STOPS, rampBarRect,
	mixPillRect,
	SWATCH_W, SWATCH_H, SWATCH_GAP,
} from './node-layout';

const SK_HOV    = 7;     // socket radius when highlighted during wiring
const ZOOM_MIN  = 0.15;
const ZOOM_MAX  = 5;
const ZOOM_STEP = 1.2;   // factor per button click

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

const InteractiveDiagram = forwardRef( function InteractiveDiagram( {
	nodes,
	connections,
	editingId,
	onNodeMove,
	onNodeSelect,
	onConnect,
}, ref ) {
	const svgRef = useRef( null );

	// ── Interaction state ────────────────────────────────────────────────────
	const [ dragState,   setDragState   ] = useState( null );
	const [ pendingWire, setPendingWire  ] = useState( null );
	const [ panState,    setPanState    ] = useState( null );

	// ── Zoom / pan transform ─────────────────────────────────────────────────
	const [ transform, setTransform ] = useState( { x: 20, y: 20, scale: 1 } );

	// Ref mirrors state so the non-passive wheel listener can read it without
	// a stale closure (the listener is only registered once, on mount).
	const transformRef = useRef( transform );
	useEffect( () => { transformRef.current = transform; }, [ transform ] );

	// ── Coordinate helpers ───────────────────────────────────────────────────

	/** Screen coords → SVG viewport coords (no canvas transform applied). */
	const toSVGPoint = useCallback( ( e ) => {
		const rect = svgRef.current?.getBoundingClientRect();
		if ( ! rect ) return { x: 0, y: 0 };
		return { x: e.clientX - rect.left, y: e.clientY - rect.top };
	}, [] );

	/** SVG viewport coords → diagram / world coords (inverse of canvas transform). */
	const toDiagramPoint = useCallback( ( svgPt ) => {
		const t = transformRef.current;
		return {
			x: ( svgPt.x - t.x ) / t.scale,
			y: ( svgPt.y - t.y ) / t.scale,
		};
	}, [] );

	// ── Wheel zoom (non-passive so we can preventDefault) ────────────────────
	useEffect( () => {
		const svg = svgRef.current;
		if ( ! svg ) return;

		const onWheel = ( e ) => {
			e.preventDefault();
			const rect   = svg.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;
			const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
			const prev   = transformRef.current;
			const next   = Math.min( Math.max( prev.scale * factor, ZOOM_MIN ), ZOOM_MAX );

			setTransform( {
				scale: next,
				x: mouseX - ( mouseX - prev.x ) * ( next / prev.scale ),
				y: mouseY - ( mouseY - prev.y ) * ( next / prev.scale ),
			} );
		};

		svg.addEventListener( 'wheel', onWheel, { passive: false } );
		return () => svg.removeEventListener( 'wheel', onWheel );
	}, [] );

	// ── Fit-to-content ───────────────────────────────────────────────────────
	const fitView = useCallback( () => {
		const svg = svgRef.current;
		if ( ! svg || ! nodes.length ) return;
		const { width: cw, height: ch } = svg.getBoundingClientRect();
		if ( ! cw || ! ch ) return;

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		nodes.forEach( ( n ) => {
			minX = Math.min( minX, n.x );
			minY = Math.min( minY, n.y );
			maxX = Math.max( maxX, n.x + NW );
			maxY = Math.max( maxY, n.y + nodeH( n ) );
		} );

		const pad      = 40;
		const contentW = maxX - minX + pad * 2;
		const contentH = maxY - minY + pad * 2;
		const scale    = Math.min( cw / contentW, ch / contentH, 2 );

		setTransform( {
			scale,
			x: cw / 2 - ( ( minX + maxX ) / 2 ) * scale,
			y: ch / 2 - ( ( minY + maxY ) / 2 ) * scale,
		} );
	}, [ nodes ] );

	// ── Imperative handle ────────────────────────────────────────────────────
	useImperativeHandle( ref, () => ( {
		zoomIn:  () => setTransform( ( t ) => ( {
			...t,
			scale: Math.min( t.scale * ZOOM_STEP, ZOOM_MAX ),
		} ) ),
		zoomOut: () => setTransform( ( t ) => ( {
			...t,
			scale: Math.max( t.scale / ZOOM_STEP, ZOOM_MIN ),
		} ) ),
		fitView,
	} ), [ fitView ] );

	// ── Node drag ────────────────────────────────────────────────────────────
	const handleHeaderMouseDown = useCallback( ( e, nodeId, nodeX, nodeY ) => {
		if ( pendingWire ) return;
		e.preventDefault();
		e.stopPropagation();
		const diagPt = toDiagramPoint( toSVGPoint( e ) );
		setDragState( { nodeId, startDiagX: diagPt.x, startDiagY: diagPt.y, startNodeX: nodeX, startNodeY: nodeY } );
	}, [ pendingWire, toSVGPoint, toDiagramPoint ] );

	// ── Output socket → begin wire ────────────────────────────────────────────
	// x / y are already diagram coords (from outPos)
	const handleOutputSocketMouseDown = useCallback( ( e, nodeId, socketIdx, socketType, diagX, diagY ) => {
		e.preventDefault();
		e.stopPropagation();
		setPendingWire( { fromId: nodeId, fromOut: socketIdx, type: socketType, x1: diagX, y1: diagY, x2: diagX, y2: diagY } );
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

	// ── SVG background mousedown — start middle-mouse pan ────────────────────
	const handleSVGMouseDown = useCallback( ( e ) => {
		if ( e.button !== 1 ) return;
		e.preventDefault();
		const svgPt = toSVGPoint( e );
		const t     = transformRef.current;
		setPanState( { startX: svgPt.x, startY: svgPt.y, startTx: t.x, startTy: t.y } );
	}, [ toSVGPoint ] );

	// ── Mouse move ────────────────────────────────────────────────────────────
	const handleMouseMove = useCallback( ( e ) => {
		const svgPt = toSVGPoint( e );

		if ( panState ) {
			setTransform( ( t ) => ( {
				...t,
				x: panState.startTx + ( svgPt.x - panState.startX ),
				y: panState.startTy + ( svgPt.y - panState.startY ),
			} ) );
			return;
		}

		if ( dragState ) {
			const diagPt = toDiagramPoint( svgPt );
			onNodeMove(
				dragState.nodeId,
				Math.round( dragState.startNodeX + ( diagPt.x - dragState.startDiagX ) ),
				Math.round( dragState.startNodeY + ( diagPt.y - dragState.startDiagY ) )
			);
		}

		if ( pendingWire ) {
			const diagPt = toDiagramPoint( svgPt );
			setPendingWire( ( pw ) => pw ? { ...pw, x2: diagPt.x, y2: diagPt.y } : pw );
		}
	}, [ panState, dragState, pendingWire, toSVGPoint, toDiagramPoint, onNodeMove ] );

	// ── Release ───────────────────────────────────────────────────────────────
	const handleRelease = useCallback( () => {
		setDragState( null );
		setPendingWire( null );
		setPanState( null );
	}, [] );

	// ── Node map ──────────────────────────────────────────────────────────────
	const nodeMap = useMemo( () => {
		const m = {};
		nodes.forEach( ( n ) => ( m[ n.id ] = n ) );
		return m;
	}, [ nodes ] );

	const cursor = panState    ? 'move'
	             : dragState   ? 'grabbing'
	             : pendingWire ? 'crosshair'
	             : 'default';

	const canvasTransform = `translate(${ transform.x },${ transform.y }) scale(${ transform.scale })`;

	return (
		<svg
			ref={ svgRef }
			width="100%"
			height="100%"
			onMouseDown={ handleSVGMouseDown }
			onMouseMove={ handleMouseMove }
			onMouseUp={ handleRelease }
			onMouseLeave={ handleRelease }
			style={ { display: 'block', cursor } }
		>
			{/* All diagram content lives inside this transform group */}
			<g transform={ canvasTransform }>
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
			</g>
		</svg>
	);
} );

export default InteractiveDiagram;
