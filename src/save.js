/**
 * save.js — Block save function.
 *
 * Produces static HTML. The <svg> is intentionally empty; the view.js
 * script finds it via data-diagram-type and populates it on the frontend.
 */

import { useBlockProps } from '@wordpress/block-editor';

export default function Save( { attributes } ) {
	const { diagramType, customData, label, caption } = attributes;

	const blockProps = useBlockProps.save( {
		className: 'blender-node-diagram',
	} );

	return (
		<div { ...blockProps }>
			{ label && (
				<div className="diagram-label">{ label }</div>
			) }
			<div className="diagram-scroll">
				{ /*
				 * The SVG is populated by view.js on the frontend.
				 * data-diagram-type tells the script which preset to use.
				 * data-diagram-custom carries raw JSON for custom diagrams.
				 */ }
				<svg
					data-diagram-type={ diagramType }
					{ ...( diagramType === 'custom' && customData
						? { 'data-diagram-custom': customData }
						: {} ) }
					xmlns="http://www.w3.org/2000/svg"
					style={ { display: 'block' } }
				/>
			</div>
			{ caption && (
				<div className="diagram-caption">{ caption }</div>
			) }
		</div>
	);
}
