/**
 * concept-edit.js — Editor component for the Blinn-Phong Vector Diagram block.
 *
 * This block renders a fixed, static illustration — the only user-editable
 * attribute is the caption text below the diagram.
 */

import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import ConceptSVG from './concept-svg';

export default function ConceptEdit( { attributes, setAttributes } ) {
	const { caption } = attributes;
	const blockProps = useBlockProps( {
		className: 'blender-node-diagram blender-node-diagram--concept',
	} );

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Caption', 'blender-node-diagram' ) } initialOpen={ true }>
					<TextControl
						label={ __( 'Caption text', 'blender-node-diagram' ) }
						help={ __( 'Shown centred below the diagram.', 'blender-node-diagram' ) }
						value={ caption }
						onChange={ ( val ) => setAttributes( { caption: val } ) }
					/>
				</PanelBody>
			</InspectorControls>

			<div { ...blockProps }>
				<div className="diagram-scroll" style={ { padding: '20px' } }>
					<ConceptSVG />
				</div>
				{ caption && (
					<div className="diagram-caption">{ caption }</div>
				) }
			</div>
		</>
	);
}
