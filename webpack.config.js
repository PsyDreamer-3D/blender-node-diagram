/**
 * webpack.config.js
 *
 * Extends @wordpress/scripts defaults.
 *
 * Entry points:
 *   index    → build/index.js + build/index.css   (editor bundle)
 *   view     → build/view.js                      (frontend renderer, block-only)
 *   frontend → build/frontend.css                 (shared styles, frontend + editor canvas)
 *   editor   → build/editor.css                   (editor-only overrides)
 *
 * NOTE: "style" is a reserved name inside @wordpress/scripts — using it as an
 * entry key triggers a "-style" suffix on the emitted CSS filename.  "frontend"
 * has no such special treatment.
 */

const defaultConfig  = require( '@wordpress/scripts/config/webpack.config' );
const MiniCssExtract = require( 'mini-css-extract-plugin' );

const plugins = defaultConfig.plugins.map( ( plugin ) =>
	plugin instanceof MiniCssExtract
		? new MiniCssExtract( { filename: '[name].css', chunkFilename: '[name].css' } )
		: plugin
);

module.exports = {
	...defaultConfig,
	entry: {
		index:    './src/index.js',
		view:     './src/view.js',
		frontend: './src/frontend.css',
		editor:   './src/editor.css',
	},
	plugins,
};
