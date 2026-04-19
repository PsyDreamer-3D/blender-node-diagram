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

import { useState, useCallback, useEffect, useRef } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
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
import { NODE_CATEGORIES, SOCKET_TYPES, SOCKET_COLORS } from './constants';
import { MIX_BLEND_MODES, DEFAULT_RAMP_STOPS, LEGACY_TYPE_CATEGORY, nodeColors } from './node-layout';
import { CATEGORY_COLORS } from './node-categories';
import { BUILTIN_TEMPLATES } from './node-templates';

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
	id:       `node_${ Date.now() }`,
	category: 'converter',
	label:    'New Node',
	x:        0,
	y:        80,
	inputs:   [],
	outputs:  [],
} );

/** Find the first unoccupied grid slot for a stamped template node. */
function stampPosition( existingNodes ) {
	const STEP_X = 190, STEP_Y = 160, BASE_X = 40, BASE_Y = 40;
	const occupied = new Set(
		existingNodes.map( ( n ) => `${ Math.round( ( n.x - BASE_X ) / STEP_X ) },${ Math.round( ( n.y - BASE_Y ) / STEP_Y ) }` )
	);
	for ( let row = 0; row < 12; row++ ) {
		for ( let col = 0; col < 12; col++ ) {
			if ( ! occupied.has( `${ col },${ row }` ) ) {
				return { x: BASE_X + col * STEP_X, y: BASE_Y + row * STEP_Y };
			}
		}
	}
	const maxY = existingNodes.reduce( ( m, n ) => Math.max( m, n.y ), 0 );
	return { x: BASE_X, y: maxY + STEP_Y };
}

const newSocket = () => ( { label: '', type: 'value' } );
const newConn   = () => ( { from: '', fromOut: 0, to: '', toIn: 0 } );

const deepClone = ( val ) => JSON.parse( JSON.stringify( val ) );

// ─── Sub-components ───────────────────────────────────────────────────────────

function SocketRow( { socket, onChange, onRemove } ) {
	const isColor = socket.type === 'color';

	return (
		<div style={ { marginBottom: 6 } }>
			{/* ── Row 1: label / type / dot / remove ── */}
			<Flex align="flex-end" gap={ 2 }>
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
						onChange={ ( val ) => {
							// Clear defaultColor when switching away from color type
							const update = { ...socket, type: val };
							if ( val !== 'color' ) delete update.defaultColor;
							onChange( update );
						} }
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

			{/* ── Row 2: default color picker (color sockets only) ── */}
			{ isColor && (
				<Flex align="center" gap={ 2 } style={ { marginTop: 4, paddingLeft: 2 } }>
					<FlexItem>
						<span style={ { fontSize: 10, color: '#666', fontFamily: 'monospace', whiteSpace: 'nowrap' } }>
							{ __( 'Default color', 'blender-node-diagram' ) }
						</span>
					</FlexItem>
					<FlexBlock>
						<input
							type="color"
							value={ socket.defaultColor ?? '#ffffff' }
							title={ __( 'Default color shown in the node when socket is unconnected', 'blender-node-diagram' ) }
							style={ {
								width: '100%', height: 22,
								border: '1px solid #333', borderRadius: 3,
								cursor: 'pointer', padding: 1,
								background: 'none', display: 'block',
							} }
							onChange={ ( e ) => onChange( { ...socket, defaultColor: e.target.value } ) }
						/>
					</FlexBlock>
					{ socket.defaultColor && (
						<FlexItem>
							<Button
								isSmall
								variant="tertiary"
								onClick={ () => {
									const s = { ...socket };
									delete s.defaultColor;
									onChange( s );
								} }
								label={ __( 'Clear default color', 'blender-node-diagram' ) }
								title={ __( 'Clear', 'blender-node-diagram' ) }
								style={ { fontSize: 10 } }
							>
								{ __( 'Clear', 'blender-node-diagram' ) }
							</Button>
						</FlexItem>
					) }
				</Flex>
			) }
		</div>
	);
}

