import { BufferGeometry, Float32BufferAttribute } from '../engine/index.js';

// Procedural surfboards from a spec (SurfboardSpec.js). Board frame: nose +z, deck +y, centre at the
// origin; s runs 0 (tail) .. 1 (nose), a -1 .. 1 across (rail to rail).
//
//   halfWidth( spec, s )            plan half width (m)
//   tailStart( spec, a )            where the outline starts at column a (> 0 only in a swallow's notch)
//   buildBoardGeometry( spec )      deck + bottom grids that meet at the rail apex (the plan outline), a
//                                   cap across the tail end, and the fins. Attributes: position, normal,
//                                   uv ( a, s ), aBoard ( part, a, s, 0 ): part 0 deck, 1 bottom, 2 tail
//                                   cap, 3 fin (the material colours by part, BoardMaterial.js)
//   decalAffine( spec, decal, aspect, side )   board plan (x, z) -> image uv for an imported picture
//                                   (pure math, so the "no stretching, no empty edges" rule is testable)
//
// The deck crowns and the bottom is nearly flat; they meet at a rail apex a little below half the
// thickness (a down rail), so the rail reads round from above and hard from below. Thickness thins
// toward both ends and closes at the nose tip. The rows bunch at the nose and tail, the columns at the
// rails, where the shape turns fastest.

const NS = 84, NA = 26; // rows (along) and columns (across) per face
const TAIL_ROUND = { square: 0.015, squash: 0.04, swallow: 0.02 }; // corner radius (m); round / pin: see tailEnd

export function halfWidth( spec, s ) {

	const O = spec.outline, Wh = spec.width / 2, m = O.widest;
	let w;
	if ( s >= m ) {

		// nose: (1 - x^p)^q, x 0 at the widest point .. 1 at the tip; full round noses have a high p
		const x = Math.min( 1, ( s - m ) / ( 1 - m ) );
		const p = 1.6 + 1.9 * O.nose, q = 0.75 - 0.25 * O.nose;
		w = Math.pow( Math.max( 0, 1 - Math.pow( x, p ) ), q );

	} else {

		const y = ( m - s ) / m; // 0 at the widest .. 1 at the tail end
		w = 1 - ( 1 - O.tailW ) * Math.pow( y, 2.2 );

	}

	w *= Wh;
	return Math.max( 0, tailEnd( spec, s * spec.length, w ) );

}

// the last centimetres of the tail: rounded corners (square, squash, swallow), a half circle (round) or
// a drawn-out point (pin)
function tailEnd( spec, d, w ) {

	const tail = spec.outline.tail;
	if ( tail === 'round' || tail === 'pin' ) {

		const r = tail === 'pin' ? 0.24 : Math.max( 0.05, w );
		if ( d >= r ) return w;
		const k = 1 - d / r;
		return w * Math.sqrt( Math.max( 0, 1 - k * k ) );

	}

	const cr = TAIL_ROUND[ tail ] || 0.015;
	if ( d >= cr ) return w;
	return w - cr + Math.sqrt( Math.max( 0, cr * cr - ( cr - d ) * ( cr - d ) ) );

}

// the outline starts later in the middle of a swallow tail (the V notch)
export function tailStart( spec, a ) {

	if ( spec.outline.tail !== 'swallow' ) return 0;
	const notch = 0.13 / spec.length;
	return notch * Math.pow( Math.max( 0, 1 - Math.abs( a ) ), 0.9 );

}

function rocker( spec, s ) {

	const n = Math.max( 0, ( s - 0.45 ) / 0.55 ), t = Math.max( 0, ( 0.3 - s ) / 0.3 );
	return spec.rocker.nose * Math.pow( n, 2.3 ) + spec.rocker.tail * Math.pow( t, 2 );

}

function thickness( spec, s ) {

	const m = spec.outline.widest;
	const nose = s > m ? Math.sqrt( Math.max( 0, 1 - Math.pow( ( s - m ) / ( 1 - m ), 6 ) ) ) : 1;
	return spec.thickness * ( 0.3 + 0.7 * Math.pow( Math.sin( Math.PI * Math.min( 1, Math.max( 0, s * 0.92 + 0.04 ) ) ), 0.45 ) ) * nose;

}

