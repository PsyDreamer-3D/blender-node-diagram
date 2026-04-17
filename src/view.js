/**
 * view.js — Frontend view script (loaded via block.json "viewScript").
 *
 * WordPress only enqueues this file on pages that contain the block,
 * so it is safe to query-select without checking for the block first.
 */

import { renderDiagram } from './renderer';
import { getDiagramData } from './diagrams';

function initDiagrams() {
	document
		.querySelectorAll( '.blender-node-diagram svg[data-diagram-type]' )
		.forEach( ( svg ) => {
			const type       = svg.dataset.diagramType;
			const customJson = svg.dataset.diagramCustom ?? '';
			const data       = getDiagramData( type, customJson );

			if ( data ) {
				renderDiagram( svg, data );
			}
		} );
}

// Kick off rendering once the DOM is ready.
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', initDiagrams );
} else {
	initDiagrams();
}
