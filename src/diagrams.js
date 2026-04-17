/**
 * diagrams.js
 *
 * Built-in preset diagram data for the three Blinn-Phong node chains
 * from the "Beyond the BSDF" post, plus a helper that resolves a
 * diagramType string (or raw JSON string) to a diagram data object.
 */

// ─── Preset: Blinn-Phong node chain ──────────────────────────────────────────
export const blinnDiagram = {
	nodes: [
		{
			id: 'geo', type: 'geometry', label: 'Geometry',
			x: 10, y: 80,
			inputs:  [],
			outputs: [
				{ label: 'Normal',   type: 'vector' },
				{ label: 'Incoming', type: 'vector' },
			],
		},
		{
			id: 'scale', type: 'vectorMath', label: 'Vector Math\nScale  ×(−1)',
			x: 195, y: 145,
			inputs:  [
				{ label: 'Vector', type: 'vector' },
				{ label: '−1.0',   type: 'value'  },
			],
			outputs: [ { label: 'V  (view)', type: 'vector' } ],
		},
		{
			id: 'ldir', type: 'value', label: 'Light Dir  (L)',
			x: 195, y: 275,
			inputs:  [],
			outputs: [ { label: 'Vector  (L)', type: 'vector' } ],
		},
		{
			id: 'add', type: 'vectorMath', label: 'Vector Math\nAdd',
			x: 385, y: 185,
			inputs:  [
				{ label: 'A  (V)', type: 'vector' },
				{ label: 'B  (L)', type: 'vector' },
			],
			outputs: [ { label: 'Vector', type: 'vector' } ],
		},
		{
			id: 'norm', type: 'vectorMath', label: 'Vector Math\nNormalize',
			x: 575, y: 185,
			inputs:  [ { label: 'Vector', type: 'vector' } ],
			outputs: [ { label: 'H  (half-vec)', type: 'vector' } ],
		},
		{
			id: 'dot', type: 'vectorMath', label: 'Vector Math\nDot Product',
			x: 765, y: 78,
			inputs:  [
				{ label: 'A  (N)', type: 'vector' },
				{ label: 'B  (H)', type: 'vector' },
			],
			outputs: [ { label: 'Value  (N·H)', type: 'value' } ],
		},
		{
			id: 'max0', type: 'math', label: 'Math\nMaximum',
			x: 955, y: 78,
			inputs:  [
				{ label: 'Value', type: 'value' },
				{ label: '0.0',   type: 'value' },
			],
			outputs: [ { label: 'Clamped', type: 'value' } ],
		},
		{
			id: 'shiny', type: 'value', label: 'Shininess',
			x: 955, y: 230,
			inputs:  [],
			outputs: [ { label: '64.0', type: 'value' } ],
		},
		{
			id: 'power', type: 'math', label: 'Math\nPower',
			x: 1145, y: 78,
			inputs:  [
				{ label: 'Base',     type: 'value' },
				{ label: 'Exponent', type: 'value' },
			],
			outputs: [ { label: 'Specular', type: 'value' } ],
		},
		{
			id: 'intens', type: 'value', label: 'Intensity',
			x: 1145, y: 230,
			inputs:  [],
			outputs: [ { label: '1.0', type: 'value' } ],
		},
		{
			id: 'mul', type: 'math', label: 'Math\nMultiply',
			x: 1335, y: 78,
			inputs:  [
				{ label: 'A', type: 'value' },
				{ label: 'B', type: 'value' },
			],
			outputs: [ { label: 'Value', type: 'value' } ],
		},
		{
			id: 'emit', type: 'emission', label: 'Emission',
			x: 1525, y: 58,
			inputs:  [
				{ label: 'Color',    type: 'color' },
				{ label: 'Strength', type: 'value' },
			],
			outputs: [ { label: 'Emission', type: 'shader' } ],
		},
	],
	connections: [
		{ from: 'geo',   fromOut: 1, to: 'scale', toIn: 0 },
		{ from: 'scale', fromOut: 0, to: 'add',   toIn: 0 },
		{ from: 'ldir',  fromOut: 0, to: 'add',   toIn: 1 },
		{ from: 'add',   fromOut: 0, to: 'norm',  toIn: 0 },
		{ from: 'norm',  fromOut: 0, to: 'dot',   toIn: 1 },
		{ from: 'geo',   fromOut: 0, to: 'dot',   toIn: 0 },
		{ from: 'dot',   fromOut: 0, to: 'max0',  toIn: 0 },
		{ from: 'max0',  fromOut: 0, to: 'power', toIn: 0 },
		{ from: 'shiny', fromOut: 0, to: 'power', toIn: 1 },
		{ from: 'power', fromOut: 0, to: 'mul',   toIn: 0 },
		{ from: 'intens',fromOut: 0, to: 'mul',   toIn: 1 },
		{ from: 'mul',   fromOut: 0, to: 'emit',  toIn: 1 },
	],
};