function SocketList( { title, sockets, onChangeSocket, onAddSocket, onRemoveSocket } ) {
	return (
		<div style={ { marginTop: 10 } }>
			<Flex align="center" justify="space-between" style={ { marginBottom: 6 } }>
				<strong style={ LABEL_STYLE }>{ title }</strong>
				<Button isSmall variant="secondary" icon="plus" onClick={ onAddSocket }>
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

function TypeBadge( { node } ) {
	const colors = nodeColors( node );
	const label  = node.category || node.type || '—';
	return (
		<span style={ {
			display: 'inline-block', padding: '1px 5px', marginLeft: 6,
			fontSize: 10, fontFamily: 'monospace',
			background: colors.h,
			color: '#ddd', borderRadius: 2,
		} }>
			{ label }
		</span>
	);
}

function TemplateCard( { tpl, onStamp, onDelete } ) {
	const hColor = CATEGORY_COLORS[ tpl.category ]?.h ?? '#333';
	return (
		<div style={ {
			marginBottom: 3, padding: '6px 8px',
			background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 3,
		} }>
			<Flex align="center">
				<FlexBlock>
					<span style={ { fontSize: 11, fontFamily: 'monospace', color: '#ccc' } }>
						{ tpl.name }
					</span>
					<span style={ {
						display: 'inline-block', padding: '0 4px', marginLeft: 5,
						fontSize: 9, fontFamily: 'monospace',
						background: hColor, color: '#ddd', borderRadius: 2,
					} }>
						{ tpl.category }
					</span>
					{ tpl.builtIn && (
						<span style={ { marginLeft: 4, fontSize: 9, color: '#555' } } title="Built-in">🔒</span>
					) }
				</FlexBlock>
				<Flex gap={ 1 }>
					<Button isSmall variant="secondary" onClick={ () => onStamp( tpl ) }>
						{ __( 'Stamp', 'blender-node-diagram' ) }
					</Button>
					{ onDelete && (
						<Button isSmall isDestructive icon="remove"
							label={ __( 'Delete template', 'blender-node-diagram' ) }
							onClick={ () => onDelete( tpl.id ) }
						/>
					) }
				</Flex>
			</Flex>
			{ tpl.description && (
				<p style={ { fontSize: 9, color: '#555', margin: '3px 0 0', fontFamily: 'monospace' } }>
					{ tpl.description }
				</p>
			) }
		</div>
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
	const diagramRef = useRef( null );

	const [ nodes,          setNodes          ] = useState( () => initialData?.nodes       ?? [] );
	const [ connections,    setConnections    ] = useState( () => initialData?.connections ?? [] );
	const [ editingId,      setEditingId      ] = useState( null );
	const [ draft,          setDraft          ] = useState( null );
	const [ connDraft,      setConnDraft      ] = useState( newConn );
	const [ connError,      setConnError      ] = useState( '' );
	const [ userTemplates,  setUserTemplates  ] = useState( [] );
	const [ tplSearch,      setTplSearch      ] = useState( '' );
	const [ tplCategory,    setTplCategory    ] = useState( '' );
	const [ savingTpl,      setSavingTpl      ] = useState( false );

	// Fetch user templates on mount
	useEffect( () => {
		apiFetch( { path: '/blender-node-diagram/v1/templates' } )
			.then( ( data ) => setUserTemplates( Array.isArray( data ) ? data : [] ) )
			.catch( () => {} );
	}, [] );

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

	// ── Template operations ───────────────────────────────────────────────────

	const addNodeFromTemplate = useCallback( ( tpl ) => {
		const pos  = stampPosition( nodes );
		const node = {
			id:       `node_${ Date.now() }`,
			label:    tpl.name,
			category: tpl.category,
			...( tpl.subtype ? { subtype: tpl.subtype } : {} ),
			inputs:   deepClone( tpl.inputs  ),
			outputs:  deepClone( tpl.outputs ),
			...pos,
		};
		setNodes( ( prev ) => [ ...prev, node ] );
		startEditing( node );
	}, [ nodes, startEditing ] );

	const deleteUserTemplate = useCallback( ( id ) => {
		apiFetch( { path: `/blender-node-diagram/v1/templates/${ id }`, method: 'DELETE' } )
			.then( () => setUserTemplates( ( prev ) => prev.filter( ( t ) => t.id !== id ) ) )
			.catch( () => {} );
	}, [] );

	const saveNodeAsTemplate = useCallback( () => {
		if ( ! draft ) return;
		setSavingTpl( true );
		const tplData = {
			name:     draft.label.replace( /\\n/g, ' ' ).trim() || 'Unnamed',
			category: draft.category || LEGACY_TYPE_CATEGORY[ draft.type ] || 'input',
			inputs:   deepClone( draft.inputs  ),
			outputs:  deepClone( draft.outputs ),
			...( draft.subtype ? { subtype: draft.subtype } : {} ),
		};
		apiFetch( { path: '/blender-node-diagram/v1/templates', method: 'POST', data: tplData } )
			.then( ( created ) => setUserTemplates( ( prev ) => [ ...prev, created ] ) )
			.catch( () => {} )
			.finally( () => setSavingTpl( false ) );
	}, [ draft ] );

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
		...nodes.map( ( n ) => ( { label: `${ n.id }  (${ n.category || n.type || '?' })`, value: n.id } ) ),
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

					{/* ── Templates ─────────────────────────────────────────── */}
					<section>
						<strong style={ { ...LABEL_STYLE, display: 'block', marginBottom: 6 } }>
							{ __( 'Templates', 'blender-node-diagram' ) }
						</strong>

						{/* Category filter pills */}
						<div style={ { display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 } }>
							{ NODE_CATEGORIES.map( ( { label, value } ) => {
								const active  = tplCategory === value;
								const hColor  = CATEGORY_COLORS[ value ]?.h ?? '#333';
								return (
									<button
										key={ value }
										onClick={ () => setTplCategory( active ? '' : value ) }
										title={ label }
										style={ {
											padding: '2px 6px', fontSize: 9,
											fontFamily: 'monospace', borderRadius: 2,
											border: active ? `1px solid ${ hColor }` : '1px solid #2a2a2a',
											background: active ? hColor : '#111',
											color: active ? '#eee' : '#555',
											cursor: 'pointer', lineHeight: '1.4',
										} }
									>
										{ label }
									</button>
								);
							} ) }
						</div>

						<input
							type="search"
							placeholder={ __( 'Search templates…', 'blender-node-diagram' ) }
							value={ tplSearch }
							onChange={ ( e ) => setTplSearch( e.target.value ) }
							style={ {
								width: '100%', padding: '4px 6px', marginBottom: 8,
								background: '#111', border: '1px solid #2a2a2a', borderRadius: 3,
								color: '#ccc', fontSize: 11, fontFamily: 'monospace', boxSizing: 'border-box',
							} }
						/>

						{ ( () => {
							const q    = tplSearch.toLowerCase();
							const test = ( t ) =>
								( ! tplCategory || t.category === tplCategory ) &&
								( ! q || t.name.toLowerCase().includes( q ) || t.category.includes( q ) );

							const builtins = BUILTIN_TEMPLATES.filter( test );
							const user     = userTemplates.filter( test );

							if ( ! builtins.length && ! user.length ) {
								return (
									<p style={ { color: '#444', fontSize: 11, fontStyle: 'italic' } }>
										{ __( 'No templates match.', 'blender-node-diagram' ) }
									</p>
								);
							}

							return (
								<>
									{ builtins.length > 0 && (
										<>
											<p style={ { fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px', fontFamily: 'monospace' } }>
												{ __( 'Built-in', 'blender-node-diagram' ) }
											</p>
											{ builtins.map( ( tpl ) => (
												<TemplateCard key={ tpl.id } tpl={ tpl } onStamp={ addNodeFromTemplate } />
											) ) }
										</>
									) }
									{ user.length > 0 && (
										<>
											<p style={ { fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '8px 0 4px', fontFamily: 'monospace' } }>
												{ __( 'My Templates', 'blender-node-diagram' ) }
											</p>
											{ user.map( ( tpl ) => (
												<TemplateCard key={ tpl.id } tpl={ tpl }
													onStamp={ addNodeFromTemplate }
													onDelete={ deleteUserTemplate }
												/>
											) ) }
										</>
									) }
								</>
							);
						} )() }
					</section>

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
										<TypeBadge node={ node } />
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
										<SelectControl label={ __( 'Category', 'blender-node-diagram' ) }
											value={ draft.category || LEGACY_TYPE_CATEGORY[ draft.type ] || 'input' }
											options={ NODE_CATEGORIES }
											onChange={ ( val ) => setDraft( ( d ) => ( { ...d, category: val } ) ) }
											__nextHasNoMarginBottom />
										<div style={ { height: 8 } } />
										<SelectControl label={ __( 'Rendering Variant', 'blender-node-diagram' ) }
											value={ draft.subtype || '' }
											options={ [
												{ label: __( 'Standard', 'blender-node-diagram' ),    value: '' },
												{ label: __( 'Color Ramp', 'blender-node-diagram' ),  value: 'colorRamp' },
												{ label: __( 'Mix Color', 'blender-node-diagram' ),   value: 'mixColor' },
											] }
											onChange={ ( val ) => setDraft( ( d ) => {
												const upd = { ...d, subtype: val || undefined };
												if ( ! val ) delete upd.subtype;
												return upd;
											} ) }
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

										{/* ── Color Ramp stops ──────────────────────────────── */}
										{ ( draft.subtype === 'colorRamp' || draft.type === 'colorRamp' ) && (
											<div style={ { marginTop: 10 } }>
												<Flex align="center" justify="space-between" style={ { marginBottom: 6 } }>
													<strong style={ LABEL_STYLE }>
														{ __( 'Ramp Stops', 'blender-node-diagram' ) }
													</strong>
													<Button isSmall variant="secondary" icon="plus"
														onClick={ () => {
															const stops = draft.rampStops?.length
																? [ ...draft.rampStops ]
																: [ ...DEFAULT_RAMP_STOPS ];
															stops.push( { pos: 0.5, color: '#888888' } );
															setDraft( ( d ) => ( { ...d, rampStops: stops } ) );
														} }>
														{ __( 'Add Stop', 'blender-node-diagram' ) }
													</Button>
												</Flex>
												{ ( draft.rampStops ?? DEFAULT_RAMP_STOPS ).map( ( stop, si ) => (
													<Flex key={ si } align="flex-end" gap={ 2 } style={ { marginBottom: 4 } }>
														<FlexItem style={ { width: 60 } }>
															<TextControl
																label={ si === 0 ? __( 'Pos', 'blender-node-diagram' ) : '' }
																type="number" min={ 0 } max={ 1 } step={ 0.01 }
																value={ stop.pos }
																onChange={ ( val ) => {
																	const stops = [ ...( draft.rampStops ?? DEFAULT_RAMP_STOPS ) ];
																	stops[ si ] = { ...stops[ si ], pos: parseFloat( val ) };
																	setDraft( ( d ) => ( { ...d, rampStops: stops } ) );
																} }
																__nextHasNoMarginBottom
															/>
														</FlexItem>
														<FlexBlock>
															<div style={ { paddingBottom: 2 } }>
																{ si === 0 && (
																	<label style={ { display: 'block', fontSize: 11, color: '#888', marginBottom: 4 } }>
																		{ __( 'Color', 'blender-node-diagram' ) }
																	</label>
																) }
																<input
																	type="color"
																	value={ stop.color }
																	style={ { width: '100%', height: 28, border: '1px solid #333', borderRadius: 3, cursor: 'pointer', background: 'none' } }
																	onChange={ ( e ) => {
																		const stops = [ ...( draft.rampStops ?? DEFAULT_RAMP_STOPS ) ];
																		stops[ si ] = { ...stops[ si ], color: e.target.value };
																		setDraft( ( d ) => ( { ...d, rampStops: stops } ) );
																	} }
																/>
															</div>
														</FlexBlock>
														<FlexItem>
															<Button isSmall isDestructive icon="remove"
																label={ __( 'Remove stop', 'blender-node-diagram' ) }
																onClick={ () => {
																	const stops = ( draft.rampStops ?? DEFAULT_RAMP_STOPS ).filter( ( _, j ) => j !== si );
																	setDraft( ( d ) => ( { ...d, rampStops: stops } ) );
																} }
															/>
														</FlexItem>
													</Flex>
												) ) }
											</div>
										) }

										{/* ── Mix Color blend mode ───────────────────────────── */}
										{ ( draft.subtype === 'mixColor' || draft.type === 'mixColor' ) && (
											<div style={ { marginTop: 10 } }>
												<SelectControl
													label={ __( 'Blend Mode', 'blender-node-diagram' ) }
													value={ draft.blendMode ?? 'Mix' }
													options={ MIX_BLEND_MODES.map( ( m ) => ( { label: m, value: m } ) ) }
													onChange={ ( val ) => setDraft( ( d ) => ( { ...d, blendMode: val } ) ) }
													__nextHasNoMarginBottom
												/>
											</div>
										) }

										<Flex gap={ 2 } style={ { marginTop: 10 } }>
											<Button variant="primary" isSmall onClick={ saveEditing }>
												{ __( 'Save Node', 'blender-node-diagram' ) }
											</Button>
											<Button isSmall onClick={ cancelEditing }>
												{ __( 'Cancel', 'blender-node-diagram' ) }
											</Button>
										</Flex>
										<div style={ { marginTop: 6, borderTop: '1px solid #222', paddingTop: 6 } }>
											<Button isSmall variant="tertiary" isBusy={ savingTpl }
												disabled={ savingTpl }
												onClick={ saveNodeAsTemplate }
												title={ __( 'Save this node\'s configuration as a reusable template', 'blender-node-diagram' ) }
											>
												{ __( '+ Save as Template', 'blender-node-diagram' ) }
											</Button>
										</div>
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
					flex: 1, overflow: 'hidden', position: 'relative',
					background: '#0f0f0f',
					backgroundImage: 'radial-gradient(circle, #1e1e1e 1px, transparent 1px)',
					backgroundSize: '22px 22px',
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
							ref={ diagramRef }
							nodes={ previewNodes }
							connections={ connections }
							editingId={ editingId }
							onNodeMove={ handleNodeMove }
							onNodeSelect={ handleNodeSelect }
							onConnect={ handleConnect }
						/>
					) }

					{/* Zoom controls */}
					{ previewNodes.length > 0 && (
						<div style={ {
							position: 'absolute', bottom: 10, right: 10,
							display: 'flex', flexDirection: 'column', gap: 2,
							zIndex: 1,
						} }>
							<Button isSmall variant="secondary"
								onClick={ () => diagramRef.current?.fitView() }
								title={ __( 'Fit all nodes into view', 'blender-node-diagram' ) }
								style={ { minWidth: 28, justifyContent: 'center', fontFamily: 'monospace' } }>
								⊡
							</Button>
							<Button isSmall variant="secondary"
								onClick={ () => diagramRef.current?.zoomIn() }
								title={ __( 'Zoom in', 'blender-node-diagram' ) }
								style={ { minWidth: 28, justifyContent: 'center', fontFamily: 'monospace', fontSize: 16 } }>
								+
							</Button>
							<Button isSmall variant="secondary"
								onClick={ () => diagramRef.current?.zoomOut() }
								title={ __( 'Zoom out', 'blender-node-diagram' ) }
								style={ { minWidth: 28, justifyContent: 'center', fontFamily: 'monospace', fontSize: 16 } }>
								−
							</Button>
						</div>
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
