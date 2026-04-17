/**
 * edit.js — Block editor component.
 *
 * Provides a live SVG preview inside the block editor, with an
 * InspectorControls panel for selecting the diagram type and editing
 * the label / caption.
 *
 * When diagramType is 'custom', an "Open Diagram Builder" button launches
 * the full-screen visual node editor (DiagramBuilder modal).
 */

import { useEffect, useRef, useState } from '@wordpress/element';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import {
	PanelBody,
	SelectControl,
	TextControl,
	TextareaControl,
	Button,
	Notice,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { renderDiagram }  from './renderer';
import { getDiagramData } from './diagrams';
import DiagramBuilder     from './diagram-builder';

export default function Edit( { attributes, setAttributes } ) {
	const { diagramType, customData, label, caption } = attributes;
	const svgRef              = useRef( null );
	const [ isBuilderOpen, setIsBuilderOpen ] = useState( false );
	const blockProps          = useBlockProps( { className: 'blender-node-diagram' } );

	// Re-render the SVG preview whenever the diagram type or custom data changes.
	useEffect( () => {
		if ( ! svgRef.current ) return;

		const data = getDiagramData( diagramType, customData );
		if ( data ) {
			renderDiagram( svgRef.current, data );
		} else {
			while ( svgRef.current.firstChild ) {
				svgRef.current.removeChild( svgRef.current.firstChild );
			}
			svgRef.current.removeAttribute( 'viewBox' );
			svgRef.current.removeAttribute( 'width' );
			svgRef.current.removeAttribute( 'height' );
		}
	}, [ diagramType, customData ] );

	const isCustomInvalid =
		diagramType === 'custom' &&
		customData.trim() !== '' &&
		getDiagramData( 'custom', customData ) === null;

	// Parse stored JSON safely to seed the builder with existing data.
	const getParsedCustomData = () => {
		if ( ! customData ) return null;
		try { return JSON.parse( customData ); } catch { return null; }
	};

	return (
		<>
			<InspectorControls>
				<PanelBody
					title={ __( 'Diagram Settings', 'blender-node-diagram' ) }
					initialOpen={ true }
				>
					<SelectControl
						label={ __( 'Diagram Type', 'blender-node-diagram' ) }
						value={ diagramType }
						options={ [
							{ label: __( 'Blinn-Phong Node Chain', 'blender-node-diagram' ),  value: 'blinn'  },
							{ label: __( 'Sharpness Sub-Network',  'blender-node-diagram' ),  value: 'sharp'  },
							{ label: __( 'Full NPR Glossy Group',  'blender-node-diagram' ),  value: 'group'  },
							{ label: __( 'Custom (JSON)',           'blender-node-diagram' ),  value: 'custom' },
						] }
						onChange={ ( val ) => setAttributes( { diagramType: val } ) }
					/>

					{ diagramType === 'custom' && (
						<>
							{ /* Primary CTA: open the visual builder */ }
							<Button
								variant="secondary"
								icon="edit"
								onClick={ () => setIsBuilderOpen( true ) }
								style={ { width: '100%', justifyContent: 'center', marginBottom: 8 } }
							>
								{ customData
									? __( 'Edit in Diagram Builder', 'blender-node-diagram' )
									: __( 'Open Diagram Builder', 'blender-node-diagram' )
								}
							</Button>

							{ isCustomInvalid && (
								<Notice status="error" isDismissible={ false } style={ { marginBottom: 8 } }>
									{ __( 'Invalid JSON — diagram cannot be rendered.', 'blender-node-diagram' ) }
								</Notice>
							) }

							{ /* Fallback: raw JSON textarea for power users / paste-in */ }
							<TextareaControl
								label={ __( 'Raw JSON (advanced)', 'blender-node-diagram' ) }
								help={ __( '{ nodes: [...], connections: [...] }', 'blender-node-diagram' ) }
								value={ customData }
								onChange={ ( val ) => setAttributes( { customData: val } ) }
								rows={ 6 }
							/>
						</>
					) }
				</PanelBody>

				<PanelBody
					title={ __( 'Label & Caption', 'blender-node-diagram' ) }
					initialOpen={ false }
				>
					<TextControl
						label={ __( 'Figure Label', 'blender-node-diagram' ) }
						help={ __( 'Small-caps text shown above the diagram.', 'blender-node-diagram' ) }
						value={ label }
						onChange={ ( val ) => setAttributes( { label: val } ) }
					/>
					<TextControl
						label={ __( 'Caption', 'blender-node-diagram' ) }
						help={ __( 'Centred text shown below the diagram.', 'blender-node-diagram' ) }
						value={ caption }
						onChange={ ( val ) => setAttributes( { caption: val } ) }
					/>
				</PanelBody>
			</InspectorControls>

			{ /* Diagram Builder modal — only mounted when open */ }
			{ isBuilderOpen && (
				<DiagramBuilder
					initialData={ getParsedCustomData() }
					onApply={ ( json ) => {
						setAttributes( { customData: json, diagramType: 'custom' } );
						setIsBuilderOpen( false );
					} }
					onClose={ () => setIsBuilderOpen( false ) }
				/>
			) }

			<div { ...blockProps }>
				{ label && (
					<div className="diagram-label">{ label }</div>
				) }
				<div className="diagram-scroll">
					<svg
						ref={ svgRef }
						xmlns="http://www.w3.org/2000/svg"
						style={ { display: 'block' } }
					/>
				</div>
				{ caption && (
					<div className="diagram-caption">{ caption }</div>
				) }
			</div>
		</>
	);
}
