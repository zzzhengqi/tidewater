import './core/BenchSeed.js';
import { App } from './App.js';
import { UI } from './ui/UI.js';
import { AppUI } from './ui/AppUI.js';
import { t, phrase } from './ui/i18n.js';
import { GPU } from './engine/gpu/GPU.js';

// ?bench runs in background tabs too (automation): rAF does not fire in a hidden page
if ( /[?&]bench\b/.test( location.search ) ) {

	const raf = window.requestAnimationFrame.bind( window ), caf = window.cancelAnimationFrame.bind( window );
	window.requestAnimationFrame = ( cb ) => document.visibilityState === 'hidden' ? setTimeout( () => cb( performance.now() ), 16 ) : raf( cb );
	window.cancelAnimationFrame = ( id ) => ( clearTimeout( id ), caf( id ) );

}

const ui = new UI();
const app = new App();
window.__ui = ui;

app.init( ( p, text, until ) => ui.setLoading( p, text, until ) ).then( async () => {

	app.ui = new AppUI( app, ui );
	// a lost GPU device (driver reset, GPU process crash) leaves a black view with a working interface:
	// say so on screen (with the browser's reason), and show the first GPU error too, so it can be reported
	GPU.device.lost.then( ( info ) => ui.toast( t( 'error.deviceLost', { message: info.message || info.reason || '' } ), 600000 ) );
	let gpuErrorShown = false;
	GPU.device.addEventListener( 'uncapturederror', ( e ) => {

		if ( gpuErrorShown ) return;
		gpuErrorShown = true;
		ui.toast( t( 'error.gpu', { message: String( e.error && e.error.message || '' ).split( '\n' )[ 0 ].slice( 0, 160 ) } ), 20000 );

	} );
	ui.setLoading( 1, 'Ready' );
	await ui.hideLoader();
	// frame-time benchmark and reference shots (see core/Bench.js): it drives the frames itself
	if ( app.qs.has( 'bench' ) ) {

		window.__bench = new ( await import( './core/Bench.js' ) ).Bench( app );
		if ( app.qs.has( 'auto' ) ) window.__job = window.__bench.auto( app.qs.get( 'auto' ), { runs: Number( app.qs.get( 'runs' ) ) || 1 } );
		// ?bench&shots=view1,view2[&tag=name][&dt=seconds][&seq=n&every=frames]: reference shots of the named views only (core/DebugViews.js; dt > 0: the clock runs, e.g. for the eased lens flare)
		// &wdbg=N: the water shader's debug view (WaterMaterial debugMode) in the shots
		if ( app.qs.has( 'wdbg' ) && app.waterMaterial ) app.waterMaterial.debugMode.value = Number( app.qs.get( 'wdbg' ) );
		if ( app.qs.has( 'shots' ) ) window.__job = window.__bench.shots( app.qs.get( 'shots' ).split( ',' ), { tag: app.qs.get( 'tag' ) || 'shot', dt: Number( app.qs.get( 'dt' ) ) || 0, seq: Number( app.qs.get( 'seq' ) ) || 1, every: Number( app.qs.get( 'every' ) ) || 1 } );

	} else app.start();
	ui.showStartOverlay( () => {

		app.input.requestLock();
		if ( app.audio ) app.audio.resume();

	} );

} ).catch( ( e ) => {

	console.error( e );
	ui.setLoadingError( t( 'loader.error', { message: phrase( e.message ) } ) );

} );
