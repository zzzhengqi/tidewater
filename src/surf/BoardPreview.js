import { Scene, PerspectiveCamera, Matrix4, Quaternion, Vector3, Vector4, Mesh } from '../engine/index.js';
import { GPU, Texture, MeshRenderer, FullscreenPass, createViewUniforms, setFrameCamera, UniformBlock } from '../engine/webgpu.js';
import { ACES_WGSL } from '../post/PostFX.js';

// The board library's live 3D view: the board (the same geometry and BoardLook material as in the
// game) in a neutral studio, drawn into a DOM canvas with its own MeshRenderer and view uniforms
// (STUDIO_LIGHTING, as the fish portraits in game/FishPortrait.js). Drag to turn it; it turns slowly
// on its own until touched.
//
//   const pv = new BoardPreview( look )
//   pv.attach( canvas ) / pv.detach()
//   pv.setGeometry( geometry, spec )
//   pv.update( dt )                     once per frame (inside the frame: it records GPU passes)

const STUDIO = new Vector3( 0, 6000, 0 );
const SS = 2; // supersampling per axis
const VFOV = 18;
// board frame (nose +z, deck +y) -> nose to the right (+x), deck toward the camera (+z)
const BASE = new Matrix4().makeBasis( new Vector3( 0, 1, 0 ), new Vector3( 0, 0, 1 ), new Vector3( 1, 0, 0 ) );
const _q = new Quaternion(), _q2 = new Quaternion(), _m = new Matrix4(), _x = new Vector3( 1, 0, 0 ), _y = new Vector3( 0, 1, 0 );

export class BoardPreview {

	constructor( look ) {

		this.look = look;
		this.scene = new Scene();
		this.mesh = null;
		this.spec = null;
		this.renderer = new MeshRenderer();
		this.camera = new PerspectiveCamera( VFOV, 2, 0.05, 100 );
		const block = this.block = createViewUniforms( 'boardPreview' );
		this._dbg = new Vector4( 0.35, 0, 0, 0 );
		const follow = block.onBeforePack;
		block.onBeforePack = () => {

			follow();
			const F = block.fields;
			F.sunDir.value = this._sun || ( this._sun = new Vector3( - 0.4, 0.8, 0.6 ).normalize() );
			F.sunColor.value = this._sunC || ( this._sunC = new Vector3( 3.0, 2.95, 2.85 ) );
			F.envIntensity.value = 1.1;
			F.night.value = 0;
			F.debug.value = this._dbg;

		};

		this.exposure = new UniformBlock( 'BoardPreviewParams', { exposure: [ 'f32', 1.1 ], ss: [ 'f32', SS ] }, { label: 'boardPreview' } );
		this.target = null;
		this.canvas = null;
		this.context = null;
		this.present = null;
		// view: yaw / pitch (radians) of the board, auto turn until dragged
		this.yaw = - 0.5;
		this.pitch = 0.35;
		this.auto = true;
		this._drag = null;

	}

	setGeometry( geometry, spec ) {

		if ( this.mesh ) this.scene.remove( this.mesh );
		this.mesh = new Mesh( geometry, this.look.material );
		this.mesh.frustumCulled = false;
		this.mesh.matrixAutoUpdate = false;
		this.scene.add( this.mesh );
		this.spec = spec;

	}

	attach( canvas ) {

		if ( ! canvas || ! navigator.gpu || ! GPU.device ) return false;
		if ( this.canvas !== canvas ) {

			this.detach();
			this.canvas = canvas;
			this.context = canvas.getContext( 'webgpu' );
			this.format = navigator.gpu.getPreferredCanvasFormat();
			this.context.configure( { device: GPU.device, format: this.format, alphaMode: 'premultiplied' } );
			this.present = null;
			this._ac = new AbortController();
			const o = { signal: this._ac.signal };
			canvas.addEventListener( 'pointerdown', ( e ) => {

				this._drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
				this.auto = false;
				canvas.setPointerCapture?.( e.pointerId );

			}, o );
			canvas.addEventListener( 'pointermove', ( e ) => {

				if ( ! this._drag || e.pointerId !== this._drag.id ) return;
				this.yaw += ( e.clientX - this._drag.x ) * 0.012;
				this.pitch = Math.max( - 1.4, Math.min( 1.4, this.pitch + ( e.clientY - this._drag.y ) * 0.01 ) );
				this._drag.x = e.clientX;
				this._drag.y = e.clientY;

			}, o );
			const end = () => {

				this._drag = null;

			};
			canvas.addEventListener( 'pointerup', end, o );
			canvas.addEventListener( 'pointercancel', end, o );

		}

		return true;

	}

