/**
 * index.js — Block registration entry point (editor script).
 *
 * Registers:
 *   1. blender-node-diagram/diagram      — the data-driven diagram block
 *      └─ with three preset variations (blinn, sharp, group)
 *   2. blender-node-diagram/concept      — the static N/L/V/H vector diagram
 */

import { registerBlockType, registerBlockVariation } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';

import metadata    from '../block.json';
import Edit        from './edit';
import Save        from './save';
import ConceptEdit from './concept-edit';
import ConceptSave from './concept-save';

// ─── 1. Main diagram block ────────────────────────────────────────────────────

registerBlockType( metadata.name, {
	edit: Edit,
	save: Save,
} );

// ── Preset variations — appear as distinct options in the block inserter ──────

registerBlockVariation( metadata.name, {
	name:        'blinn-phong',
	title:       __( 'Blinn-Phong Node Chain', 'blender-node-diagram' ),
	description: __( 'The Geometry → Half-vector → Dot Product → Power → Emission node chain.', 'blender-node-diagram' ),
	icon:        'share-alt2',
	attributes:  {
		diagramType: 'blinn',
		label:       'Blinn-Phong specular node chain',
		caption:     "The Geometry node's Normal output runs a long wire directly to Dot Product input A — bypassing Scale, Add, and Normalize. That's correct.",
	},
	scope:     [ 'inserter', 'transform' ],
	isDefault: true,
} );

registerBlockVariation( metadata.name, {
	name:        'sharpness-network',
	title:       __( 'Sharpness Sub-Network', 'blender-node-diagram' ),
	description: __( 'The sharpness post-process power curve applied after the Blinn-Phong specular result.', 'blender-node-diagram' ),
	icon:        'share-alt2',
	attributes:  {
		diagramType: 'sharp',
		label:       'Sharpness control sub-network',
		caption:     'The "Specular (S)" node on the left represents the output of the Blinn-Phong Power node. The right output feeds into the final Multiply.',
	},
	scope: [ 'inserter', 'transform' ],
} );

registerBlockVariation( metadata.name, {
	name:        'npr-glossy-group',
	title:       __( 'Full NPR Glossy Group', 'blender-node-diagram' ),
	description: __( 'Complete node group interior with all five controls exposed via Group Input/Output.', 'blender-node-diagram' ),
	icon:        'share-alt2',
	attributes:  {
		diagramType: 'group',
		label:       'Complete NPR Glossy node group (interior)',
		caption:     'Pack all nodes between a Group Input and Group Output to create the reusable node group. Combine the Emission output with your toon diffuse using Add Shader.',
	},
	scope: [ 'inserter', 'transform' ],
} );

// ─── 2. Concept (vector geometry) block ──────────────────────────────────────

registerBlockType( 'blender-node-diagram/concept', {
	title:       __( 'Blinn-Phong Vector Diagram', 'blender-node-diagram' ),
	category:    'media',
	icon:        'share-alt2',
	description: __( 'Static illustration of the N, L, V, H vector geometry at a shading point.', 'blender-node-diagram' ),
	attributes:  {
		caption: {
			type:    'string',
			default: 'The half-vector H bisects L and V. When H aligns with N (θ = 0), the highlight is at peak brightness.',
		},
	},
	supports: {
		html:  false,
		align: [ 'wide' ],
	},
	edit: ConceptEdit,
	save: ConceptSave,
} );
