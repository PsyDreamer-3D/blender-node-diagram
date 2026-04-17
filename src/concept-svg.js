/**
 * concept-svg.js
 *
 * The static Blinn-Phong vector geometry diagram (N, L, V, H) from the blog post,
 * as a React component. Used by both concept-edit.js and concept-save.js.
 *
 * Because this is a purely static illustration, there is no data-driven
 * rendering — the SVG markup is defined directly here.
 */

export default function ConceptSVG() {
	return (
		<svg
			id="diag-concept"
			viewBox="0 0 520 280"
			width="520"
			height="280"
			xmlns="http://www.w3.org/2000/svg"
			style={ { display: 'block', margin: '0 auto' } }
			aria-label="Blinn-Phong vector geometry: N (normal), L (light direction), V (view direction), and H (half-vector) at a surface shading point."
			role="img"
		>
			{/* ── Surface line ── */}
			<line x1="30" y1="210" x2="490" y2="210" stroke="#303030" strokeWidth="2" />

			{/* ── Surface hatching ── */}
			{ [ 50, 90, 130, 170, 210, 250, 290, 330, 370, 410, 450, 490 ].map( ( x ) => (
				<line key={ x } x1={ x } y1="210" x2={ x - 12 } y2="228" stroke="#252525" strokeWidth="1" />
			) ) }

			{/* ── Shading point ── */}
			<circle cx="260" cy="210" r="5" fill="#E07840" />

			{/* ── N (Normal) — straight up, dashed ── */}
			<line x1="260" y1="210" x2="260" y2="52" stroke="#909090" strokeWidth="1.5" strokeDasharray="5,4" />
			<polygon points="260,52 254,68 266,68" fill="#909090" />
			<text x="270" y="62" fill="#909090" fontFamily="JetBrains Mono, monospace" fontSize="14" fontWeight="500">N</text>

			{/* Normal extended downward (faint) */}
			<line x1="260" y1="210" x2="260" y2="250" stroke="#252525" strokeWidth="1" strokeDasharray="4,4" />

			{/* ── L (light direction) — upper-left to surface ── */}
			<line x1="120" y1="80" x2="255" y2="205" stroke="#C8A840" strokeWidth="2" />
			<polygon points="260,210 247,198 258,193" fill="#C8A840" />
			<text x="88" y="76" fill="#C8A840" fontFamily="JetBrains Mono, monospace" fontSize="14" fontWeight="500">L</text>
			<text x="100" y="92" fill="#6A6660" fontFamily="JetBrains Mono, monospace" fontSize="10">(light dir)</text>

			{/* ── V (view direction) — surface to upper-right ── */}
			<line x1="260" y1="210" x2="395" y2="82" stroke="#7878CC" strokeWidth="2" />
			<polygon points="400,76 393,90 404,88" fill="#7878CC" />
			<text x="405" y="76" fill="#7878CC" fontFamily="JetBrains Mono, monospace" fontSize="14" fontWeight="500">V</text>
			<text x="386" y="92" fill="#6A6660" fontFamily="JetBrains Mono, monospace" fontSize="10">(to camera)</text>

			{/* ── H (half-vector) — bisects L and V ── */}
			<line x1="260" y1="210" x2="274" y2="66" stroke="#48AA80" strokeWidth="2.5" />
			<polygon points="276,58 268,74 280,72" fill="#48AA80" />
			<text x="282" y="62" fill="#48AA80" fontFamily="JetBrains Mono, monospace" fontSize="14" fontWeight="500">H</text>
			<text x="238" y="56" fill="#6A6660" fontFamily="JetBrains Mono, monospace" fontSize="10">(half-vector)</text>

			{/* ── θ arc between N and H ── */}
			<path d="M 260 150 Q 270 148 272 140" stroke="#48AA80" strokeWidth="1" fill="none" opacity="0.5" />
			<text x="275" y="148" fill="#48AA80" fontFamily="JetBrains Mono, monospace" fontSize="10">θ</text>

			{/* ── Bottom annotation ── */}
			<text x="200" y="268" fill="#6A6660" fontFamily="Lora, serif" fontSize="12" fontStyle="italic">
				specular = (N · H)
				<tspan baselineShift="super" fontSize="9">n</tspan>
				{ '  — maximum when θ = 0' }
			</text>

			{/* ── Surface label ── */}
			<text x="32" y="205" fill="#404040" fontFamily="JetBrains Mono, monospace" fontSize="10">surface</text>
		</svg>
	);
}
