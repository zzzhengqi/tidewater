import { BOARDS, BOARD_IDS, DEFAULT_BOARD, PATTERNS, DECAL_SIDES } from './SurfboardSpec.js';

// The player's board designs (the board library, ui/BoardLibrary.js), saved in this browser only.
//
//   localStorage['tidewater.boards']          { v: 1, current: id, designs: [ design ] }
//   localStorage['tidewater.boardImg.' + id]  the design's picture as a data URL (kept apart: the
//                                             biggest item, and a quota error then loses only it)
//   design: { id, name, board ( a BOARD_IDS id ), look: { deck, bottom, rail, fin, pattern, patternColor }
//             ( colours '#rrggbb' ), decal: { side, scale, rot, x, y, mirror }, image: boolean }
//
// Every read and write is wrapped: private mode, a full quota or bad data never throw. Writes return
// { ok: true } or { ok: false, error: 'quota' | 'unavailable' } for the caller to tell the player.
// export / import: one design (with its picture) as JSON, { format: 'tidewater-board', version: 1, … }.
export const STORE_KEY = 'tidewater.boards';
export const IMAGE_KEY = 'tidewater.boardImg.';
export const MAX_IMAGE_CHARS = 3 * 1024 * 1024; // a data URL longer than this is refused
const FORMAT = 'tidewater-board';
const NAME_MAX = 40;

const toHex = ( c ) => '#' + ( ( typeof c === 'number' ? c : 0 ) & 0xffffff ).toString( 16 ).padStart( 6, '0' );
const isHex = ( c ) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test( c );
const num = ( v, a, b, d ) => ( Number.isFinite( v ) ? Math.min( b, Math.max( a, v ) ) : d );
const IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export function defaultLook( boardId ) {

	const L = ( BOARDS[ boardId ] || DEFAULT_BOARD ).look;
	return { deck: toHex( L.deck ), bottom: toHex( L.bottom ), rail: toHex( L.rail ), fin: toHex( L.fin ), pattern: L.pattern, patternColor: toHex( L.patternColor ) };

}

export function defaultDecal() {

	return { side: 'deck', scale: 1, rot: 0, x: 0, y: 0, mirror: false };

}

// a clean design from anything (saved data, an imported file): unknown or broken fields fall back
export function sanitizeDesign( d, id ) {

	const o = d && typeof d === 'object' ? d : {};
	const board = BOARD_IDS.includes( o.board ) ? o.board : DEFAULT_BOARD.id;
	const base = defaultLook( board ), L = o.look && typeof o.look === 'object' ? o.look : {};
	const look = {};
	for ( const k of [ 'deck', 'bottom', 'rail', 'fin', 'patternColor' ] ) look[ k ] = isHex( L[ k ] ) ? L[ k ].toLowerCase() : base[ k ];
	look.pattern = PATTERNS.includes( L.pattern ) ? L.pattern : base.pattern;
	const D = o.decal && typeof o.decal === 'object' ? o.decal : {};
	const decal = {
		side: DECAL_SIDES.includes( D.side ) ? D.side : 'deck',
		scale: num( D.scale, 1, 4, 1 ),
		rot: num( D.rot, - 180, 180, 0 ),
		x: num( D.x, - 1, 1, 0 ),
		y: num( D.y, - 1, 1, 0 ),
		mirror: D.mirror === true,
	};
	const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice( 0, NAME_MAX ) : '';
	return { id: typeof id === 'string' ? id : typeof o.id === 'string' && o.id ? o.id : newId(), name, board, look, decal, image: o.image === true };

}

let _n = 0;
function newId() {

	return 'b' + Date.now().toString( 36 ) + ( _n ++ ).toString( 36 ) + Math.floor( Math.random() * 1296 ).toString( 36 );

}

export class BoardStore {

	constructor( storage = globalThis.localStorage ) {

		this.storage = storage;
		this.designs = [];
		this.currentId = null;
		this.load();

	}

	_get( key ) {

		try {

			return this.storage ? this.storage.getItem( key ) : null;

		} catch ( e ) {

			return null;

		}

	}

	_set( key, value ) {

		try {

			if ( ! this.storage ) return { ok: false, error: 'unavailable' };
			if ( value === null ) this.storage.removeItem( key );
			else this.storage.setItem( key, value );
			return { ok: true };

		} catch ( e ) {

			const quota = e && ( e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 || /quota/i.test( e.message || '' ) );
			return { ok: false, error: quota ? 'quota' : 'unavailable' };

		}

	}

