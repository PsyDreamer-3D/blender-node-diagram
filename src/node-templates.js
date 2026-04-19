/**
 * node-templates.js
 *
 * Built-in node templates — read-only, ship with the plugin.
 * Socket definitions mirror Blender 4.x defaults (common inputs only).
 *
 * User-created templates are fetched from the REST API and merged at runtime.
 */

export const BUILTIN_TEMPLATES = [
	{
		id:          'builtin_principled_bsdf',
		name:        'Principled BSDF',
		category:    'shader',
		description: 'PBR uber-shader. The standard workhorse for physically based materials.',
		builtIn:     true,
		inputs: [
			{ label: 'Base Color',    type: 'color',  defaultColor: '#808080' },
			{ label: 'Metallic',      type: 'value' },
			{ label: 'Roughness',     type: 'value' },
			{ label: 'IOR',           type: 'value' },
			{ label: 'Alpha',         type: 'value' },
			{ label: 'Normal',        type: 'vector' },
			{ label: 'Emission Color',type: 'color',  defaultColor: '#000000' },
			{ label: 'Emission Strength', type: 'value' },
		],
		outputs: [
			{ label: 'BSDF', type: 'shader' },
		],
	},
	{
		id:          'builtin_diffuse_bsdf',
		name:        'Diffuse BSDF',
		category:    'shader',
		description: 'Lambertian / Oren-Nayar diffuse reflectance.',
		builtIn:     true,
		inputs: [
			{ label: 'Color',    type: 'color',  defaultColor: '#808080' },
			{ label: 'Roughness',type: 'value' },
			{ label: 'Normal',   type: 'vector' },
		],
		outputs: [
			{ label: 'BSDF', type: 'shader' },
		],
	},
	{
		id:          'builtin_glossy_bsdf',
		name:        'Glossy BSDF',
		category:    'shader',
		description: 'Specular reflection BSDF with various distribution models.',
		builtIn:     true,
		inputs: [
			{ label: 'Color',    type: 'color',  defaultColor: '#ffffff' },
			{ label: 'Roughness',type: 'value' },
			{ label: 'Normal',   type: 'vector' },
		],
		outputs: [
			{ label: 'BSDF', type: 'shader' },
		],
	},
	{
		id:          'builtin_mix_shader',
		name:        'Mix Shader',
		category:    'shader',
		description: 'Blend two shaders together using a factor.',
		builtIn:     true,
		inputs: [
			{ label: 'Fac',    type: 'value' },
			{ label: 'Shader', type: 'shader' },
			{ label: 'Shader', type: 'shader' },
		],
		outputs: [
			{ label: 'Shader', type: 'shader' },
		],
	},
	{
		id:          'builtin_add_shader',
		name:        'Add Shader',
		category:    'shader',
		description: 'Add two shader contributions together.',
		builtIn:     true,
		inputs: [
			{ label: 'Shader', type: 'shader' },
			{ label: 'Shader', type: 'shader' },
		],
		outputs: [
			{ label: 'Shader', type: 'shader' },
		],
	},
	{
		id:          'builtin_material_output',
		name:        'Material Output',
		category:    'output',
		description: 'Final output node — connects the shader tree to the material.',
		builtIn:     true,
		inputs: [
			{ label: 'Surface',      type: 'shader' },
			{ label: 'Volume',       type: 'shader' },
			{ label: 'Displacement', type: 'vector' },
		],
		outputs: [],
	},
	{
		id:          'builtin_fresnel',
		name:        'Fresnel',
		category:    'input',
		description: 'Returns the amount of light reflected from a surface at grazing angles.',
		builtIn:     true,
		inputs: [
			{ label: 'IOR',    type: 'value' },
			{ label: 'Normal', type: 'vector' },
		],
		outputs: [
			{ label: 'Fac', type: 'value' },
		],
	},
	{
		id:          'builtin_layer_weight',
		name:        'Layer Weight',
		category:    'input',
		description: 'Fresnel and facing weight for layering shaders.',
		builtIn:     true,
		inputs: [
			{ label: 'Blend',  type: 'value' },
			{ label: 'Normal', type: 'vector' },
		],
		outputs: [
			{ label: 'Fresnel', type: 'value' },
			{ label: 'Facing',  type: 'value' },
		],
	},
	{
		id:          'builtin_tex_coord',
		name:        'Texture Coordinate',
		category:    'input',
		description: 'Provides UV, object-space, world-space, and other coordinate outputs.',
		builtIn:     true,
		inputs: [],
		outputs: [
			{ label: 'Generated',  type: 'vector' },
			{ label: 'Normal',     type: 'vector' },
			{ label: 'UV',         type: 'vector' },
			{ label: 'Object',     type: 'vector' },
			{ label: 'Camera',     type: 'vector' },
			{ label: 'Window',     type: 'vector' },
			{ label: 'Reflection', type: 'vector' },
		],
	},
	{
		id:          'builtin_noise_texture',
		name:        'Noise Texture',
		category:    'texture',
		description: 'Perlin-style fractal noise — produces organic, cloud-like patterns.',
		builtIn:     true,
		inputs: [
			{ label: 'Vector',     type: 'vector' },
			{ label: 'Scale',      type: 'value' },
			{ label: 'Detail',     type: 'value' },
			{ label: 'Roughness',  type: 'value' },
			{ label: 'Distortion', type: 'value' },
		],
		outputs: [
			{ label: 'Fac',   type: 'value' },
			{ label: 'Color', type: 'color' },
		],
	},
	{
		id:          'builtin_image_texture',
		name:        'Image Texture',
		category:    'texture',
		description: 'Sample a bitmap image texture using UV coordinates.',
		builtIn:     true,
		inputs: [
			{ label: 'Vector', type: 'vector' },
		],
		outputs: [
			{ label: 'Color', type: 'color' },
			{ label: 'Alpha', type: 'value' },
		],
	},
	{
		id:          'builtin_voronoi_texture',
		name:        'Voronoi Texture',
		category:    'texture',
		description: 'Cell-based procedural texture for rock, pebble, and cell patterns.',
		builtIn:     true,
		inputs: [
			{ label: 'Vector',    type: 'vector' },
			{ label: 'Scale',     type: 'value' },
			{ label: 'Randomness',type: 'value' },
		],
		outputs: [
			{ label: 'Distance', type: 'value' },
			{ label: 'Color',    type: 'color' },
			{ label: 'Position', type: 'vector' },
		],
	},
	{
		id:          'builtin_color_ramp',
		name:        'Color Ramp',
		category:    'converter',
		subtype:     'colorRamp',
		description: 'Map a value to a color using a gradient.',
		builtIn:     true,
		inputs: [
			{ label: 'Fac', type: 'value' },
		],
		outputs: [
			{ label: 'Color', type: 'color' },
			{ label: 'Alpha', type: 'value' },
		],
	},
	{
		id:          'builtin_mix_color',
		name:        'Mix Color',
		category:    'color',
		subtype:     'mixColor',
		description: 'Blend two colors together using a blend mode.',
		builtIn:     true,
		inputs: [
			{ label: 'Factor', type: 'value' },
			{ label: 'A',      type: 'color', defaultColor: '#000000' },
			{ label: 'B',      type: 'color', defaultColor: '#ffffff' },
		],
		outputs: [
			{ label: 'Result', type: 'color' },
		],
	},
	{
		id:          'builtin_map_range',
		name:        'Map Range',
		category:    'converter',
		description: 'Remap a value from one range to another.',
		builtIn:     true,
		inputs: [
			{ label: 'Value',    type: 'value' },
			{ label: 'From Min', type: 'value' },
			{ label: 'From Max', type: 'value' },
			{ label: 'To Min',   type: 'value' },
			{ label: 'To Max',   type: 'value' },
		],
		outputs: [
			{ label: 'Result', type: 'value' },
		],
	},
	{
		id:          'builtin_math',
		name:        'Math',
		category:    'converter',
		description: 'Perform a math operation on one or two values.',
		builtIn:     true,
		inputs: [
			{ label: 'Value', type: 'value' },
			{ label: 'Value', type: 'value' },
		],
		outputs: [
			{ label: 'Value', type: 'value' },
		],
	},
	{
		id:          'builtin_vector_math',
		name:        'Vector Math',
		category:    'vector',
		description: 'Perform math operations on vectors.',
		builtIn:     true,
		inputs: [
			{ label: 'Vector', type: 'vector' },
			{ label: 'Vector', type: 'vector' },
		],
		outputs: [
			{ label: 'Vector', type: 'vector' },
			{ label: 'Value',  type: 'value' },
		],
	},
	{
		id:          'builtin_bump',
		name:        'Bump',
		category:    'vector',
		description: 'Generate a perturbed normal from a scalar height texture.',
		builtIn:     true,
		inputs: [
			{ label: 'Strength', type: 'value' },
			{ label: 'Distance', type: 'value' },
			{ label: 'Height',   type: 'value' },
			{ label: 'Normal',   type: 'vector' },
		],
		outputs: [
			{ label: 'Normal', type: 'vector' },
		],
	},
	{
		id:          'builtin_normal_map',
		name:        'Normal Map',
		category:    'vector',
		description: 'Perturb normals using a baked normal map texture.',
		builtIn:     true,
		inputs: [
			{ label: 'Strength', type: 'value' },
			{ label: 'Color',    type: 'color' },
		],
		outputs: [
			{ label: 'Normal', type: 'vector' },
		],
	},
	{
		id:          'builtin_separate_xyz',
		name:        'Separate XYZ',
		category:    'converter',
		description: 'Split a vector into its X, Y, Z float components.',
		builtIn:     true,
		inputs: [
			{ label: 'Vector', type: 'vector' },
		],
		outputs: [
			{ label: 'X', type: 'value' },
			{ label: 'Y', type: 'value' },
			{ label: 'Z', type: 'value' },
		],
	},
	{
		id:          'builtin_combine_xyz',
		name:        'Combine XYZ',
		category:    'converter',
		description: 'Combine three float values into a vector.',
		builtIn:     true,
		inputs: [
			{ label: 'X', type: 'value' },
			{ label: 'Y', type: 'value' },
			{ label: 'Z', type: 'value' },
		],
		outputs: [
			{ label: 'Vector', type: 'vector' },
		],
	},
];
