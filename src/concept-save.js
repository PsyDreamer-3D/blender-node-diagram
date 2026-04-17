/**
 * concept-save.js — Save function for the Blinn-Phong Vector Diagram block.
 *
 * The static SVG is embedded directly in the saved post HTML — no script
 * or rendering step is needed on the frontend.
 */

import { useBlockProps } from '@wordpress/block-editor';
import ConceptSVG from './concept-svg';

export default function ConceptSave( { attributes } ) {
	const { caption } = attributes;
	const blockProps = useBlockProps.save( {
		className: 'blender-node-diagram blender-node-diagram--concept',
	} );

	return (
		<div { ...blockProps }>
			<div className="diagram-scroll" style={ { padding: '20px' } }>
				<ConceptSVG />
			</div>
			{ caption && (
				<div className="diagram-caption">{ caption }</div>
			) }
		</div>
	);
}
