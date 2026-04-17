/**
 * diagram-builder.js
 *
 * Full-screen modal visual editor for building custom diagram JSON.
 *
 * Layout:
 *   ┌─ Left panel (380px) ────────────┬─ Right panel (flex) ──────────────┐
 *   │  Nodes section                  │  Interactive SVG canvas            │
 *   │   ├─ Node pills                 │  · Drag node headers to reposition │
 *   │   └─ Accordion edit forms       │  · Click a header to open its form │
 *   │  Connections section            │  · Wires update in real-time       │
 *   │   ├─ Connection list            │                                    │
 *   │   └─ Add-connection form        │                                    │
 *   ├─────────────────────────────────┴────────────────────────────────────┤
 *   │  Footer: [Cancel]  [Apply to Block]                                  │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * Props:
 *   initialData  — { nodes, connections } or null to start empty
 *   onApply(json) — called with the final JSON string when user clicks Apply
 *   onClose()    — called when user cancels or closes the modal
 */

import { useState, useCallback } from '@wordpress/element';
import {
	Modal,
	Button,
	TextControl,
	SelectControl,
	Flex,
	FlexItem,
	FlexBlock,
	Notice,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import InteractiveDiagram from './interactive-diagram';
import { NODE_TYPES, SOCKET_TYPES, NODE_TYPE_COLORS, SOCKET_COLORS } from './constants';

// ─── Auto-layout ──────────────────────────────────────────────────────────────

function autoLayout( nodes, connections ) {
	if ( nodes.length === 0 ) return nodes;

	const depths = {};
	nodes.forEach( ( n ) => ( depths[ n.id ] = 0 ) );

	for ( let pass = 0; pass < nodes.length; pass++ ) {
		connections.forEach( ( conn ) => {
			if ( depths[ conn.from ] !== undefined && depths[ conn.to ] !== undefined ) {
				const proposed = depths[ conn.from ] + 1;
				if ( proposed > depths[ conn.to ] ) depths[ conn.to ] = proposed;
			}
		} );
	}

	const byDepth = {};
	nodes.forEach( ( n ) => {
		const d = depths[ n.id ] ?? 0;
		( byDepth[ d ] = byDepth[ d ] ?? [] ).push( n.id );
	} );

	const X_STEP = 190, Y_STEP = 160, X_PAD = 10, Y_PAD = 40;
	const posMap = {};
	Object.entries( byDepth )
		.sort( ( [ a ], [ b ] ) => Number( a ) - Number( b ) )
		.forEach( ( [ depth, ids ] ) => {
			ids.forEach( ( id, i ) => {
				posMap[ id ] = {
					x: X_PAD + Number( depth ) * X_STEP,
					y: Y_PAD + i * Y_STEP,
				};
			} );
		} );

	return nodes.map( ( n ) => ( { ...n, ...( posMap[ n.id ] ?? {} ) } ) );
}

// ─── Factories ────────────────────────────────────────────────────────────────

const newNode = () => ( {
	id:      `node_${ Date.now() }`,
	type:    'math',
	label:   'Math\nAdd',
	x:       0,
	y:       80,
	inputs:  [],
	outputs: [],
} );

const newSocket = () => ( { label: '', type: 'value' } );
const newConn   = () => ( { from: '', fromOut: 0, to: '', toIn: 0 } );

const deepClone = ( val ) => JSON.parse( JSON.stringify( val ) );

// ─── Sub-components ───────────────────────────────────────────────────────────

function SocketRow( { socket, onChange, onRemove } ) {
	return (
		<Flex align="flex-end" gap={ 2 } style={ { marginBottom: 4 } }>
			<FlexBlock>
				<TextControl
					label="" aria-label={ __( 'Socket label', 'blender-node-diagram' ) }
					placeholder={ __( 'Label', 'blender-node-diagram' ) }
					value={ socket.label }
					onChange={ ( val ) => onChange( { ...socket, label: val } ) }
					__nextHasNoMarginBottom
				/>
			</FlexBlock>
			<FlexItem style={ { width: 90 } }>
				<SelectControl
					label="" aria-label={ __( 'Socket type', 'blender-node-diagram' ) }
					value={ socket.type }
					options={ SOCKET_TYPES }
					onChange={ ( val ) => onChange( { ...socket, type: val } ) }
					__nextHasNoMarginBottom
				/>
			</FlexItem>
			<FlexItem>
				<span style={ {
					display: 'inline-block', width: 10, height: 10,
					borderRadius: '50%', background: SOCKET_COLORS[ socket.type ] ?? '#888',
					marginBottom: 6,
				} } />
			</FlexItem>
			<FlexItem>
				<Button isSmall isDestructive icon="remove" onClick={ onRemove }
					label={ __( 'Remove socket', 'blender-node-diagram' ) } />
			</FlexItem>
		</Flex>
	);
}

function SocketList( { title, sockets, onChangeSocket, onAddSocket, onRemoveSocket } ) {
	return (
		<div style={ { marginTop: 10 } }>
			<Flex align="center" justify="space-between" style={ { marginBottom: 6 } }>
				<strong style={ LABEL_STYLE }>{ title }</strong>
				<Button isSmall icon="plus" onClick={ onAddSocket }>
					{ __( 'Add', 'blender-node-diagram' ) }
				</Button>
			</Flex>
			{ sockets.length === 0 && (
				<p style={ { fontSize: 11, color: '#555', margin: '2px 0 6px' } }>
					{ __( 'None', 'blender-node-diagram' ) }
				</p>
			) }
			{ sockets.map( ( sock, i ) => (
				<SocketRow
					key={ i } socket={ sock }
					onChange={ ( u ) => onChangeSocket( i, u ) }
					onRemove={ () => onRemoveSocket( i ) }
				/>
			) ) }
		</div>
	);
}

function TypeBadge( { type } ) {
	return (
		<span style={ {
			display: 'inline-block', padding: '1px 5px', marginLeft: 6,
			fontSize: 10, fontFamily: 'monospace',
			background: NODE_TYPE_COLORS[ type ] ?? '#333',
			color: '#ddd', borderRadius: 2,
		} }>
			{ type }
		</span>
	);
}

// ─── Style constants ──────────────────────────────────────────────────────────

const PANEL_BG   = '#161616';
const SURFACE_BG = '#1e1e1e';
const BORDER     = '1px solid #2a2a2a';
const LABEL_STYLE = {
	fontSize: 11, color: '#888',
	textTransform: 'uppercase', letterSpacing: '0.08em',
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function DiagramBuilder( { initialData, onApply, onClose } ) {
	const [ nodes,       setNodes       ] = useState( () => initialData?.nodes       ?? [] );
	const [ connections, setConnections ] = useState( () => initialData?.connections ?? [] );
	const [ editingId,   setEditingId   ] = useState( null );
	const [ draft,       setDraft       ] = useState( null );
	const [ connDraft,   setConnDraft   ] = useState( newConn );
	const [ connError,   setConnError   ] = useState( '' );

	// ── Node operations ──────────────────────────────────────────────────────

	const startEditing = useCallback( ( node ) => {
		setEditingId( node.id );
		setDraft( deepClone( node ) );
	}, [] );

	const cancelEditing = useCallback( () => {
		setEditingId( null );
		setDraft( null );
	}, [] );

	const saveEditing = useCallback( () => {
		if ( ! draft ) return;
		setNodes( ( prev ) => prev.map( ( n ) => ( n.id === editingId ? draft : n ) ) );
		setEditingId( null );
		setDraft( null );
	}, [ draft, editingId ] );

	const addNode = useCallback( () => {
		const node = newNode();
		setNodes( ( prev ) => [ ...prev, node ] );
		startEditing( node );
	}, [ startEditing ] );

	const removeNode = useCallback( ( id ) => {
		setNodes( ( prev ) => prev.filter( ( n ) => n.id !== id ) );
		setConnections( ( prev ) => prev.filter( ( c ) => c.from !== id && c.to !== id ) );
		if ( editingId === id ) cancelEditing();
	}, [ editingId, cancelEditing ] );

	const handleAutoLayout = useCallback( () => {
		// Save any open draft first so layout sees its current state
		let latestNodes = nodes;
		if ( draft && editingId ) {
			latestNodes = nodes.map( ( n ) => ( n.id === editingId ? draft : n ) );
		}
		const laid = autoLayout( latestNodes, connections );
		setNodes( laid );
		// Re-open the draft with updated position if editing
		if ( editingId ) {
			const updated = laid.find( ( n ) => n.id === editingId );
			if ( updated ) setDraft( deepClone( updated ) );
		}
	}, [ nodes, connections, draft, editingId ] );

	// ── Drag: called continuously while a node is being dragged on the canvas ─

	const handleNodeMove = useCallback( ( id, x, y ) => {
		setNodes( ( prev ) => prev.map( ( n ) =>
			n.id === id ? { ...n, x, y } : n
		) );
		// Keep the accordion X/Y fields in sync if this node is being edited
		if ( editingId === id ) {
			setDraft( ( d ) => d ? { ...d, x, y } : d );
		}
	}, [ editingId ] );

	// ── Click on node header in canvas → open its accordion ──────────────────

	const handleNodeSelect = useCallback( ( id ) => {
		if ( editingId === id ) return;   // already open; ignore
		// Auto-save the current draft before switching
		if ( draft && editingId ) {
			setNodes( ( prev ) => prev.map( ( n ) => ( n.id === editingId ? draft : n ) ) );
		}
		const node = nodes.find( ( n ) => n.id === id );
		if ( node ) startEditing( node );
	}, [ editingId, draft, nodes, startEditing ] );

	// ── Canvas wire drop → add connection ────────────────────────────────

	const handleConnect = useCallback( ( fromId, fromOut, toId, toIn ) => {
		const already = connections.some(
			( c ) => c.from === fromId && c.fromOut === fromOut && c.to === toId && c.toIn === toIn
		);
		if ( ! already ) {
			setConnections( ( prev ) => [ ...prev, { from: fromId, fromOut, to: toId, toIn } ] );
		}
	}, [ connections ] );

	// ── Draft socket helpers ──────────────────────────────────────────────────

	const setDraftSocket = useCallback( ( side, index, updated ) => {
		setDraft( ( prev ) => {
			const list = [ ...prev[ side ] ];
			list[ index ] = updated;
			return { ...prev, [ side ]: list };
		} );
	}, [] );

	const addDraftSocket    = useCallback( ( side ) => {
		setDraft( ( prev ) => ( { ...prev, [ side ]: [ ...prev[ side ], newSocket() ] } ) );
	}, [] );

	const removeDraftSocket = useCallback( ( side, i ) => {
		setDraft( ( prev ) => ( { ...prev, [ side ]: prev[ side ].filter( ( _, j ) => j !== i ) } ) );
	}, [] );

	// ── Connection operations ─────────────────────────────────────────────────

	const addConnection = useCallback( () => {
		setConnError( '' );
		if ( ! connDraft.from ) return setConnError( __( 'Choose a "from" node.', 'blender-node-diagram' ) );
		if ( ! connDraft.to   ) return setConnError( __( 'Choose a "to" node.',   'blender-node-diagram' ) );

		const fromNode = nodes.find( ( n ) => n.id === connDraft.from );
		const toNode   = nodes.find( ( n ) => n.id === connDraft.to   );

		if ( fromNode && connDraft.fromOut >= fromNode.outputs.length ) {
			return setConnError( `"${ connDraft.from }" has ${ fromNode.outputs.length } output(s); index ${ connDraft.fromOut } is out of range.` );
		}
		if ( toNode && connDraft.toIn >= toNode.inputs.length ) {
			return setConnError( `"${ connDraft.to }" has ${ toNode.inputs.length } input(s); index ${ connDraft.toIn } is out of range.` );
		}

		setConnections( ( prev ) => [ ...prev, { ...connDraft } ] );
		setConnDraft( newConn() );
	}, [ connDraft, nodes ] );

	const removeConnection = useCallback( ( index ) => {
		setConnections( ( prev ) => prev.filter( ( _, i ) => i !== index ) );
	}, [] );

	// ── Apply ─────────────────────────────────────────────────────────────────

	const handleApply = useCallback( () => {
		// Commit any unsaved draft before applying
		const finalNodes = draft && editingId
			? nodes.map( ( n ) => ( n.id === editingId ? draft : n ) )
			: nodes;
		onApply( JSON.stringify( { nodes: finalNodes, connections }, null, 2 ) );
	}, [ nodes, connections, draft, editingId, onApply ] );

	// ── Merged node list passed to the interactive diagram ────────────────────
	// The draft is blended in so the canvas updates while editing form fields.
	const previewNodes = editingId && draft
		? nodes.map( ( n ) => ( n.id === editingId ? draft : n ) )
		: nodes;

	// ── Connection select options ─────────────────────────────────────────────
	const nodeOptions = [
		{ label: '— select node —', value: '' },
		...nodes.map( ( n ) => ( { label: `${ n.id }  (${ n.type })`, value: n.id } ) ),
	];

	// ─────────────────────────────────────────────────────────────────────────
	return (
		<Modal
			title={ __( 'Diagram Builder', 'blender-node-diagram' ) }
			onRequestClose={ onClose }
			isFullScreen
		>
			<div style={ {
				display: 'flex', height: 'calc(100vh - 120px)', overflow: 'hidden',
			} }>

				{/* ═══ Left panel ══════════════════════════════════════════════ */}
				<div style={ {
					width: 380, flexShrink: 0, overflowY: 'auto',
					borderRight: BORDER, padding: '16px 12px',
					display: 'flex', flexDirection: 'column', gap: 24,
					background: PANEL_BG,
				} }>

					{/* ── Nodes ──────────────────────────────────────────────── */}
					<section>
						<Flex align="center" justify="space-between" style={ { marginBottom: 8 } }>
							<strong style={ LABEL_STYLE }>
								{ __( 'Nodes', 'blender-node-diagram' ) }
								<span style={ { color: '#444', marginLeft: 4 } }>({ nodes.length })</span>
							</strong>
							<Flex gap={ 2 }>
								<Button isSmall variant="secondary" onClick={ handleAutoLayout }
									disabled={ nodes.length === 0 }
									title={ __( 'Space nodes left-to-right by connection depth', 'blender-node-diagram' ) }>
									{ __( 'Auto-layout', 'blender-node-diagram' ) }
								</Button>
								<Button isSmall variant="primary" icon="plus" onClick={ addNode }>
									{ __( 'Add Node', 'blender-node-diagram' ) }
								</Button>
							</Flex>
						</Flex>

						{ nodes.length === 0 && (
							<p style={ { color: '#444', fontSize: 12, fontStyle: 'italic' } }>
								{ __( 'No nodes yet.', 'blender-node-diagram' ) }
							</p>
						) }

						{ nodes.map( ( node ) => (
							<div key={ node.id } style={ {
								marginBottom: 4, border: BORDER, borderRadius: 4, overflow: 'hidden',
							} }>
								{/* Pill */}
								<Flex align="center" style={ {
									padding: '6px 10px',
									background: editingId === node.id ? '#252525' : SURFACE_BG,
								} }>
									<FlexBlock>
										<span style={ { fontSize: 12, fontFamily: 'monospace', color: '#ccc' } }>
											{ node.id || '(unnamed)' }
										</span>
										<TypeBadge type={ node.type } />
									</FlexBlock>
									<FlexItem>
										<Flex gap={ 1 }>
											<Button isSmall
												variant={ editingId === node.id ? 'primary' : 'secondary' }
												onClick={ () => editingId === node.id
													? cancelEditing()
													: startEditing( node )
												}>
												{ editingId === node.id
													? __( 'Close', 'blender-node-diagram' )
													: __( 'Edit',  'blender-node-diagram' )
												}
											</Button>
											<Button isSmall isDestructive onClick={ () => removeNode( node.id ) }>✕</Button>
										</Flex>
									</FlexItem>
								</Flex>

								{/* Accordion */}
								{ editingId === node.id && draft && (
									<div style={ {
										padding: '12px 10px', background: '#121212', borderTop: BORDER,
									} }>
										<TextControl label={ __( 'ID', 'blender-node-diagram' ) }
											value={ draft.id }
											onChange={ ( val ) => setDraft( ( d ) => ( { ...d, id: val } ) ) }
											__nextHasNoMarginBottom />
										<div style={ { height: 8 } } />
										<SelectControl label={ __( 'Type', 'blender-node-diagram' ) }
											value={ draft.type } options={ NODE_TYPES }
											onChange={ ( val ) => setDraft( ( d ) => ( { ...d, type: val } ) ) }
											__nextHasNoMarginBottom />
										<div style={ { height: 8 } } />
										<TextControl label={ __( 'Label  (use \\n for two lines)', 'blender-node-diagram' ) }
											value={ draft.label }
											onChange={ ( val ) => setDraft( ( d ) => ( { ...d, label: val } ) ) }
											__nextHasNoMarginBottom />
										<div style={ { height: 8 } } />
										{/* X/Y — updated live by drag events */}
										<Flex gap={ 2 }>
											<FlexBlock>
												<TextControl label="X" type="number"
													value={ draft.x }
													onChange={ ( val ) => {
														const x = Number( val );
														setDraft( ( d ) => ( { ...d, x } ) );
														setNodes( ( prev ) => prev.map( ( n ) =>
															n.id === editingId ? { ...n, x } : n
														) );
													} }
													__nextHasNoMarginBottom />
											</FlexBlock>
											<FlexBlock>
												<TextControl label="Y" type="number"
													value={ draft.y }
													onChange={ ( val ) => {
														const y = Number( val );
														setDraft( ( d ) => ( { ...d, y } ) );
														setNodes( ( prev ) => prev.map( ( n ) =>
															n.id === editingId ? { ...n, y } : n
														) );
													} }
													__nextHasNoMarginBottom />
											</FlexBlock>
										</Flex>
										<p style={ {
											fontSize: 10, color: '#444', fontFamily: 'monospace',
											margin: '4px 0 8px',
										} }>
											{ __( '← drag the node header on the canvas to reposition', 'blender-node-diagram' ) }
										</p>

										<SocketList
											title={ __( 'Input Sockets', 'blender-node-diagram' ) }
											sockets={ draft.inputs }
											onChangeSocket={ ( i, u ) => setDraftSocket( 'inputs', i, u ) }
											onAddSocket={ () => addDraftSocket( 'inputs' ) }
											onRemoveSocket={ ( i ) => removeDraftSocket( 'inputs', i ) }
										/>
										<SocketList
											title={ __( 'Output Sockets', 'blender-node-diagram' ) }
											sockets={ draft.outputs }
											onChangeSocket={ ( i, u ) => setDraftSocket( 'outputs', i, u ) }
											onAddSocket={ () => addDraftSocket( 'outputs' ) }
											onRemoveSocket={ ( i ) => removeDraftSocket( 'outputs', i ) }
										/>

										<Flex gap={ 2 } style={ { marginTop: 10 } }>
											<Button variant="primary" isSmall onClick={ saveEditing }>
												{ __( 'Save Node', 'blender-node-diagram' ) }
											</Button>
											<Button isSmall onClick={ cancelEditing }>
												{ __( 'Cancel', 'blender-node-diagram' ) }
											</Button>
										</Flex>
									</div>
								) }
							</div>
						) ) }
					</section>

					{/* ── Connections ────────────────────────────────────────── */}
					<section>
						<strong style={ { ...LABEL_STYLE, display: 'block', marginBottom: 8 } }>
							{ __( 'Connections', 'blender-node-diagram' ) }
							<span style={ { color: '#444', marginLeft: 4 } }>({ connections.length })</span>
						</strong>

						{ connections.length === 0 && (
							<p style={ { color: '#444', fontSize: 12, fontStyle: 'italic', marginBottom: 8 } }>
								{ __( 'No connections yet.', 'blender-node-diagram' ) }
							</p>
						) }

						{ connections.map( ( conn, i ) => (
							<Flex key={ i } align="center" style={ {
								padding: '5px 8px', marginBottom: 3,
								background: SURFACE_BG, border: BORDER, borderRadius: 3,
								fontSize: 11, fontFamily: 'monospace',
							} }>
								<FlexBlock>
									<span style={ { color: '#7878CC' } }>{ conn.from }[{ conn.fromOut }]</span>
									<span style={ { color: '#444', margin: '0 4px' } }>→</span>
									<span style={ { color: '#48AA80' } }>{ conn.to }[{ conn.toIn }]</span>
								</FlexBlock>
								<FlexItem>
									<Button isSmall isDestructive icon="remove"
										onClick={ () => removeConnection( i ) }
										label={ __( 'Remove connection', 'blender-node-diagram' ) } />
								</FlexItem>
							</Flex>
						) ) }

						{/* Add connection form */}
						<div style={ {
							marginTop: 10, padding: 10,
							background: SURFACE_BG, border: BORDER, borderRadius: 3,
						} }>
							<strong style={ { ...LABEL_STYLE, display: 'block', marginBottom: 8 } }>
								{ __( 'Add Connection', 'blender-node-diagram' ) }
							</strong>
							{ connError && (
								<Notice status="warning" isDismissible={ false } style={ { marginBottom: 8 } }>
									{ connError }
								</Notice>
							) }
							<Flex gap={ 2 }>
								<FlexBlock>
									<SelectControl label={ __( 'From node', 'blender-node-diagram' ) }
										value={ connDraft.from } options={ nodeOptions }
										onChange={ ( val ) => setConnDraft( ( d ) => ( { ...d, from: val } ) ) }
										__nextHasNoMarginBottom />
								</FlexBlock>
								<FlexItem style={ { width: 62 } }>
									<TextControl label={ __( 'Out #', 'blender-node-diagram' ) }
										type="number" min={ 0 }
										value={ connDraft.fromOut }
										onChange={ ( val ) => setConnDraft( ( d ) => ( { ...d, fromOut: Number( val ) } ) ) }
										__nextHasNoMarginBottom />
								</FlexItem>
							</Flex>
							<div style={ { height: 6 } } />
							<Flex gap={ 2 }>
								<FlexBlock>
									<SelectControl label={ __( 'To node', 'blender-node-diagram' ) }
										value={ connDraft.to } options={ nodeOptions }
										onChange={ ( val ) => setConnDraft( ( d ) => ( { ...d, to: val } ) ) }
										__nextHasNoMarginBottom />
								</FlexBlock>
								<FlexItem style={ { width: 62 } }>
									<TextControl label={ __( 'In #', 'blender-node-diagram' ) }
										type="number" min={ 0 }
										value={ connDraft.toIn }
										onChange={ ( val ) => setConnDraft( ( d ) => ( { ...d, toIn: Number( val ) } ) ) }
										__nextHasNoMarginBottom />
								</FlexItem>
							</Flex>
							<div style={ { height: 8 } } />
							<Button variant="secondary" isSmall onClick={ addConnection }
								disabled={ ! connDraft.from || ! connDraft.to }>
								{ __( 'Add', 'blender-node-diagram' ) }
							</Button>
						</div>
					</section>
				</div>

				{/* ═══ Right panel — interactive canvas ═══════════════════════ */}
				<div style={ {
					flex: 1, overflow: 'auto',
					background: '#0f0f0f',
					backgroundImage: 'radial-gradient(circle, #1e1e1e 1px, transparent 1px)',
					backgroundSize: '22px 22px',
					padding: 12, position: 'relative',
				} }>
					{ previewNodes.length === 0 ? (
						<div style={ {
							position: 'absolute', inset: 0,
							display: 'flex', alignItems: 'center', justifyContent: 'center',
							color: '#2a2a2a', fontSize: 13, fontFamily: 'monospace', userSelect: 'none',
						} }>
							{ __( '← Add nodes to get started', 'blender-node-diagram' ) }
						</div>
					) : (
						<InteractiveDiagram
							nodes={ previewNodes }
							connections={ connections }
							editingId={ editingId }
							onNodeMove={ handleNodeMove }
							onNodeSelect={ handleNodeSelect }
							onConnect={ handleConnect }
						/>
					) }
				</div>
			</div>

			{/* ═══ Footer ══════════════════════════════════════════════════════ */}
			<div style={ {
				padding: '12px 16px', borderTop: BORDER,
				display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
				gap: 8, background: PANEL_BG,
			} }>
				<span style={ { marginRight: 'auto', fontSize: 11, color: '#444', fontFamily: 'monospace' } }>
					{ nodes.length } { __( 'nodes', 'blender-node-diagram' ) }
					{ ' / ' }
					{ connections.length } { __( 'connections', 'blender-node-diagram' ) }
				</span>
				<Button variant="secondary" onClick={ onClose }>
					{ __( 'Cancel', 'blender-node-diagram' ) }
				</Button>
				<Button variant="primary" onClick={ handleApply } disabled={ nodes.length === 0 }>
					{ __( 'Apply to Block', 'blender-node-diagram' ) }
				</Button>
			</div>
		</Modal>
	);
}
