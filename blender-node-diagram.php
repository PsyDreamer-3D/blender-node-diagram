<?php
/**
 * Plugin Name:       Blender Node Diagram
 * Plugin URI:        https://github.com/PsyDreamer-3D
 * Description:       Two Gutenberg blocks for rendering Blender shader node diagrams.
 *                    Includes three Blinn-Phong presets, a full-screen visual diagram
 *                    builder for custom node networks, and a static N/L/V/H concept
 *                    illustration block.
 * Version:           {{VERSION}}
 * Requires at least: 6.3
 * Requires PHP:      8.0
 * Author:            Jess
 * License:           GPL-2.0-or-later
 * Text Domain:       blender-node-diagram
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register both blocks from their respective block.json files.
 *
 * - blender-node-diagram/diagram  — data-driven SVG renderer (diagram block)
 * - blender-node-diagram/concept  — static N/L/V/H vector illustration
 *
 * The concept block shares the same editorScript and stylesheet as the main
 * block; WordPress deduplicates asset handles so they are only enqueued once.
 */
function blender_node_diagram_register_blocks(): void {
	register_block_type( __DIR__ . '/block.json' );
	register_block_type( __DIR__ . '/concept-block.json' );
}
add_action( 'init', 'blender_node_diagram_register_blocks' );

require_once __DIR__ . '/includes/class-template-api.php';
add_action( 'rest_api_init', [ 'Blender_Node_Diagram_Template_API', 'register_routes' ] );
