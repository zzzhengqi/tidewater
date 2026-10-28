// The board library without a GPU or a DOM:
//   - five board types with their own numbers; procedural meshes are finite, the right size, swallow
//     tails notched, fins below the bottom
//   - an imported picture always covers the outline (no empty edge) at any rotation / zoom / move / mirror
//   - BoardStore: designs survive a reload, rename / delete / select, bad data is cleaned, a full quota or
//     no storage at all never throws, export -> import round trip (with the picture)
//   - image files: type and size checks
import assert from 'node:assert/strict';

const store = new Map();
let quota = Infinity; // characters the fake storage takes in total
let broken = false;
const storage = {
	getItem: ( k ) => {

		if ( broken ) throw new Error( 'SecurityError' );
		return store.has( k ) ? store.get( k ) : null;

	},
	setItem: ( k, v ) => {

		if ( broken ) throw new Error( 'SecurityError' );
		const used = [ ...store ].reduce( ( n, [ key, val ] ) => n + ( key === k ? 0 : val.length ), 0 );
		if ( used + String( v ).length > quota ) {

			const e = new Error( 'The quota has been exceeded.' );
			e.name = 'QuotaExceededError';
			throw e;

		}

		store.set( k, String( v ) );

	},
	removeItem: ( k ) => store.delete( k ),
};

const { BOARDS, BOARD_IDS, boardRatings } = await import( '../src/surf/SurfboardSpec.js' );
const { buildBoardGeometry, halfWidth, tailStart, surfaceY, decalAffine } = await import( '../src/surf/BoardGeometry.js' );
const { BoardStore, STORE_KEY, IMAGE_KEY } = await import( '../src/surf/BoardStore.js' );
const { imageFileError } = await import( '../src/surf/BoardImage.js' );
const ok = ( msg ) => console.log( 'ok   ' + msg );

// ---- board types and meshes
{

	assert.deepEqual( BOARD_IDS, [ 'softtop', 'longboard', 'shortboard', 'fish', 'gun' ] );
	const fields = [ 'length', 'width', 'thickness', 'paddleSpeed', 'turnRate', 'maxSpeed', 'catchEase', 'stability', 'bigWave' ];
	for ( const f of fields ) assert.equal( new Set( BOARD_IDS.map( ( id ) => BOARDS[ id ][ f ] ) ).size > 2, true, `${ f } differs between boards` );
	const r = Object.fromEntries( BOARD_IDS.map( ( id ) => [ id, boardRatings( BOARDS[ id ] ) ] ) );
	assert.ok( r.shortboard.speed > r.longboard.speed && r.shortboard.turning > r.longboard.turning, 'shortboard: quick and fast' );
	assert.ok( r.longboard.ease > r.shortboard.ease && r.softtop.ease >= r.fish.ease, 'longboard / soft top: easy' );
	assert.ok( r.gun.bigWaves === 1 && r.gun.speed === 1, 'gun: big waves' );
	for ( const id of BOARD_IDS ) {

		const sp = BOARDS[ id ];
		const g = buildBoardGeometry( sp );
		const P = g.attributes.position.array, N = g.attributes.normal.array;
		assert.ok( P.every( Number.isFinite ) && N.every( Number.isFinite ), `${ id }: finite` );
		for ( let i = 0; i < N.length; i += 3 ) assert.ok( Math.abs( Math.hypot( N[ i ], N[ i + 1 ], N[ i + 2 ] ) - 1 ) < 1e-3, `${ id }: unit normals` );
		const bb = g.boundingBox;
		assert.ok( Math.abs( bb.max.z - bb.min.z - sp.length ) < 0.005, `${ id }: length ${ bb.max.z - bb.min.z }` );
		assert.ok( Math.abs( bb.max.x - bb.min.x - sp.width ) < 0.01, `${ id }: width` );
		assert.ok( bb.min.y < surfaceY( sp, 0.1, 0, - 1 ) - 0.08, `${ id }: fins hang below the bottom` );
		for ( let s = 0; s <= 1; s += 0.01 ) assert.ok( surfaceY( sp, s, 0, 1 ) >= surfaceY( sp, s, 0, - 1 ) - 1e-9, `${ id }: deck above bottom at ${ s }` );
		assert.equal( halfWidth( sp, 1 ), 0, `${ id }: the nose closes` );

	}

	assert.ok( tailStart( BOARDS.fish, 0 ) > 0.05 && tailStart( BOARDS.fish, 1 ) === 0, 'fish: swallow tail notch' );
	assert.ok( halfWidth( BOARDS.gun, 0.001 ) < 0.02, 'gun: pin tail' );
	assert.ok( halfWidth( BOARDS.longboard, 0.95 ) > halfWidth( BOARDS.shortboard, 0.95 ) * 1.5, 'longboard: round nose, shortboard: pointed' );
	ok( 'five board types with their own numbers; meshes finite, to size, nose closed, swallow notch, pin tail, fins below' );

}

