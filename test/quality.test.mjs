// Graphics quality (core/Quality.js) with a stand-in app (no DOM, no GPU):
//   - presets set pixel density, scale, shadows and reflections; they are saved and come back on reload
//   - a hand-made change makes the preset 'custom' (a hand-picked scale also stops adaptive resolution)
//   - adaptive resolution: 5% down when the GPU is over budget, back up (to the preset's scale) with room
//   - without GPU times only the frame time is known: it only goes down
//   - the "running slowly" hint: once, only after a while of being slow at the lowest scale
import assert from 'node:assert/strict';

const store = new Map();
Object.defineProperty( globalThis, 'localStorage', { configurable: true, value: {
	getItem: ( k ) => ( store.has( k ) ? store.get( k ) : null ),
	setItem: ( k, v ) => store.set( k, String( v ) ),
} } );
globalThis.devicePixelRatio = 2.5;

const { Quality, PRESETS } = await import( '../src/core/Quality.js' );
const ok = ( msg ) => console.log( 'ok   ' + msg );

function fakeApp() {

	const app = {
		dpr: 1,
		engine: { setRenderScale: ( v ) => { app.dpr = v; } },
		post: { scale: 1 },
		setRenderScale: ( v ) => { app.post.scale = Math.min( 1, Math.max( 0.5, Math.round( v * 20 ) / 20 ) ); },
		shadows: { enabled: true },
		waterMaterial: { params: { ssr: { value: 1 } } },
	};
	return app;

}

// run the controller for `secs` at 60 Hz with the GPU taking `gpu` ms (null: no timestamps; a function of
// the render scale: the GPU time follows the pixel count)
function run( q, secs, gpu, frameMs = 1000 / 60 ) {

	for ( let t = 0; t < secs; t += frameMs / 1000 ) {

		q.timer.ms = typeof gpu === 'function' ? gpu( q.app.post.scale ) : gpu;
		q.update( frameMs / 1000, true );

	}

}

// ---- presets, persistence, custom
{

	const app = fakeApp();
	const q = new Quality( app );
	assert.equal( q.preset, 'high' );
	q.apply();
	assert.equal( app.dpr, 1 );
	q.setPreset( 'low' );
	assert.deepEqual( [ app.post.scale, app.shadows.enabled, app.waterMaterial.params.ssr.value, app.dpr ], [ PRESETS.low.scale, false, 0, 1 ] );
	q.setPreset( 'ultra' );
	assert.equal( app.dpr, 2, 'ultra: the screen\'s pixel density, at most 2x' );
	const again = new Quality( fakeApp() );
	assert.equal( again.preset, 'ultra', 'saved' );
	q.setCustom( 'shadows', false );
	assert.equal( q.preset, 'custom' );
	assert.equal( q.adaptive, true, 'a toggle leaves adaptive resolution alone' );
	q.setCustom( 'scale', 0.7 );
	assert.equal( q.adaptive, false, 'a hand-picked scale stops adaptive resolution' );
	assert.equal( app.post.scale, 0.7 );
	const reload = fakeApp();
	new Quality( reload ).apply();
	assert.deepEqual( [ reload.post.scale, reload.shadows.enabled, reload.dpr ], [ 0.7, false, 2 ] );
	store.set( 'tidewater.graphics', '{ not json' );
	assert.equal( new Quality( fakeApp() ).preset, 'high', 'bad saved data: defaults' );
	ok( 'presets set density / scale / shadows / reflections, are saved, and a hand-made change makes them custom' );

}

// ---- adaptive resolution
{

	store.clear();
	const app = fakeApp();
	const q = new Quality( app );
	q.apply();
	run( q, 4, 10 );
	assert.equal( app.post.scale, 1, 'within budget: unchanged' );
	run( q, 20, ( s ) => 4 + 14 * s * s );
	assert.ok( app.post.scale >= 0.85 && app.post.scale <= 0.9, `over budget: settles where it fits (${ app.post.scale })` );
	run( q, 30, 25 );
	assert.equal( app.post.scale, 0.5, 'never below 50%' );
	run( q, 60, 6 );
	assert.equal( app.post.scale, 1, 'room to spare: back up to the preset\'s scale' );
	q.setPreset( 'medium' );
	run( q, 30, 4 );
	assert.equal( app.post.scale, PRESETS.medium.scale, 'never above the preset\'s scale' );
	q.setTarget( 30 );
	q.setPreset( 'high' );
	run( q, 10, 25 );
	assert.equal( app.post.scale, 1, '25 ms is within a 30 fps budget' );
	q.setAdaptive( false );
	run( q, 10, 40 );
	assert.equal( app.post.scale, 1, 'adaptive off: left alone' );
	ok( 'adaptive resolution: 5% steps down when the GPU is over budget, up to the preset\'s scale with room, 50% floor' );

}

// ---- no GPU timestamps: frame times only, down only
{

	store.clear();
	const app = fakeApp();
	const q = new Quality( app );
	q.apply();
	run( q, 6, null, 25 );
	assert.ok( app.post.scale < 1, 'late frames: down' );
	const low = app.post.scale;
	run( q, 30, null, 1000 / 60 );
	assert.equal( app.post.scale, low, 'frame times cannot show spare GPU: stays' );
	ok( 'without GPU timestamps the frame time can only lower the scale' );

}

// ---- the hint
{

	store.clear();
	const app = fakeApp();
	const q = new Quality( app );
	q.apply();
	let hints = 0;
	q.onHint = () => hints ++;
	run( q, 10, 40, 40 );
	assert.equal( hints, 0, 'not in the first seconds' );
	run( q, 60, 40, 40 );
	assert.equal( hints, 1, 'slow at the lowest scale: once' );
	run( q, 60, 40, 40 );
	assert.equal( hints, 1, 'only once' );
	store.clear();
	const q2 = new Quality( fakeApp() );
	q2.setPreset( 'low' );
	q2.onHint = () => hints ++;
	run( q2, 60, 40, 40 );
	assert.equal( hints, 1, 'not when already on Low' );
	ok( 'the "running slowly" hint comes once, after a while at the lowest scale, never on Low' );

}