	load() {

		let data = null;
		try {

			data = JSON.parse( this._get( STORE_KEY ) || 'null' );

		} catch ( e ) {

			data = null;

		}

		const list = data && Array.isArray( data.designs ) ? data.designs : [];
		const seen = new Set();
		this.designs = [];
		for ( const d of list.slice( 0, 64 ) ) {

			const s = sanitizeDesign( d );
			if ( seen.has( s.id ) ) s.id = newId();
			seen.add( s.id );
			this.designs.push( s );

		}

		if ( ! this.designs.length ) this.designs.push( sanitizeDesign( { board: DEFAULT_BOARD.id } ) );
		this.currentId = data && this.designs.some( ( d ) => d.id === data.current ) ? data.current : this.designs[ 0 ].id;
		return this;

	}

	save() {

		return this._set( STORE_KEY, JSON.stringify( { v: 1, current: this.currentId, designs: this.designs } ) );

	}

	get current() {

		return this.designs.find( ( d ) => d.id === this.currentId ) || this.designs[ 0 ];

	}

	get( id ) {

		return this.designs.find( ( d ) => d.id === id ) || null;

	}

	select( id ) {

		if ( this.get( id ) ) this.currentId = id;
		return this.save();

	}

	// a new design on a board type (its default look), made current
	create( boardId = DEFAULT_BOARD.id, name = '' ) {

		const d = sanitizeDesign( { board: boardId, name, look: defaultLook( boardId ) } );
		this.designs.push( d );
		this.currentId = d.id;
		return { design: d, ...this.save() };

	}

	rename( id, name ) {

		const d = this.get( id );
		if ( d ) d.name = String( name || '' ).trim().slice( 0, NAME_MAX );
		return this.save();

	}

	remove( id ) {

		const i = this.designs.findIndex( ( d ) => d.id === id );
		if ( i < 0 ) return { ok: true };
		this._set( IMAGE_KEY + id, null );
		this.designs.splice( i, 1 );
		if ( ! this.designs.length ) this.designs.push( sanitizeDesign( { board: DEFAULT_BOARD.id } ) );
		if ( this.currentId === id ) this.currentId = this.designs[ Math.min( i, this.designs.length - 1 ) ].id;
		return this.save();

	}

	// patch: { board, look: { … }, decal: { … }, name } (merged, then cleaned)
	update( id, patch ) {

		const d = this.get( id );
		if ( ! d ) return { ok: false, error: 'unavailable' };
		const merged = sanitizeDesign( {
			...d, ...patch,
			look: { ...d.look, ...( patch.look || {} ) },
			decal: { ...d.decal, ...( patch.decal || {} ) },
		}, d.id );
		Object.assign( d, merged );
		return this.save();

	}

	image( id ) {

		const v = this._get( IMAGE_KEY + id );
		return typeof v === 'string' && IMAGE_RE.test( v.slice( 0, 64 ) + 'A' ) ? v : null;

	}

	// a data URL, or null to remove the picture
	setImage( id, url ) {

		const d = this.get( id );
		if ( ! d ) return { ok: false, error: 'unavailable' };
		if ( url !== null && ( typeof url !== 'string' || url.length > MAX_IMAGE_CHARS || ! IMAGE_RE.test( url ) ) ) return { ok: false, error: 'image' };
		const r = this._set( IMAGE_KEY + id, url );
		if ( ! r.ok ) return r;
		d.image = url !== null;
		return this.save();

	}

	exportDesign( id ) {

		const d = this.get( id );
		if ( ! d ) return null;
		const { id: _, image, ...rest } = d;
		void _;
		return JSON.stringify( { format: FORMAT, version: 1, design: rest, image: image ? this.image( d.id ) : null }, null, 1 );

	}

	// a design from an exported file, added and made current
	importDesign( text ) {

		let o;
		try {

			o = JSON.parse( text );

		} catch ( e ) {

			return { ok: false, error: 'badJson' };

		}

		if ( ! o || o.format !== FORMAT || ! o.design || typeof o.design !== 'object' ) return { ok: false, error: 'badFormat' };
		const img = typeof o.image === 'string' && o.image.length <= MAX_IMAGE_CHARS && IMAGE_RE.test( o.image ) ? o.image : null;
		if ( o.image && ! img ) return { ok: false, error: 'badFormat' };
		const d = sanitizeDesign( { ...o.design, image: false }, newId() );
		this.designs.push( d );
		const prev = this.currentId;
		this.currentId = d.id;
		if ( img ) {

			const r = this._set( IMAGE_KEY + d.id, img );
			if ( ! r.ok ) {

				this.designs.pop();
				this.currentId = prev;
				return r;

			}

			d.image = true;

		}

		const r = this.save();
		if ( ! r.ok ) {

			this._set( IMAGE_KEY + d.id, null );
			this.designs.pop();
			this.currentId = prev;
			return r;

		}

		return { ok: true, design: d };

	}

}