// ---- the picture covers the outline
{

	let worst = - 1;
	for ( const id of BOARD_IDS ) {

		const sp = BOARDS[ id ];
		for ( const aspect of [ 0.4, 1, 16 / 9, 5 ] ) for ( let rot = - 180; rot <= 180; rot += 22.5 ) for ( const scale of [ 1, 2.2, 4 ] ) for ( const x of [ - 1, 0, 0.6 ] ) for ( const y of [ - 1, 0, 1 ] ) for ( const side of [ 'deck', 'bottom' ] ) {

			const M = decalAffine( sp, { scale, rot, x, y, mirror: rot > 0 }, aspect, side );
			for ( let s = tailStart( sp, 0 ); s <= 1; s += 0.005 ) for ( const a of [ - 1, - 0.5, 0, 0.5, 1 ] ) {

				const X = a * halfWidth( sp, s ), Z = ( s - 0.5 ) * sp.length;
				const u = M[ 0 ] * X + M[ 1 ] * Z + M[ 2 ], v = M[ 3 ] * X + M[ 4 ] * Z + M[ 5 ];
				worst = Math.max( worst, - u, u - 1, - v, v - 1 );

			}

		}

	}

	assert.ok( worst <= 1e-9, `the picture leaves the outline uncovered by ${ worst }` );
	// not stretched: equal metres across and along map to equal image distances (in pixels)
	const M = decalAffine( BOARDS.longboard, { scale: 1, rot: 30 }, 2, 'deck' );
	const lu = Math.hypot( M[ 0 ] * 2, M[ 3 ] ), lv = Math.hypot( M[ 1 ] * 2, M[ 4 ] );
	assert.ok( Math.abs( lu - lv ) < 1e-9, 'uniform scale (aspect corrected)' );
	ok( 'the picture covers every outline at any rotation, zoom, move and mirror, without stretching' );

}