// height of the deck (side 1) or the bottom (side -1) at ( s, a )
export function surfaceY( spec, s, a, side ) {

	const th = thickness( spec, s ), apex = - 0.15 * th;
	const k = Math.abs( a );
	const base = rocker( spec, s ) + apex;
	if ( side > 0 ) return base + ( th / 2 - apex ) * Math.sqrt( Math.max( 0, 1 - Math.pow( k, 4 ) ) );
	return base - ( th / 2 + apex ) * Math.sqrt( Math.max( 0, 1 - Math.pow( k, 10 ) ) );

}

// ------------------------------------------------------------------ mesh

class Builder {

	constructor() {

		this.pos = []; this.nrm = []; this.uv = []; this.board = []; this.idx = [];

	}

	vert( x, y, z, nx, ny, nz, part, a, s ) {

		this.pos.push( x, y, z );
		this.nrm.push( nx, ny, nz );
		this.uv.push( a, s );
		this.board.push( part, a, s, 0 );
		return this.pos.length / 3 - 1;

	}

	// a flat triangle (own vertices, face normal)
	tri( p0, p1, p2, part, a = 0, s = 0 ) {

		const ux = p1[ 0 ] - p0[ 0 ], uy = p1[ 1 ] - p0[ 1 ], uz = p1[ 2 ] - p0[ 2 ];
		const vx = p2[ 0 ] - p0[ 0 ], vy = p2[ 1 ] - p0[ 1 ], vz = p2[ 2 ] - p0[ 2 ];
		let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
		const l = Math.hypot( nx, ny, nz );
		if ( l < 1e-12 ) return; // degenerate (a collapsed corner): nothing to draw
		nx /= l; ny /= l; nz /= l;
		for ( const p of [ p0, p1, p2 ] ) this.idx.push( this.vert( p[ 0 ], p[ 1 ], p[ 2 ], nx, ny, nz, part, a, s ) );

	}

