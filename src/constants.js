/**
 * constants.js
 *
 * Shared look-up tables used by the renderer, diagram builder, and editor.
 * Single source of truth for node types, socket types, and their colours.
 */

export const NODE_TYPES = [
	{ label: 'Geometry',     value: 'geometry'   },
	{ label: 'Vector Math',  value: 'vectorMath' },
	{ label: 'Math',         value: 'math'       },
	{ label: 'Value',        value: 'value'      },
	{ label: 'Emission',     value: 'emission'   },
	{ label: 'Output',       value: 'output'     },
	{ label: 'Group Input',  value: 'groupIn'    },
	{ label: 'Group Output', value: 'groupOut'   },
];

export const SOCKET_TYPES = [
	{ label: 'Vector', value: 'vector' },
	{ label: 'Value',  value: 'value'  },
	{ label: 'Shader', value: 'shader' },
	{ label: 'Color',  value: 'color'  },
];

/** Header colour for each node type (matches the renderer palette). */
export const NODE_TYPE_COLORS = {
	geometry:   '#2A5555',
	vectorMath: '#253068',
	math:       '#243E24',
	value:      '#3C3C3C',
	emission:   '#3E2252',
	output:     '#2E1E1E',
	groupIn:    '#3C2E0E',
	groupOut:   '#3C2E0E',
};

/** Wire / socket dot colour for each socket type. */
export const SOCKET_COLORS = {
	vector: '#7878CC',
	value:  '#8E8E8E',
	shader: '#48AA80',
	color:  '#C8A840',
};
