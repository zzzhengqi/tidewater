// npm run i18n:check — fails when the locales disagree or UI text bypasses them.
//   1. every locale has exactly en.js's keys: none missing, none extra, none empty
//   2. a translation uses the same {placeholders} as the English string
//   3. every t( 'key' ) in src/ exists, and so do the keys built from data (fish.<id>, gear.<track>.<level>, …)
//   4. English text that reaches the screen through phrase() (settings labels in AppUI.js, mode / prompt /
//      toast / loader text) has an entry in en.js
//   5. no English sentence is left in the markup of the game HUD, the guide or the minimap
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { languages, locales, keyOf } from '../src/ui/i18n.js';
import { FISH } from '../src/game/FishTable.js';
import { UPGRADES } from '../src/game/Gear.js';
import { Options } from '../src/core/Options.js';
import { KEYMAP, SECTIONS } from '../src/core/Keymap.js';

const root = fileURLToPath( new URL( '..', import.meta.url ) );
const read = ( p ) => readFileSync( join( root, p ), 'utf8' );
const errors = [];
const en = locales.en;
const enKeys = Object.keys( en );
const placeholders = ( s ) => [ ...String( s ).matchAll( /\{(\w+)\}/g ) ].map( ( m ) => m[ 1 ] ).sort().join( ',' );

// 1 + 2: locale files
for ( const [ code ] of languages ) {

	const loc = locales[ code ];
	if ( ! loc ) {

		errors.push( `${ code }: listed in languages but has no locale file` );
		continue;

	}

	for ( const k of enKeys ) if ( ! ( k in loc ) ) errors.push( `${ code }: missing key "${ k }"` );
	for ( const k of Object.keys( loc ) ) if ( ! ( k in en ) ) errors.push( `${ code }: extra key "${ k }" (not in en.js)` );
	for ( const [ k, v ] of Object.entries( loc ) ) {

		if ( typeof v !== 'string' || ! v.trim() ) errors.push( `${ code }: empty translation for "${ k }"` );
		else if ( k in en && placeholders( v ) !== placeholders( en[ k ] ) ) errors.push( `${ code }: "${ k }" uses {${ placeholders( v ) }}, English uses {${ placeholders( en[ k ] ) }}` );

	}

}

const fileIds = readdirSync( join( root, 'src/ui/locales' ) ).map( ( f ) => f.replace( /\.js$/, '' ) );
for ( const id of fileIds ) if ( ! languages.some( ( [ c ] ) => c === id ) ) errors.push( `src/ui/locales/${ id }.js is not listed in languages (src/ui/i18n.js)` );

// source files
const walk = ( dir ) => readdirSync( join( root, dir ) ).flatMap( ( f ) => {

	const p = dir + '/' + f;
	return statSync( join( root, p ) ).isDirectory() ? walk( p ) : p.endsWith( '.js' ) ? [ p ] : [];

} );
const sources = walk( 'src' ).filter( ( p ) => ! p.startsWith( 'src/ui/locales/' ) && p !== 'src/ui/i18n.js' );

// 3: keys used in code
const need = ( key, where ) => {

	if ( ! ( key in en ) ) errors.push( `${ where }: unknown i18n key "${ key }"` );

};