	geometry() {

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( new Float32Array( this.pos ), 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( new Float32Array( this.nrm ), 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( new Float32Array( this.uv ), 2 ) );
		g.setAttribute( 'aBoard', new Float32BufferAttribute( new Float32Array( this.board ), 4 ) );
		g.setIndex( this.idx );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		return g;

	}

}

// one face (deck or bottom) as a smooth grid: positions, then normals from the neighbouring cells
function face( B, spec, side ) {

	const L = spec.length, base = B.pos.length / 3;
	const grid = [];
	for ( let i = 0; i <= NS; i ++ ) {

		const tt = 0.5 - 0.5 * Math.cos( Math.PI * i / NS );
		for ( let j = 0; j <= NA; j ++ ) {

			const a = Math.sin( Math.PI / 2 * ( - 1 + 2 * j / NA ) );
			const s0 = tailStart( spec, a );
			const s = s0 + tt * ( 1 - s0 );
			const x = a * halfWidth( spec, s ), z = ( s - 0.5 ) * L;
			grid.push( [ x, surfaceY( spec, s, a, side ), z, a, s ] );

		}

	}

	const at = ( i, j ) => grid[ i * ( NA + 1 ) + j ];
	const sub = ( p, q ) => [ p[ 0 ] - q[ 0 ], p[ 1 ] - q[ 1 ], p[ 2 ] - q[ 2 ] ];
	for ( let i = 0; i <= NS; i ++ ) {

		for ( let j = 0; j <= NA; j ++ ) {

			const p = at( i, j );
			// tangents by central differences (one-sided at the borders); the tip row collapses to a
			// point, so its along tangent comes from the row before
			const du = sub( at( Math.min( NS, i + 1 ), j ), at( Math.max( 0, i - 1 ), j ) );
			let dv = sub( at( i, Math.min( NA, j + 1 ) ), at( i, Math.max( 0, j - 1 ) ) );
			if ( Math.hypot( dv[ 0 ], dv[ 2 ] ) < 1e-6 ) dv = sub( at( Math.max( 0, i - 1 ), Math.min( NA, j + 1 ) ), at( Math.max( 0, i - 1 ), Math.max( 0, j - 1 ) ) );
			let nx = du[ 1 ] * dv[ 2 ] - du[ 2 ] * dv[ 1 ], ny = du[ 2 ] * dv[ 0 ] - du[ 0 ] * dv[ 2 ], nz = du[ 0 ] * dv[ 1 ] - du[ 1 ] * dv[ 0 ];
			const l = Math.hypot( nx, ny, nz );
			if ( l < 1e-12 ) { nx = 0; ny = side; nz = 0; } else { nx /= l; ny /= l; nz /= l; }
			if ( ny * side < 0 ) { nx = - nx; ny = - ny; nz = - nz; }
			B.vert( p[ 0 ], p[ 1 ], p[ 2 ], nx, ny, nz, side > 0 ? 0 : 1, p[ 3 ], p[ 4 ] );

		}

	}

	for ( let i = 0; i < NS; i ++ ) {

		for ( let j = 0; j < NA; j ++ ) {

			const a = base + i * ( NA + 1 ) + j, b = a + 1, c = a + NA + 1, d = c + 1;
			// counter-clockwise seen from outside (deck from above, bottom from below)
			if ( side > 0 ) B.idx.push( a, c, b, b, c, d );
			else B.idx.push( a, b, c, b, d, c );

		}

	}

	return grid;

}

// fin outline in its own plane: u along the board (+ toward the nose), v down from the base; raked back
const FIN_PROFILE = [ [ 0.5, 0 ], [ 0.3, 0.38 ], [ 0.02, 0.74 ], [ - 0.28, 0.97 ], [ - 0.42, 1 ], [ - 0.45, 0.88 ], [ - 0.38, 0.5 ], [ - 0.5, 0 ] ];
const FIN_SETS = {
	single: [ { s: 0.075, a: 0, base: 0.2, h: 0.2, toe: 0, cant: 0 } ],
	twin: [ { s: 0.15, a: 0.68, base: 0.15, h: 0.115, toe: 0.06, cant: 0.12 } ],
	thruster: [ { s: 0.17, a: 0.76, base: 0.11, h: 0.115, toe: 0.05, cant: 0.1 }, { s: 0.055, a: 0, base: 0.11, h: 0.115, toe: 0, cant: 0 } ],
	quad: [ { s: 0.16, a: 0.78, base: 0.105, h: 0.105, toe: 0.05, cant: 0.1 }, { s: 0.085, a: 0.6, base: 0.095, h: 0.095, toe: 0.03, cant: 0.08 } ],
};

function fin( B, spec, f, mirror ) {

	const scale = spec.bigWave > 0.8 ? 1.1 : 1;
	const a = f.a * mirror, s = f.s;
	const x0 = a * halfWidth( spec, s ), z0 = ( s - 0.5 ) * spec.length, y0 = surfaceY( spec, s, a, - 1 ) + 0.004;
	const tf = 0.007, b = f.base * scale, h = f.h * scale;
	const toe = f.toe * mirror, cant = f.cant * mirror;
	const ct = Math.cos( toe ), st = Math.sin( toe ), cc = Math.cos( cant ), sc = Math.sin( cant );
	// fin plane ( thickness x, depth -y, along z ) -> cant about z, toe about y, then to the base point
	const place = ( u, v, w ) => {

		let x = w * tf, y = - v * h, z = u * b;
		const x1 = x * cc - y * sc, y1 = x * sc + y * cc;
		x = x1 * ct + z * st; z = - x1 * st + z * ct;
		return [ x0 + x, y0 + y1, z0 + z ];

	};

	const P = FIN_PROFILE, n = P.length;
	// thickness tapers toward the tip and the trailing edge (foil)
	const half = ( p ) => 0.5 * ( 1 - 0.6 * p[ 1 ] ) * ( p[ 0 ] < - 0.3 ? 0.6 : 1 );
	const cu = P.reduce( ( t, p ) => t + p[ 0 ], 0 ) / n, cv = P.reduce( ( t, p ) => t + p[ 1 ], 0 ) / n;
	for ( const sideW of [ 1, - 1 ] ) {

		const c = place( cu, cv, sideW * 0.5 );
		for ( let k = 0; k < n; k ++ ) {

			const p = P[ k ], q = P[ ( k + 1 ) % n ];
			const A = place( p[ 0 ], p[ 1 ], sideW * half( p ) ), Bp = place( q[ 0 ], q[ 1 ], sideW * half( q ) );
			if ( sideW > 0 ) B.tri( c, Bp, A, 3 ); else B.tri( c, A, Bp, 3 );

		}

	}

	// the edge all round (not the base, which sits in the board)
	for ( let k = 0; k < n - 1; k ++ ) {

		const p = P[ k ], q = P[ k + 1 ];
		const a1 = place( p[ 0 ], p[ 1 ], half( p ) ), a2 = place( p[ 0 ], p[ 1 ], - half( p ) );
		const b1 = place( q[ 0 ], q[ 1 ], half( q ) ), b2 = place( q[ 0 ], q[ 1 ], - half( q ) );
		B.tri( a1, b1, a2, 3 );
		B.tri( a2, b1, b2, 3 );

	}

}

export function buildBoardGeometry( spec ) {

	const B = new Builder();
	const deck = face( B, spec, 1 );
	const bottom = face( B, spec, - 1 );
	// tail cap: the band between the deck's and the bottom's first row (the tail end / the notch edges)
	for ( let j = 0; j < NA; j ++ ) {

		const d0 = deck[ j ], d1 = deck[ j + 1 ], b0 = bottom[ j ], b1 = bottom[ j + 1 ];
		if ( Math.abs( d0[ 1 ] - b0[ 1 ] ) + Math.abs( d1[ 1 ] - b1[ 1 ] ) < 1e-5 ) continue;
		B.tri( d0, b0, d1, 2, d0[ 3 ], 0 );
		B.tri( d1, b0, b1, 2, d1[ 3 ], 0 );

	}

	for ( const f of FIN_SETS[ spec.fins ] || FIN_SETS.thruster ) {

		if ( f.a === 0 ) fin( B, spec, f, 1 );
		else {

			fin( B, spec, f, 1 );
			fin( B, spec, f, - 1 );

		}

	}

	return B.geometry();

}

// ------------------------------------------------------------------ an imported picture on the board
//
// The picture covers the board's plan rectangle (2 x half width by length) at every rotation: scaled
// to the smallest size that still contains the rotated rectangle, then by `scale` (>= 1, zoom), moved
// by `x`, `y` (-1..1: the share of the room the zoom leaves, so it never uncovers an edge) and
// optionally mirrored. The outline cuts the rest (the geometry only exists inside it), so the picture
// is never stretched and never leaves an empty edge. Seen from below the bottom is mirrored, so a
// picture on the bottom reads the right way round there.
//
// decal: { scale, rot (degrees), x, y, mirror }; aspect: image width / height; side: 'deck' | 'bottom'
// returns [ ux, uz, u0, vx, vz, v0 ]: u = ux * x + uz * z + u0, v = vx * x + vz * z + v0 (board metres)
export function decalAffine( spec, decal, aspect, side = 'deck' ) {

	const Wh = spec.width / 2, Lh = spec.length / 2;
	const th = ( decal.rot || 0 ) * Math.PI / 180, c = Math.cos( th ), s = Math.sin( th );
	// the board rectangle in the picture's frame (x right, y down = toward the tail)
	const ex = Wh * Math.abs( c ) + Lh * Math.abs( s ), ey = Wh * Math.abs( s ) + Lh * Math.abs( c );
	const ia = aspect > 0 ? aspect : 1;
	let hy = Math.max( ey, ex / ia ), hx = hy * ia;
	const S = Math.max( 1, decal.scale || 1 );
	hx *= S; hy *= S;
	const cx = clamp( decal.x || 0, - 1, 1 ) * ( hx - ex ), cy = clamp( decal.y || 0, - 1, 1 ) * ( hy - ey );
	const flipX = side === 'bottom' ? - 1 : 1;
	const map = ( x, z ) => {

		const qx = x * flipX, qy = - z;
		const rx = c * qx + s * qy, ry = - s * qx + c * qy;
		let u = 0.5 + ( rx - cx ) / ( 2 * hx );
		const v = 0.5 + ( ry - cy ) / ( 2 * hy );
		if ( decal.mirror ) u = 1 - u;
		return [ u, v ];

	};

	const o = map( 0, 0 ), X = map( 1, 0 ), Z = map( 0, 1 );
	return [ X[ 0 ] - o[ 0 ], Z[ 0 ] - o[ 0 ], o[ 0 ], X[ 1 ] - o[ 1 ], Z[ 1 ] - o[ 1 ], o[ 1 ] ];

}

function clamp( x, a, b ) {

	return x < a ? a : x > b ? b : x;

}
