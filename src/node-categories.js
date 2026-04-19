/**
 * node-categories.js
 *
 * Blender-style node category system — replaces the old fixed type enum.
 * Categories map to Blender's dark-theme header colours.
 *
 * ⚠ Colours are approximate matches to Blender's default dark theme.
 *   Verify against live Blender screenshots before a public release.
 */

export const NODE_CATEGORIES = [
	{ label: 'Input',     value: 'input'     },
	{ label: 'Shader',    value: 'shader'    },
	{ label: 'Texture',   value: 'texture'   },
	{ label: 'Color',     value: 'color'     },
	{ label: 'Vector',    value: 'vector'    },
	{ label: 'Converter', value: 'converter' },
	{ label: 'Output',    value: 'output'    },
	{ label: 'Group',     value: 'group'     },
	{ label: 'Script',    value: 'script'    },
];

/** Header + body fill for each Blender node category. */
export const CATEGORY_COLORS = {
	input:     { h: '#2A4A6A', b: '#122232' },  // Steel blue
	shader:    { h: '#2E5C2E', b: '#142814' },  // Forest green
	texture:   { h: '#5C3A1E', b: '#2A1A0C' },  // Warm brown
	color:     { h: '#5A3820', b: '#2A1A0C' },  // Amber
	vector:    { h: '#253068', b: '#121638' },  // Dark blue
	converter: { h: '#3A285A', b: '#1C1028' },  // Purple
	output:    { h: '#2E1E1E', b: '#160E0E' },  // Near-black
	group:     { h: '#3C2E0E', b: '#1E1608' },  // Dark gold
	script:    { h: '#1E3A1E', b: '#0C1C0C' },  // Dark green
};