// ─── Preset: Sharpness sub-network ───────────────────────────────────────────
export const sharpDiagram = {
	nodes: [
		{
			id: 'specin', type: 'value', label: 'Specular  (S)',
			x: 10, y: 145,
			inputs:  [],
			outputs: [ { label: 'Value  (S)', type: 'value' } ],
		},
		{
			id: 'sharp', type: 'value', label: 'Sharpness',
			x: 10, y: 48,
			inputs:  [],
			outputs: [ { label: '0.8', type: 'value' } ],
		},
		{
			id: 'one_s', type: 'value', label: 'Value  1.0',
			x: 10, y: 258,
			inputs:  [],
			outputs: [ { label: '1.0', type: 'value' } ],
		},
		{
			id: 'sub', type: 'math', label: 'Math\nSubtract',
			x: 200, y: 68,
			inputs:  [
				{ label: 'A  (1.0)',       type: 'value' },
				{ label: 'B  (Sharpness)', type: 'value' },
			],
			outputs: [ { label: '1 − sharp', type: 'value' } ],
		},
		{
			id: 'safmax', type: 'math', label: 'Math\nMaximum',
			x: 390, y: 68,
			inputs:  [
				{ label: 'Value',  type: 'value' },
				{ label: '0.001', type: 'value' },
			],
			outputs: [ { label: 'Safe denom', type: 'value' } ],
		},
		{
			id: 'one_d', type: 'value', label: 'Value  1.0',
			x: 390, y: 222,
			inputs:  [],
			outputs: [ { label: '1.0', type: 'value' } ],
		},
		{
			id: 'div', type: 'math', label: 'Math\nDivide',
			x: 580, y: 68,
			inputs:  [
				{ label: 'A  (1.0)',   type: 'value' },
				{ label: 'B  (denom)', type: 'value' },
			],
			outputs: [ { label: 'Exponent', type: 'value' } ],
		},
		{
			id: 'spow', type: 'math', label: 'Math\nPower',
			x: 770, y: 100,
			inputs:  [
				{ label: 'Base  (S)',  type: 'value' },
				{ label: 'Exponent',  type: 'value' },
			],
			outputs: [ { label: 'S  sharpened', type: 'value' } ],
		},
	],
	connections: [
		{ from: 'one_s',  fromOut: 0, to: 'sub',    toIn: 0 },
		{ from: 'sharp',  fromOut: 0, to: 'sub',    toIn: 1 },
		{ from: 'sub',    fromOut: 0, to: 'safmax', toIn: 0 },
		{ from: 'one_d',  fromOut: 0, to: 'div',    toIn: 0 },
		{ from: 'safmax', fromOut: 0, to: 'div',    toIn: 1 },
		{ from: 'div',    fromOut: 0, to: 'spow',   toIn: 1 },
		{ from: 'specin', fromOut: 0, to: 'spow',   toIn: 0 },
	],
};

