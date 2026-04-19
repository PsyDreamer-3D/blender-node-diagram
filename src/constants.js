/**
 * constants.js
 *
 * Shared look-up tables used by the renderer, diagram builder, and editor.
 * Node types are now Blender categories (see node-categories.js).
 * NODE_TYPES and NODE_TYPE_COLORS are kept as deprecated aliases so any
 * external code that still imports them doesn't break immediately.
 */

export { NODE_CATEGORIES, CATEGORY_COLORS } from './node-categories';

// ─── Socket types ─────────────────────────────────────────────────────────────

export const SOCKET_TYPES = [
	{ label: 'Vector', value: 'vector' },
	{ label: 'Value',  value: 'value'  },
	{ label: 'Shader', value: 'shader' },
	{ label: 'Color',  value: 'color'  },
];

/** Wire / socket dot colour for each socket type. */
export const SOCKET_COLORS = {
	vector: '#7878CC',
	value:  '#8E8E8E',
	shader: '#48AA80',
	color:  '#C8A840',
};

// ─── Deprecated: legacy node type aliases ─────────────────────────────────────
// These remain so existing code that imports NODE_TYPES / NODE_TYPE_COLORS
// continues to compile. Remove once all consumers are migrated.

/** @deprecated Use NODE_CATEGORIES from node-categories.js instead. */
export { NODE_CATEGORIES as NODE_TYPES } from './node-categories';

/** @deprecated Use CATEGORY_COLORS from node-categories.js instead. */
export { CATEGORY_COLORS as NODE_TYPE_COLORS } from './node-categories';