// ---- the store
{

	let s = new BoardStore( storage );
	assert.equal( s.designs.length, 1, 'starts with one design' );
	assert.equal( s.current.board, 'softtop' );
	const a = s.create( 'gun', 'Big day' ).design;
	assert.equal( s.current.id, a.id );
	s.update( a.id, { look: { deck: '#123ABC', pattern: 'bands' }, decal: { rot: 400, scale: 0.2, mirror: true } } );
	assert.equal( s.get( a.id ).look.deck, '#123abc' );
	assert.equal( s.get( a.id ).decal.rot, 180, 'clamped' );
	assert.equal( s.get( a.id ).decal.scale, 1, 'never smaller than the board' );
	s.rename( a.id, '  Morning glass  ' );
	s.create( 'fish' );
	s.select( a.id );
	s = new BoardStore( storage );
	assert.equal( s.designs.length, 3, 'designs survive a reload' );
	assert.equal( s.current.id, a.id, 'and the current one' );
	assert.equal( s.current.name, 'Morning glass' );
	assert.equal( s.current.board, 'gun' );
	assert.equal( s.current.look.pattern, 'bands' );
	// picture
	const png = 'data:image/png;base64,iVBORw0KGgo=';
	assert.ok( s.setImage( a.id, png ).ok );
	assert.equal( s.image( a.id ), png );
	assert.equal( s.setImage( a.id, 'data:text/html;base64,AAAA' ).ok, false, 'only images' );
	// export / import
	const json = s.exportDesign( a.id );
	const r = s.importDesign( json );
	assert.ok( r.ok );
	assert.notEqual( r.design.id, a.id );
	assert.equal( r.design.name, 'Morning glass' );
	assert.equal( r.design.board, 'gun' );
	assert.deepEqual( r.design.look, s.get( a.id ).look );
	assert.equal( s.image( r.design.id ), png, 'the picture comes along' );
	assert.equal( s.importDesign( '{ nope' ).error, 'badJson' );
	assert.equal( s.importDesign( '{"format":"other"}' ).error, 'badFormat' );
	assert.equal( s.importDesign( JSON.stringify( { format: 'tidewater-board', version: 1, design: { board: 'jetski', look: { deck: 'red' } } } ) ).design.board, 'softtop', 'unknown fields fall back' );
	// delete
	const before = s.designs.length;
	s.remove( r.design.id );
	assert.equal( s.designs.length, before - 1 );
	assert.equal( store.has( IMAGE_KEY + r.design.id ), false, 'its picture goes too' );
	for ( const d of [ ...s.designs ] ) s.remove( d.id );
	assert.equal( s.designs.length, 1, 'never empty' );
	// broken saved data
	store.set( STORE_KEY, '{"designs":[{"id":"x","board":42,"look":7},{"id":"x"}],"current":"x"}' );
	s = new BoardStore( storage );
	assert.equal( s.designs.length, 2 );
	assert.notEqual( s.designs[ 0 ].id, s.designs[ 1 ].id, 'duplicate ids repaired' );
	// quota
	quota = [ ...store.values() ].reduce( ( n, v ) => n + v.length, 0 ) + 200;
	const big = 'data:image/png;base64,' + 'A'.repeat( 5000 );
	const q = s.setImage( s.current.id, big );
	assert.deepEqual( q, { ok: false, error: 'quota' } );
	assert.equal( s.current.image, false, 'nothing half saved' );
	const q2 = s.importDesign( JSON.stringify( { format: 'tidewater-board', version: 1, design: { board: 'fish' }, image: big } ) );
	assert.equal( q2.error, 'quota' );
	assert.equal( s.designs.length, 2, 'a failed import adds nothing' );
	quota = Infinity;
	// no storage at all (private mode, blocked)
	broken = true;
	s = new BoardStore( storage );
	assert.equal( s.designs.length, 1 );
	assert.deepEqual( s.create( 'fish' ).ok, false );
	assert.equal( s.current.board, 'fish', 'still works for the session' );
	broken = false;
	ok( 'designs: saved, reloaded, renamed, deleted, cleaned; quota and blocked storage reported, never thrown; export / import round trip' );

}

// ---- image files
{

	assert.equal( imageFileError( { type: 'image/png', size: 1000, name: 'a.png' } ), null );
	assert.equal( imageFileError( { type: 'image/webp', size: 1000, name: 'a.webp' } ), null );
	assert.equal( imageFileError( { type: '', size: 1000, name: 'photo.JPG' } ), null );
	assert.equal( imageFileError( { type: 'image/gif', size: 1000, name: 'a.gif' } ), 'type' );
	assert.equal( imageFileError( { type: 'application/pdf', size: 10, name: 'a.pdf' } ), 'type' );
	assert.equal( imageFileError( { type: 'image/jpeg', size: 40 * 1024 * 1024, name: 'a.jpg' } ), 'size' );
	ok( 'image files: png / jpg / webp only, size limit' );

}
