import { Color, Vector4 } from '../engine/index.js';
import { Texture, generateMipmaps } from '../engine/webgpu.js';
import { standard } from '../materials/Materials.js';
import { decalAffine } from './BoardGeometry.js';
import { PATTERNS, DECAL_SIDES } from './SurfboardSpec.js';

export { PATTERNS, DECAL_SIDES };

// The surfboard's look (deck / bottom / rail / fin colours, a pattern, an imported picture) as
// material uniforms over the procedural mesh (BoardGeometry.js: aBoard = part, a, s). One BoardLook
// is shared by the board in the game and the board library's preview, so they always match.
//
//   const look = new BoardLook();
//   new Mesh( buildBoardGeometry( spec ), look.material )
//   look.apply( spec, design )          design: { look: { deck, bottom, rail, fin, pattern, patternColor },
//                                                 decal: { side, scale, rot, x, y, mirror } }
//   look.setImage( imageData | null )   the picture (ImageData, straight alpha, sRGB, <= 1024 px)
//
// Patterns: none, stripe (a centre stripe with pin lines), gradient (toward the nose), railFade (the
// rails fade into the pattern colour), bands (two bands across the nose). The picture is mapped in
// the board's plan (decalAffine): it covers the outline at any rotation and zoom and is cut by it.

const surface = /* wgsl */`
	let part = in.vs.vBoard.x;
	let a = in.vs.vBoard.y;
	let sAl = in.vs.vBoard.z;
	let lp = in.vs.vLocal;
	let ra = abs( a );
	let deck = part < 0.5;
	// the picture: sampled in uniform control flow, used below on its side only
	let duv = vec2f( dot( mat.decalU.xy, lp.xz ) + mat.decalU.z, dot( mat.decalV.xy, lp.xz ) + mat.decalV.z );
	let pic = textureSample( boardDecal, smpLinearClamp, clamp( duv, vec2f( 0.0 ), vec2f( 1.0 ) ) );
	let inside = select( 0.0, 1.0, all( duv >= vec2f( -0.0005 ) ) && all( duv <= vec2f( 1.0005 ) ) );
	let onSide = select( select( 0.0, 1.0, mat.decalSide > 1.5 && part > 0.5 && part < 1.5 ), 1.0, mat.decalSide > 0.5 && mat.decalSide < 1.5 && deck );
	let fw = max( fwidth( lp.x ), 1e-5 );
	var col = mat.deckColor;
	var rough = 0.22;
	var coat = 1.0;
	if ( part > 2.5 ) {
		col = mat.finColor;
		rough = 0.25;
	} else if ( part > 1.5 ) {
		col = mat.railColor;
	} else {
		col = select( mat.bottomColor, mat.deckColor, deck );
		let pat = mat.pattern;
		var k = 0.0;
		if ( pat > 0.5 && pat < 1.5 ) {
			// centre stripe with a pin line each side
			let x = abs( lp.x );
			let w = mat.boardSize.x * 0.17;
			let stripe = 1.0 - smoothstep( w - fw, w + fw, x );
			let pin = 1.0 - smoothstep( 0.0025 - fw, 0.0025 + fw, abs( x - w - 0.014 ) );
			k = max( stripe, pin );
		} else if ( pat > 1.5 && pat < 2.5 ) {
			k = smoothstep( 0.3, 0.97, sAl );
		} else if ( pat > 2.5 && pat < 3.5 ) {
			k = smoothstep( 0.5, 0.9, ra );
		} else if ( pat > 3.5 ) {
			let d1 = abs( sAl - 0.72 ) - 0.03;
			let d2 = abs( sAl - 0.78 ) - 0.008;
			let fs = max( fwidth( sAl ), 1e-5 );
			k = max( 1.0 - smoothstep( -fs, fs, d1 ), 1.0 - smoothstep( -fs, fs, d2 ) );
		}
		col = mix( col, mat.patColor, k );
		// wooden stringer down the middle (under the glass)
		if ( mat.stringer > 0.5 ) {
			let st = 1.0 - smoothstep( 0.0028 - fw, 0.0028 + fw, abs( lp.x ) );
			col = mix( col, vec3f( 0.42, 0.27, 0.13 ), st * 0.9 );
		}
		// the picture over the paint (its alpha lets the paint through)
		let lin = pow( max( pic.rgb, vec3f( 0.0 ) ), vec3f( 2.2 ) );
		col = mix( col, lin, pic.a * inside * onSide );
		// rail band (the rail colour where the deck / bottom turns down)
		col = mix( col, mat.railColor, smoothstep( 0.9, 0.97, ra ) );
		// soft top: a foam deck, matte
		if ( deck && mat.soft > 0.5 ) {
			rough = 0.8;
			coat = 0.0;
		}
		// traction pad on the tail: black EVA with grooves
		if ( deck && mat.pad > 0.5 ) {
			let inPad = ( 1.0 - smoothstep( 0.245, 0.255, sAl ) ) * ( 1.0 - smoothstep( 0.84, 0.88, ra ) ) * smoothstep( 0.015, 0.03, sAl );
			let groove = smoothstep( 0.55, 1.0, abs( sin( ( lp.z * 0.7 + abs( lp.x ) * 0.7 ) * 260.0 ) ) );
			col = mix( col, vec3f( 0.025, 0.027, 0.03 ) * ( 0.8 + 0.4 * groove ), inPad );
			rough = mix( rough, 0.9, inPad );
			coat = mix( coat, 0.0, inPad );
		}
	}
	s.albedo = col;
	s.roughness = rough;
	s.metalness = 0.0;
	s.clearcoat = coat;
	s.clearcoatRoughness = 0.06;
`;