	detach() {

		if ( this._ac ) this._ac.abort();
		this._ac = null;
		this.canvas = null;
		this.context = null;

	}

	// a quick spin to show the bottom (the library's flip button)
	flip() {

		this.auto = false;
		this.yaw += Math.PI;

	}

	_pass() {

		return new FullscreenPass( {
			label: 'board preview',
			bindings: { previewSrc: { texture: () => this.target.hdr, sampleType: 'unfilterable-float' }, preview: { uniform: this.exposure } },
			colorFormats: [ this.format ],
			code: ACES_WGSL + /* wgsl */`
fn fragment( in: FSIn ) -> vec4f {
	let n = i32( preview.ss );
	let base = vec2i( in.pos.xy ) * n;
	var rgb = vec3f( 0.0 );
	var a = 0.0;
	for ( var y = 0; y < n; y++ ) {
		for ( var x = 0; x < n; x++ ) {
			let c = textureLoad( previewSrc, base + vec2i( x, y ), 0 );
			let cov = sat( c.a );
			rgb += acesFilmicToneMapping( max( c.rgb, vec3f( 0.0 ) ) / max( cov, 1e-4 ), preview.exposure ) * cov;
			a += cov;
		}
	}
	let k = 1.0 / f32( n * n );
	rgb *= k;
	a *= k;
	return vec4f( linearToSrgb( rgb / max( a, 1e-4 ) ) * a, a );
}
`,
		} );

	}

	update( dt ) {

		if ( ! this.context || ! this.mesh || ! GPU.device ) return;
		const c = this.canvas;
		if ( ! c.isConnected || c.clientWidth < 4 ) return;
		const dpr = Math.min( 2, globalThis.devicePixelRatio || 1 );
		const cw = Math.max( 2, Math.min( 1400, Math.round( c.clientWidth * dpr ) ) ), ch = Math.max( 2, Math.round( cw * c.clientHeight / Math.max( 1, c.clientWidth ) ) );
		if ( c.width !== cw || c.height !== ch ) {

			c.width = cw;
			c.height = ch;

		}

		const w = cw * SS, h = ch * SS;
		if ( ! this.target || this.target.w !== w || this.target.h !== h ) {

			if ( this.target ) {

				this.target.hdr.destroy();
				this.target.depth.destroy();

			}

			this.target = {
				w, h,
				hdr: new Texture( { label: 'boardPreview', width: w, height: h, format: 'rgba16float', usage: [ 'render', 'sample' ] } ),
				depth: new Texture( { label: 'boardPreview.depth', width: w, height: h, format: 'depth32float', usage: [ 'render' ] } ),
			};

		}

		if ( this.auto ) this.yaw += dt * 0.35;
		// the board: base pose, then the drag (yaw about the vertical, pitch about the screen's x)
		_q.setFromAxisAngle( _x, this.pitch );
		_q2.setFromAxisAngle( _y, this.yaw );
		_q.multiply( _q2 );
		_m.makeRotationFromQuaternion( _q ).multiply( BASE ).setPosition( STUDIO.x, STUDIO.y, STUDIO.z );
		this.mesh.matrix.copy( _m );
		this.mesh.matrixWorld.copy( _m );
		// frame it: the length fills ~86% of the width (or the height on a tall canvas)
		const cam = this.camera, L = this.spec ? this.spec.length : 2.4;
		cam.aspect = w / h;
		cam.updateProjectionMatrix();
		const tanV = Math.tan( VFOV * Math.PI / 360 ), tanH = tanV * cam.aspect;
		const dist = Math.max( ( L * 1.16 ) / 2 / tanH, ( L * 0.6 ) / 2 / tanV );
		cam.near = Math.max( 0.05, dist - L );
		cam.far = dist + L;
		cam.updateProjectionMatrix();
		cam.position.set( STUDIO.x, STUDIO.y + dist * 0.04, STUDIO.z + dist );
		cam.lookAt( STUDIO.x, STUDIO.y, STUDIO.z );
		cam.updateMatrixWorld();
		setFrameCamera( cam, w, h, { block: this.block } );
		this.renderer.render( this.scene, {
			camera: cam, frameBlock: this.block, kind: 'color', label: 'board preview',
			colorViews: [ this.target.hdr.view() ], colorFormats: [ 'rgba16float' ],
			depthView: this.target.depth.view(), depthFormat: 'depth32float',
			clearColors: [ [ 0, 0, 0, 0 ] ], clearDepth: 0,
			defines: { STUDIO_LIGHTING: 1 },
		} );
		if ( ! this.present ) this.present = this._pass();
		this.present.render( { colorViews: [ this.context.getCurrentTexture().createView() ], clear: [ 0, 0, 0, 0 ] } );

	}

}
