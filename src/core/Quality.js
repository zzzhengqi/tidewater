import { GpuTimer } from './GpuTimer.js';

// Graphics quality: presets, adaptive resolution and the "running slowly" hint (Settings → Performance).
//
//   preset     low / medium / high / ultra set the output pixel density, the highest internal render
//              scale, shadows and water reflections; touching one of those by hand makes it 'custom'.
//              Ultra draws at the screen's real pixel density (up to 2x: sharp on high-DPI screens, the
//              most GPU work); the others draw one pixel per CSS pixel and let the browser scale up.
//   adaptive   lowers the internal render scale (down to 50%) when the GPU cannot hold the target
//              frame rate and raises it again, up to the preset's maximum, when there is room. The GPU
//              time comes from timestamp queries (core/GpuTimer.js); without them only frame times are
//              known, so the scale only goes down.
//   hint       one toast per session when even the lowest scale stays well under the target: suggests
//              the Low preset (and that surfing can be switched off under Gameplay).
//
// Saved in localStorage 'tidewater.graphics'. Changing the scale re-sizes the internal render targets,
// so the controller moves in 5% steps and waits between steps.
export const PRESETS = {
	low: { dpr: 1, scale: 0.65, shadows: false, ssr: false },
	medium: { dpr: 1, scale: 0.85, shadows: true, ssr: false },
	high: { dpr: 1, scale: 1, shadows: true, ssr: true },
	ultra: { dpr: 'native', scale: 1, shadows: true, ssr: true },
};

export const PRESET_IDS = [ 'low', 'medium', 'high', 'ultra' ];
export const TARGETS = [ 30, 60, 120 ];

const KEY = 'tidewater.graphics';
const MIN_SCALE = 0.5;
const DEFAULTS = { preset: 'high', adaptive: true, target: 60, dpr: 1, scale: 1, shadows: true, ssr: true };

function load() {

	try {

		const v = JSON.parse( localStorage.getItem( KEY ) || 'null' );
		if ( v && typeof v === 'object' ) {

			const out = { ...DEFAULTS };
			if ( PRESET_IDS.includes( v.preset ) || v.preset === 'custom' ) out.preset = v.preset;
			if ( typeof v.adaptive === 'boolean' ) out.adaptive = v.adaptive;
			if ( TARGETS.includes( v.target ) ) out.target = v.target;
			if ( v.dpr === 'native' || v.dpr === 1 ) out.dpr = v.dpr;
			if ( Number.isFinite( v.scale ) ) out.scale = Math.min( 1, Math.max( MIN_SCALE, v.scale ) );
			if ( typeof v.shadows === 'boolean' ) out.shadows = v.shadows;
			if ( typeof v.ssr === 'boolean' ) out.ssr = v.ssr;
			return out;

		}

	} catch ( e ) { /* private mode, bad JSON: defaults */ }

	return { ...DEFAULTS };

}

export class Quality {

	// app: setRenderScale( v ), engine.setRenderScale( dpr ), shadows.enabled, waterMaterial.params.ssr, post.scale
	constructor( app, { adaptiveAllowed = true } = {} ) {

		this.app = app;
		this.timer = new GpuTimer();
		this.adaptiveAllowed = adaptiveAllowed; // off under ?bench / ?scale (fixed settings for measuring)
		this.s = load();
		this.onHint = null; // ( ) => void: show the "running slowly" hint
		this._acc = 0;
		this._n = 0;
		this._cool = 3; // s before the first adjustment (shaders settle after loading)
		this._roomT = 0;
		this._slowT = 0;
		this._play = 0;
		this._hinted = false;

	}

	get preset() { return this.s.preset; }
	get adaptive() { return this.s.adaptive; }
	get target() { return this.s.target; }
	get gpuMs() { return this.timer.ms; }
	// the highest internal scale adaptive resolution may use
	get maxScale() { return this.s.scale; }

	save() {

		try {

			localStorage.setItem( KEY, JSON.stringify( this.s ) );

		} catch ( e ) { /* ignore */ }

	}