function hex( c, out ) {

	return out.setHex( typeof c === 'number' ? c : parseInt( String( c ).replace( '#', '' ), 16 ) || 0 );

}

export class BoardLook {

	constructor() {

		// a 1 x 1 transparent picture until one is imported
		this.blank = new Texture( { label: 'surfboardDecalBlank', width: 1, height: 1, format: 'rgba8unorm', data: new Uint8Array( [ 0, 0, 0, 0 ] ) } );
		this.texture = this.blank;
		this.aspect = 1;
		this.material = standard( {
			attributes: { aBoard: 'vec4f' },
			varyings: { vBoard: 'vec4f', vLocal: 'vec3f' },
			uniforms: {
				deckColor: [ 'vec3f', new Color( 0xffffff ) ],
				bottomColor: [ 'vec3f', new Color( 0xffffff ) ],
				railColor: [ 'vec3f', new Color( 0xffffff ) ],
				finColor: [ 'vec3f', new Color( 0x222222 ) ],
				patColor: [ 'vec3f', new Color( 0x222222 ) ],
				pattern: [ 'f32', 0 ],
				stringer: [ 'f32', 0 ],
				pad: [ 'f32', 0 ],
				soft: [ 'f32', 0 ],
				boardSize: [ 'vec4f', new Vector4() ],
				decalSide: [ 'f32', 0 ],
				decalU: [ 'vec4f', new Vector4() ],
				decalV: [ 'vec4f', new Vector4() ],
			},
			textures: { boardDecal: () => this.texture },
			vertex: /* wgsl */`
	o.vBoard = v.aBoard;
	o.vLocal = v.position;
`,
		} );
		this.material.name = 'surfboard';
		this.material.setDefine( 'CLEARCOAT', 1 );
		this.material.surface = surface;

	}

	apply( spec, design ) {

		const U = this.material.uniforms, L = design.look, D = design.decal || {};
		hex( L.deck, U.deckColor.value );
		hex( L.bottom, U.bottomColor.value );
		hex( L.rail, U.railColor.value );
		hex( L.fin, U.finColor.value );
		hex( L.patternColor, U.patColor.value );
		U.pattern.value = Math.max( 0, PATTERNS.indexOf( L.pattern ) );
		U.stringer.value = spec.stringer ? 1 : 0;
		U.pad.value = spec.pad ? 1 : 0;
		U.soft.value = spec.id === 'softtop' ? 1 : 0;
		U.boardSize.value.set( spec.width / 2, spec.length, 0, 0 );
		const side = this.texture === this.blank ? 0 : Math.max( 0, DECAL_SIDES.indexOf( D.side || 'deck' ) );
		U.decalSide.value = side;
		const M = decalAffine( spec, D, this.aspect, side === 2 ? 'bottom' : 'deck' );
		U.decalU.value.set( M[ 0 ], M[ 1 ], M[ 2 ], 0 );
		U.decalV.value.set( M[ 3 ], M[ 4 ], M[ 5 ], 0 );

	}

	// ImageData (sRGB, straight alpha) or null to remove the picture
	setImage( img ) {

		if ( this.texture !== this.blank ) this.texture.destroy();
		if ( ! img ) {

			this.texture = this.blank;
			this.aspect = 1;
			return;

		}

		const tex = new Texture( { label: 'surfboardDecal', width: img.width, height: img.height, format: 'rgba8unorm', mips: true, usage: [ 'sample', 'copyDst', 'render' ], data: new Uint8Array( img.data.buffer, img.data.byteOffset, img.data.byteLength ), sampler: 'linearClamp' } );
		tex.getGPU();
		generateMipmaps( tex );
		this.texture = tex;
		this.aspect = img.width / img.height;

	}

}
