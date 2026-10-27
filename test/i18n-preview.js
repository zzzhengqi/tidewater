import { UI } from '../src/ui/UI.js';
import { AppUI } from '../src/ui/AppUI.js';
import { GameHUD } from '../src/game/GameHUD.js';
import { GameState } from '../src/game/GameState.js';
import { Guide } from '../src/game/Guide.js';
import { languages, t, setLanguage, getLanguage, onLanguageChange } from '../src/ui/i18n.js';

// Standalone language preview (test/i18n.html, built by test/build-i18n-preview.js): the real settings
// panel (AppUI on a stub app), help sheet, start overlay, HUD, the fishing HUD / catch card / cooler /
// fish stand / chandlery, the first-play guide and the loader, without WebGPU. The toolbar switches
// screens and languages; the choice is saved like in the game.

// stand-in for the running app: every property is another stand-in, numbers read as 1
const stub = () => new Proxy( function () {}, {
	get: ( target, key ) => {

		if ( key === Symbol.toPrimitive ) return ( hint ) => ( hint === 'string' ? '' : 1 );
		if ( key === 'then' ) return undefined;
		if ( ! ( key in target ) ) target[ key ] = stub();
		return target[ key ];

	},
	set: ( target, key, v ) => {

		target[ key ] = v;
		return true;

	},
	apply: () => stub(),
} );

const ui = new UI();
const app = stub();
app.settings = { timeOfDay: 17.6, timeSpeed: 0, renderScale: 1, sunAzimuth: 0, exposure: 0.55 };
app.camera = { fov: 60 };
app.fps = 60;
app.cpuMs = 4.2;
app.sceneRenderer = { width: 1920, height: 1080 };
let panelOk = true;
try {

	new AppUI( app, ui );

} catch ( e ) {

	panelOk = false;
	console.warn( 'preview: AppUI on the stub app failed, the settings panel is incomplete', e );

}

const state = new GameState( null );
state.money = 184;
state.upgrades.reel = 1;
state.addFish( 'yellowtail', 1.31, 9 );
state.addFish( 'grunt', 0.84, 9.5 );
state.addFish( 'jack', 4.6, 10 );
state.addFish( 'barracuda', 3.2, 11 );
const game = { state, app, sellAll() { state.sell(); }, sell( ids ) { state.sell( ids ); }, buy() {}, refuel() {} };
const hud = new GameHUD( ui, game );
const guide = new Guide( ui, game, null );
guide._wait = - 1;
const joe = { id: 'joe', kind: 'buyer', name: 'Joe · Fish buyer' };
const marta = { id: 'marta', kind: 'shop', name: 'Marta · Chandlery' };

const loader = document.getElementById( 'loader' );
const fight = { tension: 0.62, band: [ 0.35, 0.8 ], stamina: 0.55, distance: 11.4, surge: 0.1 };

function reset() {

	if ( ui._start ) ui.startEl.click(); // the start overlay leaves on a click
	ui.togglePanel( false );
	ui.toggleHelp( false );
	hud.hideCatch();
	hud.toggleInventory( false );
	hud.closeStand();
	guide.close();
	guide._current = null;
	guide.coach.classList.remove( 'is-on' );
	if ( loader ) loader.style.display = 'none';
	ui.setBoatGauges( { visible: false } );
	ui.setDepth( { visible: false } );
	ui.setPrompt( null );
	hud.update( { fuel: { litres: 23, tank: 40 }, sonar: { depth: 12.4, fish: 0.5 } } );

}

const VIEWS = {
	settings: [ 'ui.settings', () => ui.togglePanel( true ) ],
	help: [ 'ui.controls', () => ui.toggleHelp( true ) ],
	start: [ 'start.cta', () => ui.showStartOverlay( () => {} ) ],
	hud: [ 'mode.boatThird', () => {

		ui.setMode( 'Boat · 3rd person' );
		ui.setPrompt( 'E', 'Leave helm   ·   V  camera' );
		ui.setBoatGauges( { visible: true, throttle: 0.55, rpm: 0.62, speedKnots: 8.4, heading: 47 } );
		ui.toast( 'Time paused' );

	} ],
	dive: [ 'mode.diving', () => {

		ui.setMode( 'Diving' );
		ui.setDepth( { visible: true, meters: 6.5 } );
		ui.setPrompt( 'Space', 'Climb ladder' );

	} ],
	fight: [ 'hud.fishOn', () => {

		ui.setMode( 'Walking' );
		hud.update( { fight, aiming: true } );
		ui.setPrompt( 'LMB', t( 'prompt.holdToReel' ) );
		ui.toast( t( 'hud.fishOn' ) );

	} ],
	bite: [ 'prompt.strike', () => {

		hud.update( { bite: true, aiming: true } );
		ui.setPrompt( 'LMB', t( 'prompt.strike' ) );

	} ],
	catch: [ 'catch.newRecord', () => {

		state.addFish( 'jack', 6.35, 9 );
		hud.showCatch( state.lastCatch, 600000 );

	} ],
	newSpecies: [ 'catch.newSpecies', () => {

		state.addFish( 'mahi', 11.4, 12 );
		hud.showCatch( state.lastCatch, 600000 );

	} ],
	cooler: [ 'inv.cooler', () => hud.toggleInventory( true ) ],
	joe: [ 'vendor.joe.name', () => hud.openStand( joe ) ],
	marta: [ 'vendor.marta.name', () => hud.openStand( marta ) ],
	guide1: [ 'guide.welcome.eyebrow', () => guide.show( 0 ) ],
	guide2: [ 'guide.fishing.eyebrow', () => guide.show( 1 ) ],
	guide3: [ 'guide.around.eyebrow', () => guide.show( 2 ) ],
	tip: [ 'guide.tip', () => {

		guide._current = 'fishOn';
		guide.coachText.innerHTML = t( 'tip.fishOn' );
		guide.coach.classList.add( 'is-on' );

	} ],
	loader: [ 'loader.label', () => {

		if ( ! loader ) return;
		loader.style.display = '';
		ui.setLoading( 0.36, 'Compiling shaders…', 0.95 );
		ui.setLoadingDetail( 41, 96 );

	} ],
};

let current = 'settings';
const bar = document.createElement( 'nav' );
bar.className = 'i18n-bar';
document.body.append( bar );

function renderBar() {

	bar.innerHTML = '';
	for ( const [ code, name ] of languages ) {

		const b = document.createElement( 'button' );
		b.type = 'button';
		b.textContent = name;
		b.className = code === getLanguage() ? 'is-on' : '';
		b.onclick = () => setLanguage( code );
		bar.append( b );

	}

	bar.append( document.createElement( 'hr' ) );
	for ( const [ id, [ key ] ] of Object.entries( VIEWS ) ) {

		const b = document.createElement( 'button' );
		b.type = 'button';
		b.textContent = t( key );
		b.className = id === current ? 'is-on' : '';
		b.onclick = () => show( id );
		bar.append( b );

	}

	if ( ! panelOk ) bar.append( Object.assign( document.createElement( 'small' ), { textContent: 'AppUI stub failed (see console)' } ) );

}

function show( id ) {

	current = id;
	reset();
	VIEWS[ id ][ 1 ]();
	renderBar();

}

// the game refreshes the HUD readouts and the prompt every frame; the preview re-runs the screen instead
// (the catch card re-renders its own text, re-running it would land another fish)
onLanguageChange( () => {

	if ( current === 'catch' || current === 'newSpecies' ) renderBar();
	else show( current );

} );
show( new URLSearchParams( location.search ).get( 'view' ) in VIEWS ? new URLSearchParams( location.search ).get( 'view' ) : 'settings' );