// ─── Preset: Full NPR Glossy node group ──────────────────────────────────────
export const groupDiagram = {
	nodes: [
		{
			id: 'gin', type: 'groupIn', label: 'Group Input',
			x: 10, y: 80,
			inputs:  [],
			outputs: [
				{ label: 'Light Dir',      type: 'vector' },
				{ label: 'Highlight Size', type: 'value'  },
				{ label: 'Sharpness',      type: 'value'  },
				{ label: 'Glossy Color',   type: 'color'  },
				{ label: 'Glossy Value',   type: 'value'  },
			],
		},
		{
			id: 'geo2', type: 'geometry', label: 'Geometry',
			x: 200, y: 78,
			inputs:  [],
			outputs: [
				{ label: 'Normal',   type: 'vector' },
				{ label: 'Incoming', type: 'vector' },
			],
		},
		{
			id: 'scl2', type: 'vectorMath', label: 'Vector Math\nScale  ×(−1)',
			x: 390, y: 148,
			inputs:  [
				{ label: 'Vector', type: 'vector' },
				{ label: '−1.0',   type: 'value'  },
			],
			outputs: [ { label: 'V', type: 'vector' } ],
		},
		{
			id: 'add2', type: 'vectorMath', label: 'Vector Math\nAdd',
			x: 580, y: 118,
			inputs:  [
				{ label: 'A  (L)', type: 'vector' },
				{ label: 'B  (V)', type: 'vector' },
			],
			outputs: [ { label: 'Vector', type: 'vector' } ],
		},
		{
			id: 'nrm2', type: 'vectorMath', label: 'Vector Math\nNormalize',
			x: 770, y: 118,
			inputs:  [ { label: 'Vector', type: 'vector' } ],
			outputs: [ { label: 'H', type: 'vector' } ],
		},
		{
			id: 'dot2', type: 'vectorMath', label: 'Vector Math\nDot Product',
			x: 960, y: 78,
			inputs:  [
				{ label: 'A  (N)', type: 'vector' },
				{ label: 'B  (H)', type: 'vector' },
			],
			outputs: [ { label: 'N·H', type: 'value' } ],
		},
		{
			id: 'mx2', type: 'math', label: 'Math\nMaximum',
			x: 1150, y: 78,
			inputs:  [
				{ label: 'Value', type: 'value' },
				{ label: '0.0',   type: 'value' },
			],
			outputs: [ { label: 'Clamped', type: 'value' } ],
		},
		{
			id: 'szmul', type: 'math', label: 'Math\nMultiply',
			x: 1150, y: 220,
			inputs:  [
				{ label: 'Size', type: 'value' },
				{ label: '9.0',  type: 'value' },
			],
			outputs: [ { label: 'Value', type: 'value' } ],
		},
		{
			id: 'szpow', type: 'math', label: 'Math\nPower  (base 2)',
			x: 1340, y: 220,
			inputs:  [
				{ label: 'Base  2.0', type: 'value' },
				{ label: 'Exponent',  type: 'value' },
			],
			outputs: [ { label: 'Shininess  n', type: 'value' } ],
		},
		{
			id: 'pwr2', type: 'math', label: 'Math\nPower',
			x: 1340, y: 78,
			inputs:  [
				{ label: 'Base',        type: 'value' },
				{ label: 'Exponent  n', type: 'value' },
			],
			outputs: [ { label: 'Specular  S', type: 'value' } ],
		},
		{
			id: 'sub2', type: 'math', label: 'Math\nSubtract',
			x: 1530, y: 220,
			inputs:  [
				{ label: '1.0',       type: 'value' },
				{ label: 'Sharpness', type: 'value' },
			],
			outputs: [ { label: '1 − sharp', type: 'value' } ],
		},
		{
			id: 'div2', type: 'math', label: 'Math\nDivide',
			x: 1720, y: 220,
			inputs:  [
				{ label: '1.0',   type: 'value' },
				{ label: 'denom', type: 'value' },
			],
			outputs: [ { label: 'Exp', type: 'value' } ],
		},
		{
			id: 'spw2', type: 'math', label: 'Math\nPower',
			x: 1720, y: 78,
			inputs:  [
				{ label: 'Base  (S)', type: 'value' },
				{ label: 'Exp',       type: 'value' },
			],
			outputs: [ { label: 'S  sharp', type: 'value' } ],
		},
		{
			id: 'fmul', type: 'math', label: 'Math\nMultiply',
			x: 1910, y: 78,
			inputs:  [
				{ label: 'S sharp',      type: 'value' },
				{ label: 'Glossy Value', type: 'value' },
			],
			outputs: [ { label: 'Strength', type: 'value' } ],
		},
		{
			id: 'emit2', type: 'emission', label: 'Emission',
			x: 1910, y: 240,
			inputs:  [
				{ label: 'Color',    type: 'color' },
				{ label: 'Strength', type: 'value' },
			],
			outputs: [ { label: 'Emission', type: 'shader' } ],
		},
		{
			id: 'gout', type: 'groupOut', label: 'Group Output',
			x: 2100, y: 190,
			inputs:  [ { label: 'Emission', type: 'shader' } ],
			outputs: [],
		},
	],
	connections: [
		{ from: 'gin',   fromOut: 0, to: 'add2',  toIn: 0 },
		{ from: 'geo2',  fromOut: 1, to: 'scl2',  toIn: 0 },
		{ from: 'scl2',  fromOut: 0, to: 'add2',  toIn: 1 },
		{ from: 'add2',  fromOut: 0, to: 'nrm2',  toIn: 0 },
		{ from: 'nrm2',  fromOut: 0, to: 'dot2',  toIn: 1 },
		{ from: 'geo2',  fromOut: 0, to: 'dot2',  toIn: 0 },
		{ from: 'dot2',  fromOut: 0, to: 'mx2',   toIn: 0 },
		{ from: 'mx2',   fromOut: 0, to: 'pwr2',  toIn: 0 },
		{ from: 'gin',   fromOut: 1, to: 'szmul', toIn: 0 },
		{ from: 'szmul', fromOut: 0, to: 'szpow', toIn: 1 },
		{ from: 'szpow', fromOut: 0, to: 'pwr2',  toIn: 1 },
		{ from: 'pwr2',  fromOut: 0, to: 'spw2',  toIn: 0 },
		{ from: 'gin',   fromOut: 2, to: 'sub2',  toIn: 1 },
		{ from: 'sub2',  fromOut: 0, to: 'div2',  toIn: 1 },
		{ from: 'div2',  fromOut: 0, to: 'spw2',  toIn: 1 },
		{ from: 'spw2',  fromOut: 0, to: 'fmul',  toIn: 0 },
		{ from: 'gin',   fromOut: 4, to: 'fmul',  toIn: 1 },
		{ from: 'gin',   fromOut: 3, to: 'emit2', toIn: 0 },
		{ from: 'fmul',  fromOut: 0, to: 'emit2', toIn: 1 },
		{ from: 'emit2', fromOut: 0, to: 'gout',  toIn: 0 },
	],
};

// ─── Resolver ─────────────────────────────────────────────────────────────────

const PRESETS = {
	blinn: blinnDiagram,
	sharp: sharpDiagram,
	group: groupDiagram,
};

/**
 * Resolve a diagramType string to a diagram data object.
 * For 'custom', attempts to parse customJson; returns null on failure.
 *
 * @param {string} type       - One of 'blinn' | 'sharp' | 'group' | 'custom'
 * @param {string} customJson - Raw JSON string (only used when type === 'custom')
 * @returns {object|null}
 */
export function getDiagramData( type, customJson ) {
	if ( type === 'custom' ) {
		try {
			return JSON.parse( customJson );
		} catch {
			return null;
		}
	}
	return PRESETS[ type ] ?? null;
}
