<?php
/**
 * REST API controller for user-editable node templates.
 *
 * Templates are stored in wp_options (autoload: false) as a JSON array.
 * Option key: blender_node_diagram_templates
 *
 * Routes (namespace: blender-node-diagram/v1):
 *   GET    /templates          — public read (no auth required)
 *   POST   /templates          — create    (requires edit_posts)
 *   PUT    /templates/{id}     — replace   (requires edit_posts)
 *   DELETE /templates/{id}     — delete    (requires edit_posts)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Blender_Node_Diagram_Template_API {

	const OPTION_KEY = 'blender_node_diagram_templates';
	const REST_NS    = 'blender-node-diagram/v1';

	// ── Route registration ────────────────────────────────────────────────────

	public static function register_routes(): void {
		register_rest_route(
			self::REST_NS,
			'/templates',
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ __CLASS__, 'get_templates' ],
					'permission_callback' => '__return_true',
				],
				[
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => [ __CLASS__, 'create_template' ],
					'permission_callback' => [ __CLASS__, 'write_permission' ],
				],
			]
		);

		register_rest_route(
			self::REST_NS,
			'/templates/(?P<id>[a-zA-Z0-9_-]+)',
			[
				[
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => [ __CLASS__, 'update_template' ],
					'permission_callback' => [ __CLASS__, 'write_permission' ],
					'args'                => [
						'id' => [
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_key',
						],
					],
				],
				[
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => [ __CLASS__, 'delete_template' ],
					'permission_callback' => [ __CLASS__, 'write_permission' ],
					'args'                => [
						'id' => [
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_key',
						],
					],
				],
			]
		);
	}

	public static function write_permission(): bool {
		return current_user_can( 'edit_posts' );
	}

	// ── Handlers ──────────────────────────────────────────────────────────────

	public static function get_templates(): WP_REST_Response {
		return new WP_REST_Response( self::load_templates(), 200 );
	}

	public static function create_template( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$sanitized = self::sanitize_template( $request->get_json_params() );
		if ( is_wp_error( $sanitized ) ) {
			return $sanitized;
		}

		$sanitized['id']      = self::generate_id();
		$sanitized['builtIn'] = false;

		$templates   = self::load_templates();
		$templates[] = $sanitized;

		if ( ! self::save_templates( $templates ) ) {
			return new WP_Error(
				'save_failed',
				__( 'Failed to save template.', 'blender-node-diagram' ),
				[ 'status' => 500 ]
			);
		}

		return new WP_REST_Response( $sanitized, 201 );
	}

	public static function update_template( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id        = $request->get_param( 'id' );
		$sanitized = self::sanitize_template( $request->get_json_params() );
		if ( is_wp_error( $sanitized ) ) {
			return $sanitized;
		}

		$sanitized['id']      = $id;
		$sanitized['builtIn'] = false;

		$templates = self::load_templates();
		$found     = false;

		foreach ( $templates as &$tpl ) {
			if ( $tpl['id'] === $id ) {
				$tpl   = $sanitized;
				$found = true;
				break;
			}
		}
		unset( $tpl );

		if ( ! $found ) {
			return new WP_Error(
				'not_found',
				__( 'Template not found.', 'blender-node-diagram' ),
				[ 'status' => 404 ]
			);
		}

		if ( ! self::save_templates( $templates ) ) {
			return new WP_Error(
				'save_failed',
				__( 'Failed to save template.', 'blender-node-diagram' ),
				[ 'status' => 500 ]
			);
		}

		return new WP_REST_Response( $sanitized, 200 );
	}

	public static function delete_template( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id        = $request->get_param( 'id' );
		$templates = self::load_templates();
		$filtered  = array_values(
			array_filter( $templates, fn( $t ) => $t['id'] !== $id )
		);

		if ( count( $filtered ) === count( $templates ) ) {
			return new WP_Error(
				'not_found',
				__( 'Template not found.', 'blender-node-diagram' ),
				[ 'status' => 404 ]
			);
		}

		if ( ! self::save_templates( $filtered ) ) {
			return new WP_Error(
				'save_failed',
				__( 'Failed to save template.', 'blender-node-diagram' ),
				[ 'status' => 500 ]
			);
		}

		return new WP_REST_Response( null, 204 );
	}

	// ── Storage ───────────────────────────────────────────────────────────────

	private static function load_templates(): array {
		$raw = get_option( self::OPTION_KEY, '[]' );
		$arr = json_decode( $raw, true );
		return is_array( $arr ) ? $arr : [];
	}

	private static function save_templates( array $templates ): bool {
		return update_option( self::OPTION_KEY, wp_json_encode( $templates ), false );
	}

	// ── Sanitization ──────────────────────────────────────────────────────────

	private static function sanitize_template( ?array $raw ): array|WP_Error {
		if ( ! is_array( $raw ) ) {
			return new WP_Error(
				'invalid_data',
				__( 'Request body must be a JSON object.', 'blender-node-diagram' ),
				[ 'status' => 400 ]
			);
		}

		$valid_categories   = [ 'input', 'shader', 'texture', 'color', 'vector', 'converter', 'output', 'group', 'script' ];
		$valid_socket_types = [ 'vector', 'value', 'shader', 'color' ];
		$valid_subtypes     = [ '', 'colorRamp', 'mixColor' ];

		$name = sanitize_text_field( $raw['name'] ?? '' );
		if ( $name === '' ) {
			return new WP_Error(
				'missing_name',
				__( 'Template name is required.', 'blender-node-diagram' ),
				[ 'status' => 400 ]
			);
		}

		$category = sanitize_key( $raw['category'] ?? '' );
		if ( ! in_array( $category, $valid_categories, true ) ) {
			return new WP_Error(
				'invalid_category',
				sprintf(
					/* translators: %s: comma-separated list of valid categories */
					__( 'Category must be one of: %s.', 'blender-node-diagram' ),
					implode( ', ', $valid_categories )
				),
				[ 'status' => 400 ]
			);
		}

		$inputs  = self::sanitize_sockets( $raw['inputs']  ?? [], $valid_socket_types );
		$outputs = self::sanitize_sockets( $raw['outputs'] ?? [], $valid_socket_types );

		$result = [
			'name'     => $name,
			'category' => $category,
			'inputs'   => $inputs,
			'outputs'  => $outputs,
		];

		if ( ! empty( $raw['description'] ) ) {
			$result['description'] = substr( sanitize_text_field( $raw['description'] ), 0, 200 );
		}

		$subtype = sanitize_key( $raw['subtype'] ?? '' );
		if ( in_array( $subtype, $valid_subtypes, true ) && $subtype !== '' ) {
			$result['subtype'] = $subtype;
		}

		return $result;
	}

	private static function sanitize_sockets( mixed $sockets, array $valid_types ): array {
		if ( ! is_array( $sockets ) ) {
			return [];
		}
		$out = [];
		foreach ( $sockets as $sock ) {
			if ( ! is_array( $sock ) ) {
				continue;
			}
			$type = sanitize_key( $sock['type'] ?? 'value' );
			if ( ! in_array( $type, $valid_types, true ) ) {
				$type = 'value';
			}
			$s = [
				'label' => sanitize_text_field( $sock['label'] ?? '' ),
				'type'  => $type,
			];
			if ( $type === 'color' && ! empty( $sock['defaultColor'] ) ) {
				$color = sanitize_hex_color( $sock['defaultColor'] );
				if ( $color ) {
					$s['defaultColor'] = $color;
				}
			}
			$out[] = $s;
		}
		return $out;
	}

	// ── ID generation ─────────────────────────────────────────────────────────

	private static function generate_id(): string {
		return 'tpl_' . round( microtime( true ) * 1000 ) . '_' . substr( bin2hex( random_bytes( 2 ) ), 0, 4 );
	}
}