for ( const p of sources ) {

	const src = read( p );
	for ( const m of src.matchAll( /\b(?:t|tr)\(\s*'([a-zA-Z][\w-]*(?:\.[\w-]+)+)'/g ) ) need( m[ 1 ], p );
	for ( const m of src.matchAll( /\b(?:t|tr)\(\s*([^'()]+?)\s*\?\s*'([\w.]+)'\s*:\s*'([\w.]+)'/g ) ) {

		need( m[ 2 ], p );
		need( m[ 3 ], p );

	}

	for ( const m of src.matchAll( /data-i18n="([\w.]+)"/g ) ) need( m[ 1 ], p );
	for ( const m of src.matchAll( /(?:call|cls|KEY_WORDS[^;]*?)\b(?:=|:)\s*'((?:hud|key|guide)\.[\w.]+)'/g ) ) need( m[ 1 ], p );

}

for ( const m of read( 'index.html' ).matchAll( /data-i18n(?:-attr)?="(?:[\w-]+:)?([\w.]+)"/g ) ) need( m[ 1 ], 'index.html' );
for ( const id of Object.keys( FISH ) ) need( 'fish.' + id, 'FishTable.js' );
for ( const [ key, track ] of Object.entries( UPGRADES ) ) {

	need( 'gear.' + key, 'Gear.js' );
	track.levels.forEach( ( _, i ) => need( `gear.${ key }.${ i }`, 'Gear.js' ) );

}

for ( const p of [ 'src/game/FishStand.js', 'src/game/Chandlery.js' ] ) {

	const id = /\bid:\s*'(\w+)'/.exec( read( p ) )?.[ 1 ];
	if ( ! id ) errors.push( `${ p }: vendor has no id (its text comes from vendor.<id>.*)` );
	else for ( const f of [ 'name', 'short', 'greeting' ] ) need( `vendor.${ id }.${ f }`, p );

}

need( 'vendor.joe.idle', 'FishStand.js' );
for ( const d of [ 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw' ] ) need( 'dir.' + d, 'UI.js' );
for ( const o of Options.list() ) for ( const k of [ o.label, o.tip ].filter( Boolean ) ) need( k, 'core/Options.js' );
for ( const k of KEYMAP ) for ( const key of [ k.label, k.sub ].filter( Boolean ) ) need( key, 'core/Keymap.js' );
for ( const [ , key ] of SECTIONS ) need( key, 'core/Keymap.js' );

// any string literal shaped like a key of a known namespace ('equip.rod', 'wheel.busy', …) must exist
const namespaces = new Set( enKeys.map( ( k ) => k.split( '.' )[ 0 ] ) );
for ( const p of sources ) {

	for ( const m of read( p ).replace( /^\s*\/\/.*$/gm, '' ).matchAll( /'([a-z]+(?:\.[A-Za-z0-9]+)+)'/g ) ) {

		const [ ns ] = m[ 1 ].split( '.' );
		if ( namespaces.has( ns ) && ! /\.(css|js|json|glb|png|jpg|html)$/.test( m[ 1 ] ) ) need( m[ 1 ], p );

	}

}
const tips = /const TIPS = \[([^\]]*)\]/.exec( read( 'src/game/Guide.js' ) )?.[ 1 ] ?? '';
for ( const m of tips.matchAll( /'(\w+)'/g ) ) need( 'tip.' + m[ 1 ], 'Guide.js' );

// 4: English text translated by phrase()
const phrases = new Map(); // text -> where
const add = ( text, where ) => {

	// skip multipliers (2x, 16x) and i18n keys handed to t() inside the call
	if ( text && /[A-Za-z]{2}/.test( text ) && ! /^\d+x$/.test( text ) && ! /^[a-z]\w*(\.\w+)+$/.test( text ) ) phrases.set( text.replaceAll( "\\'", "'" ), where );

};
const STR = String.raw`'((?:\\.|[^'\\])*)'`;
const appUI = read( 'src/ui/AppUI.js' );
for ( const m of appUI.matchAll( new RegExp( String.raw`\b(?:label|tooltip):\s*` + STR, 'g' ) ) ) add( m[ 1 ], 'AppUI.js' );
for ( const m of appUI.matchAll( new RegExp( String.raw`\.addTab\(\s*'[^']+'\s*,\s*` + STR, 'g' ) ) ) add( m[ 1 ], 'AppUI.js' );
for ( const m of appUI.matchAll( new RegExp( String.raw`\.addFolder\(\s*` + STR, 'g' ) ) ) add( m[ 1 ], 'AppUI.js' );
for ( const m of appUI.matchAll( /^\t(\w+): \{ wind:/gm ) ) add( m[ 1 ], 'AppUI.js SEA presets' );
for ( const m of appUI.matchAll( /format: \( v \) => [^'\n]*\?[^'\n]*: '([^']+)'/g ) ) add( m[ 1 ], 'AppUI.js format' );
// the mode chip
for ( const s of [ 'Free camera', 'Walk', 'Boat · 1st person', 'Boat · 3rd person', 'On deck', 'Diving', 'Swimming', 'Walking' ] ) {

	if ( ! appUI.includes( s.replace( /[13](st|rd)/, '' ).split( ' · ' )[ 0 ] ) ) errors.push( `i18n-check: mode label "${ s }" no longer in AppUI.js, update this list` );
	add( s, 'AppUI.js mode' );

}

for ( const p of sources ) {

	if ( p === 'src/ui/UI.js' ) continue; // UI.demo is a dev sample; its chrome is listed below
	const src = read( p );
	for ( const m of src.matchAll( /\.toast\(([^;]*)\)/g ) ) for ( const s of m[ 1 ].matchAll( new RegExp( STR, 'g' ) ) ) add( s[ 1 ], p + ' toast' );
	for ( const m of src.matchAll( new RegExp( String.raw`\b(?:setMode|progress|setLoading)\(\s*(?:[\d.]+\s*,\s*)?` + STR, 'g' ) ) ) add( m[ 1 ], p );
	for ( const m of src.matchAll( new RegExp( String.raw`\bsetPrompt\(\s*'[^']*'\s*,\s*` + STR, 'g' ) ) ) add( m[ 1 ], p );
	for ( const m of src.matchAll( new RegExp( String.raw`prompt = \{ key: '[^']*', text: ` + STR, 'g' ) ) ) add( m[ 1 ], p );

}

// settings-panel chrome built in UI.js (English source, translated in place)
for ( const s of [ 'Settings', 'Settings sections', 'Language', 'Open settings', 'Settings (H)', 'Photo mode (P)', 'Controls (F1)',
	'Collapse (H)', 'Hide', 'Controls', 'Photo mode', 'Double-click to reset', 'Reset to default', 'Click to type a value',
	'Click to type a time', 'Time of day', 'Presets', 'Ready', 'Night', 'Dawn', 'Sunrise', 'Golden hour', 'Morning', 'Midday',
	'Afternoon', 'Sunset', 'Dusk', 'WebGPU is not available in this browser.', 'No WebGPU adapter found.' ] ) add( s, 'UI.js' );
const ui = read( 'src/ui/UI.js' );
for ( const m of ui.matchAll( /\[ [\d.]+, '([^']+)' \]/g ) ) add( m[ 1 ], 'UI.js PHASES' );
for ( const [ text, where ] of phrases ) if ( ! keyOf( text ) ) errors.push( `${ where }: "${ text }" has no entry in en.js (phrase namespaces), so it stays English` );

// 5: leftover English in game markup (text between tags, outside ${ } and the CSS blocks)
for ( const p of [ 'src/game/GameHUD.js', 'src/game/Guide.js', 'src/game/Minimap.js' ] ) {

	let src = read( p ).replace( /const CSS = \/\* css \*\/`[\s\S]*?\n`;/, '' );
	for ( let prev = ''; prev !== src; ) {

		prev = src;
		src = src.replace( /\$\{[^{}]*\}/g, '' ); // innermost ${ } first

	}

	for ( const m of src.matchAll( />([^<>\n;=(){}`'"]*)</g ) ) {

		const text = m[ 1 ].trim();
		if ( /[A-Za-z]{3,}/.test( text ) ) errors.push( `${ p }: hard-coded text "${ text }"` );

	}

	for ( const m of src.matchAll( /(?:textContent|innerHTML)\s*=\s*'([^']*[A-Za-z]{3,}[^']*)'/g ) ) errors.push( `${ p }: hard-coded text '${ m[ 1 ] }'` );

}

const n = enKeys.length;
if ( errors.length ) {

	console.error( errors.map( ( e ) => 'FAIL ' + e ).join( '\n' ) );
	console.error( `\ni18n check failed: ${ errors.length } problem(s)` );
	process.exit( 1 );

}

console.log( `ok   i18n: ${ n } keys × ${ languages.length } languages (${ languages.map( ( l ) => l[ 0 ] ).join( ', ' ) }), ${ phrases.size } English source phrases resolve, no stray text in ${ sources.length } source files` );