	// apply everything saved (at start-up)
	apply() {

		const s = this.s, app = this.app;
		app.engine.setRenderScale( this._dpr() );
		app.setRenderScale( s.scale );
		app.shadows.enabled = s.shadows;
		app.waterMaterial.params.ssr.value = s.ssr ? 1 : 0;

	}

	_dpr() {

		const native = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
		return this.s.dpr === 'native' ? Math.min( 2, Math.max( 1, native ) ) : 1;

	}

	setPreset( id ) {

		const p = PRESETS[ id ];
		if ( ! p ) return;
		Object.assign( this.s, { preset: id, dpr: p.dpr, scale: p.scale, shadows: p.shadows, ssr: p.ssr } );
		this.apply();
		this._cool = 2;
		this.save();

	}

	setAdaptive( on ) {

		this.s.adaptive = !! on;
		if ( ! on ) this.app.setRenderScale( this.s.scale );
		this._cool = 1;
		this.save();

	}

	setTarget( fps ) {

		if ( ! TARGETS.includes( fps ) ) return;
		this.s.target = fps;
		this._cool = 1;
		this.save();

	}

	// a hand-made change on the Performance tab: the preset becomes 'custom'
	setCustom( key, value ) {

		this.s[ key ] = value;
		this.s.preset = 'custom';
		if ( key === 'scale' ) {

			// a scale picked by hand is kept (adaptive would move it straight away)
			this.s.adaptive = false;
			this.app.setRenderScale( value );

		}

		this.save();

	}

	// per frame, before anything is recorded
	beginFrame() {

		if ( this.adaptiveAllowed ) this.timer.beginFrame();

	}

	// per frame, right before GPU.submit()
	endFrame() {

		if ( this.adaptiveAllowed ) this.timer.endFrame();

	}

	// per frame after rendering: dt in seconds (the frame interval), playing = the game is in front
	update( dt, playing = true ) {

		if ( ! this.adaptiveAllowed || ! playing || ! ( dt > 0 ) || dt > 0.5 ) return;
		this._acc += dt;
		this._n ++;
		this._cool = Math.max( 0, this._cool - dt );
		if ( this._acc < 0.5 ) return;
		const frameMs = 1000 * this._acc / this._n, window = this._acc;
		this._acc = 0;
		this._n = 0;
		this._play += window;
		const budget = 1000 / this.s.target;
		const gpu = this.timer.ms;
		const app = this.app, scale = app.post.scale;

		// slow even at the lowest scale: say so once (after the first 15 s of play)
		const slow = frameMs > budget * 1.35 && ( scale <= MIN_SCALE + 1e-3 || ! this.s.adaptive );
		this._slowT = slow ? this._slowT + window : 0;
		if ( this._slowT >= 6 && this._play > 15 && ! this._hinted && this.s.preset !== 'low' ) {

			this._hinted = true;
			if ( this.onHint ) this.onHint();

		}

		if ( ! this.s.adaptive || this._cool > 0 ) return;
		// GPU-bound and over budget (or, without timestamps, frames clearly late): 5% down
		const over = gpu !== null ? gpu > budget * 0.92 : frameMs > budget * 1.15;
		if ( over && scale > MIN_SCALE + 1e-3 ) {

			app.setRenderScale( Math.max( MIN_SCALE, scale - 0.05 ) );
			this._cool = 1;
			this._roomT = 0;
			return;

		}

		// plenty of room for a while: 5% up (needs GPU times: frame times cannot show spare GPU)
		const room = gpu !== null && gpu < budget * 0.62 && frameMs < budget * 1.1;
		this._roomT = room ? this._roomT + window : 0;
		if ( this._roomT >= 3 && scale < this.s.scale - 1e-3 ) {

			app.setRenderScale( Math.min( this.s.scale, scale + 0.05 ) );
			this._cool = 2;
			this._roomT = 0;

		}

	}

}
