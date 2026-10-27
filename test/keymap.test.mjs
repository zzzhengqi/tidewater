// Key registry, equipment and gameplay options (no DOM, no GPU).
//   - every key the code reads is in core/Keymap.js (or is a menu navigation key), and no key is bound twice
//   - the letter keys are exactly the agreed set: a new feature goes into a wheel or the settings, not a new letter
//   - Equipment: one item at a time (unequip before equip), busy items stay, unavailable items fall back to hands
//   - Options: defaults, persistence, change events
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const store = new Map( [ [ 'tidewater.options', JSON.stringify( { minimap: false } ) ] ] );
Object.defineProperty( globalThis, 'localStorage', { configurable: true, value: {
	getItem: ( k ) => ( store.has( k ) ? store.get( k ) : null ),
	setItem: ( k, v ) => store.set( k, String( v ) ),
} } );

const { KEYMAP, NAVIGATION_KEYS, codesOf, bindingOf, capsOf } = await import( '../src/core/Keymap.js' );
const { Equipment } = await import( '../src/core/Equipment.js' );
const { Options } = await import( '../src/core/Options.js' );
const ok = ( msg ) => console.log( 'ok   ' + msg );

// ---- registry vs the code
const root = fileURLToPath( new URL( '..', import.meta.url ) );
const walk = ( dir ) => readdirSync( join( root, dir ) ).flatMap( ( f ) => {

	const p = dir + '/' + f;
	return statSync( join( root, p ) ).isDirectory() ? walk( p ) : p.endsWith( '.js' ) ? [ p ] : [];

} );
const registered = new Set( KEYMAP.flatMap( ( k ) => k.codes || [] ) );
const allowed = new Set( [ ...registered, ...NAVIGATION_KEYS ] );
const unknown = [];
for ( const p of walk( 'src' ).filter( ( p ) => ! p.startsWith( 'src/engine/' ) ) ) {

	const src = readFileSync( join( root, p ), 'utf8' );
	for ( const m of src.matchAll( /\b(?:hit|down)\(\s*'([A-Za-z0-9]+)'|\.code === '([A-Za-z0-9]+)'/g ) ) {

		const code = m[ 1 ] || m[ 2 ];
		if ( ! allowed.has( code ) ) unknown.push( `${ p }: ${ code }` );

	}

}

assert.deepEqual( unknown, [], 'keys read by the code but missing from core/Keymap.js' );
const seen = new Map();
for ( const k of KEYMAP ) for ( const c of k.codes || [] ) {

	assert.ok( ! seen.has( c ), `${ c } bound to both ${ seen.get( c ) } and ${ k.id }` );
	seen.set( c, k.id );

}

const letters = [ ...registered ].filter( ( c ) => /^Key[A-Z]$/.test( c ) ).map( ( c ) => c.slice( 3 ) ).sort().join( '' );
assert.equal( letters, [ ...'WASDCERVFTLMHPI' ].sort().join( '' ), 'letter keys changed: new features go into a wheel or the settings panel' );
assert.deepEqual( codesOf( 'equipment' ), [ 'KeyR' ] );
assert.equal( bindingOf( 'Tab' ), 'cooler' );
assert.deepEqual( capsOf( 'help' ), [ 'F1', '?' ] );
assert.deepEqual( capsOf( 'sprint' ), [ 'Shift' ] );
assert.ok( KEYMAP.filter( ( k ) => k.option ).every( ( k ) => k.option === 'fishing' ) );
ok( `every key the code reads is registered (${ registered.size } codes, letters ${ letters }), none bound twice` );

// ---- equipment
{

	const log = [];
	let canFish = true, fighting = false, visible = true;
	const eq = new Equipment();
	eq.registry.add( { id: 'rod', label: 'equip.rod', icon: 'rod', order: 10, visible: () => visible, available: () => canFish, busy: () => fighting,
		equip: () => log.push( 'rod+' ), unequip: ( o ) => log.push( o && o.silent ? 'rod-silent' : 'rod-' ) } );
	eq.registry.add( { id: 'glider', label: 'equip.glider', icon: 'x', order: 5, equip: () => log.push( 'glider+' ), unequip: () => log.push( 'glider-' ) } );
	assert.deepEqual( eq.registry.visible().map( ( i ) => i.id ), [ 'hands', 'glider', 'rod' ], 'ordered by `order`' );
	assert.equal( eq.current, 'hands' );
	assert.equal( eq.set( 'rod' ), true );
	assert.equal( eq.set( 'glider' ), true );
	assert.deepEqual( log, [ 'rod+', 'rod-', 'glider+' ], 'the old item is put away before the new one comes out' );
	eq.set( 'rod' );
	fighting = true;
	assert.equal( eq.set( 'hands' ), false, 'a busy item stays' );
	assert.equal( eq.current, 'rod' );
	fighting = false;
	canFish = false;
	assert.equal( eq.set( 'glider' ), true );
	assert.equal( eq.set( 'rod' ), false, 'unavailable items cannot be picked' );
	eq.set( 'hands' );
	canFish = true;
	eq.set( 'rod' );
	log.length = 0;
	canFish = false;
	eq.update();
	assert.equal( eq.current, 'hands' );
	assert.deepEqual( log, [ 'rod-silent' ], 'swimming puts the rod away silently' );
	visible = false;
	assert.deepEqual( eq.registry.visible().map( ( i ) => i.id ), [ 'hands', 'glider' ], 'a switched-off item leaves the wheel' );
	assert.throws( () => eq.registry.add( { id: 'rod' } ) );
	ok( 'equipment: one item at a time, busy items stay, unavailable ones fall back to empty hands' );

}

// ---- options
{

	assert.equal( Options.get( 'fishing' ), true );
	assert.equal( Options.get( 'minimap' ), false, 'saved value wins over the default' );
	assert.equal( Options.get( 'lightHud' ), false );
	const heard = [];
	const off = Options.onChange( ( id, v ) => heard.push( `${ id }=${ v }` ) );
	Options.set( 'fishing', false );
	Options.set( 'fishing', false );
	assert.deepEqual( heard, [ 'fishing=false' ], 'one event per change' );
	assert.equal( JSON.parse( store.get( 'tidewater.options' ) ).fishing, false );
	off();
	Options.define( { id: 'surfing', label: 'options.surfing', value: false } );
	assert.ok( Options.list().some( ( o ) => o.id === 'surfing' ), 'new options join the list (the settings group is built from it)' );
	assert.throws( () => Options.define( { id: 'surfing', label: 'x' } ) );
	ok( 'gameplay options: defaults, saved values, change events, open for new switches' );

}
