import { G, GRAVITY } from '../engine/render/Frame.js';

// CPU mirror of the shore waves (ocean/ShoreWaves.js) for gameplay that has to know the water under it
// *now* (the surfboard): same inputs, same maths, no GPU read-back.
//
// Ported line for line from the WGSL height path: shorePhaseAt (shore field bilinear), shoreWobble,
// shoreBar, shoreWaveAmp, shoreBreakParams, shoreProfile (shape only: no lumps, no foam noise),
// shoreBreakDepth, the evaluate() envelope, and the Eulerian solve of waterQueryHeightAtXZ (2 fixed-point
// iterations). The shore uniforms (amplitude, period, gamma, curl, …) are read live on every call, so the
// settings panel and the presets change the CPU waves in the same frame as the GPU ones.
//
// Not included: the FFT open-ocean waves (attenuated in the surf zone; callers add a slow residual from
// the read-back if they need it), the boat wake, and the roller relief the water mesh adds on top.
//
//   const s = new ShoreSampler( { shore: app.shore, field: app.shoreField, terrain: app.terrainData } );
//   s.sample( x, z, out )  -> out { h, depth, dirX, dirZ, env, u, m, A, b, H, c, lam, slope, gradX, gradZ, foam }
//     h        water height (m, world y) from sea level + shore waves
//     dir      wave travel direction (unit, shoreward); c: wave speed sqrt( g d ) (m/s)
//     u        phase in the wave, -0.5..0.5, crest at 0, u < 0 shoreward of the crest (in front)
//     b        breaking progress of this wave: < 0 shoaling, 0..1 plunging, > 1 bore (whitewater)
//     H        visible crest-to-trough height (m; the bore's once broken), Hc before breaking; A amplitude;
//              env the shore-wave weight (0 offshore / dry)
//     slope    dh/ds along dir (> 0: the surface rises shoreward = the back; < 0: the front face). Exact,
//              so a plunging face or a bore front reads near-vertical (tens): gameplay clamps it
//     foam     whitewater 0..1 at this point (impact zone, collapsing face, roller)
// Each call is one "sample point" (3 cheap evaluations). sample.count counts them (budget: ≤ 8 a frame).

const TAU = Math.PI * 2;
const sat = ( x ) => ( x < 0 ? 0 : x > 1 ? 1 : x );
const clamp = ( x, a, b ) => ( x < a ? a : x > b ? b : x );
const mix = ( a, b, t ) => a + ( b - a ) * t;
// WGSL smoothstep (also with edge0 > edge1)
const smoothstep = ( e0, e1, x ) => {

	const t = sat( ( x - e0 ) / ( e1 - e0 ) );
	return t * t * ( 3 - 2 * t );

};

// integer hash of the wave number: bit-identical to shoreHash1 in ShoreWaves.js (PCG)
export function shoreHash1( x ) {

	let h = ( Math.imul( Math.round( x ) | 0, 747796405 ) + 2891336453 ) >>> 0;
	h = Math.imul( ( ( h >>> ( ( h >>> 28 ) + 4 ) ) ^ h ) >>> 0, 277803737 ) >>> 0;
	h = ( ( h >>> 22 ) ^ h ) >>> 0;
	return ( h >>> 8 ) / 16777216;

}

function shoreBar( along ) {

	const w = Math.sin( along * 0.021 + 1.9 ) * 1.4 + Math.sin( along * 0.009 + 0.3 ) * 0.9;
	const r = Math.sin( along * 0.059 + w );
	const width = 0.8 + Math.sin( along * 0.017 + 4.1 ) * 0.08;
	const rip = smoothstep( width, 0.985, r );
	const bar = 0.9 + ( Math.sin( along * 0.031 + 7.3 ) * 0.6 + Math.sin( along * 0.083 + 1.1 ) * 0.4 ) * 0.14;
	return { k: bar * ( 1 - rip * 0.58 ), rip };

}

function shoreWobble( along, bar ) {

	return Math.sin( along * 0.029 + 0.7 ) * 0.07 + Math.sin( along * 0.083 + 2.1 ) * 0.035
		+ Math.sin( along * 0.19 + 0.4 ) * 0.022 + Math.sin( along * 0.37 + 2.6 ) * 0.011
		+ bar.rip * 0.045;

}

function shoreWaveAmp( m, along, U, bar ) {

	const waveSet = mix( Math.abs( Math.sin( m * ( Math.PI / 7 ) ) ) * 0.6 + 0.55, 1.05, U.surfBoost * 0.6 );
	const rnd = ( shoreHash1( m ) - 0.5 ) * 2;
	const warp = Math.sin( along * 0.016 + m * 0.9 ) * 1.6;
	const a1 = Math.sin( along * 0.062 + m * 1.7 + warp );
	const a2 = Math.sin( along * 0.13 + m * 4.1 + 1.3 - warp * 0.7 );
	const a3 = Math.sin( along * 0.29 + m * 2.3 + warp * 0.5 ) * 0.6 + Math.sin( along * 0.47 + m * 5.9 + 0.8 ) * 0.4;
	const alongV = a1 * 0.6 + a2 * 0.4 + a3 * 0.28;
	return Math.max( mix( U.amplitude, Math.max( U.amplitude * 1.3, 0.75 ), U.surfBoost ) * waveSet * ( 1 + rnd * U.variation * 0.5 + alongV * U.variation * 0.7 ) * bar.k, 0.02 );

}

function breakParams( A, d, U, P ) {

	P.db = Math.pow( A * 3.556 / U.gamma, 0.8 );
	P.b = ( P.db - d ) / ( P.db * U.breakSpan );
	const shoal = Math.pow( 10 / clamp( d, 0.35, 10 ), 0.25 );
	P.Ash = A * shoal;
	P.p = mix( 1, 3, smoothstep( - 2.5, 0, P.b ) );
	P.meanP = 1 / Math.sqrt( ( P.p + 0.25 ) * Math.PI );
	P.crestPeak = 1 + smoothstep( - 1, 0.3, P.b ) * 0.22;
	P.yc = P.Ash * 2 * ( 1 - P.meanP ) * P.crestPeak;
	P.yt = P.Ash * - 2 * P.meanP * P.crestPeak;
	P.H = P.yc - P.yt;
	P.wBore = smoothstep( 0.85, 1.35, P.b );
	P.Xi = P.H * 0.8;
	P.Hb = Math.min( P.H * 0.6, Math.max( d, 0 ) * 0.75 ) * ( smoothstep( 0, 0.3, d ) * 0.7 + 0.3 );
	P.ycB = mix( P.yc, P.yt * 0.6 + P.Hb, P.wBore );
	P.ytB = mix( P.yt, P.yt * 0.6, P.wBore );
	P.Xc = mix( 0, P.Xi - P.Hb * 0.55, P.wBore ) * smoothstep( 0.03, 0.3, P.Hb );
	P.Wt = mix( P.H * mix( 0.25, 0.55, smoothstep( 0.1, 0.9, P.b ) ), P.Hb * 0.6 + 0.08, P.wBore );
	return P;

}

// shoreProfile( u, lam, P, false ): ( x shoreward displacement, y height ) into r
function profile( u, lam, P, U, r ) {

	const skew = smoothstep( - 3, 0, P.b ) * 0.55;
	const phi = u - skew * ( 1 - Math.cos( u * TAU ) ) / TAU;
	const c = Math.max( ( Math.cos( phi * TAU ) + 1 ) * 0.5, 0 );
	const yPre = P.Ash * 2 * ( Math.pow( c, P.p ) - P.meanP ) * P.crestPeak;
	const Q = smoothstep( - 3, 0, P.b ) * 0.25 + 0.1;
	const xPre = Math.sin( u * TAU ) * P.Ash * Q;
	const uf = 0.09;
	const inFace = u > - uf;
	const th = clamp( - u / uf, 0, 1 ) * ( Math.PI / 2 );
	const fx = mix( 1 - Math.cos( th ), Math.sin( th ), P.wBore );
	const fy = mix( 1 - Math.sin( th ), Math.cos( th ), P.wBore );
	const sTr = clamp( ( - u - uf ) / ( 0.5 - uf ), 0, 1 );
	const ul = u * lam;
	const xFront = ( inFace ? P.Xc + P.Wt * fx : mix( P.Xc + P.Wt, lam * 0.5, sTr ) ) + ul;
	const yFront = inFace ? P.ytB + ( P.ycB - P.ytB ) * fy : P.ytB;
	const cb = Math.pow( Math.max( ( Math.cos( u * ( TAU * 0.85 ) ) + 1 ) * 0.5, 0 ), P.p );
	const yBack = P.ytB + ( P.ycB - P.ytB ) * mix( cb, Math.exp( u * - 7 ), P.wBore );
	const xBack = P.Xc * Math.exp( u * - 6 ) * smoothstep( 0.5, 0.35, u ) + xPre * ( 1 - P.wBore );
	const front = u < 0;
	const wC = smoothstep( - 0.35, 0.25, P.b ) * U.curl;
	r.x = mix( xPre, front ? xFront : xBack, wC );
	r.y = mix( yPre, front ? yFront : yBack, wC );
	r.fx = fx;
	return r;

}

// shoreFaceFill / shoreWhitewater
function whitewater( xi, lam, P ) {

	const landed = smoothstep( 0.86, 0.99, P.b );
	const spread = sat( ( P.b - 0.9 ) / 0.45 );
	const reach = P.Xi * 0.25 + spread * ( P.Xi * 0.9 + 1 );
	const impact = landed * smoothstep( reach, reach * 0.6, Math.abs( xi - P.Xi ) ) * ( 1 - smoothstep( 1.4, 1.9, P.b ) );
	const toe = P.Xc + P.Wt;
	const s = sat( ( xi - P.Xc ) / Math.max( P.Wt, 0.05 ) );
	const k = ( 1 - s ) * 0.45;
	const faceFill = smoothstep( k + 0.9, k + 1.08, P.b );
	const ahead = Math.exp( ( xi - toe ) * - 3 ) * P.wBore;
	const behind = Math.exp( ( P.Xc - xi ) / lam * - 16 ) * P.wBore;
	const roller = xi > toe ? ahead : xi < P.Xc ? behind : Math.max( faceFill, P.wBore );
	return sat( Math.max( impact, roller ) );

}

export class ShoreSampler {

	constructor( { shore, field, terrain, time = G.time, seaLevel = G.seaLevel } ) {

		this.shore = shore;
		this.field = field;
		this.terrain = terrain;
		this.time = time;
		this.seaLevel = seaLevel;
		this.count = 0; // sample() calls (reset by the caller once a frame)
		this._P = {};
		this._r0 = {};
		this._r1 = {};
		this._ph = {};
		this._U = {};

	}

	// live uniform values (the settings panel writes these handles)
	_uniforms() {

		const F = this.shore.uniforms.fields, U = this._U;
		U.period = F.period.value;
		U.amplitude = F.amplitude.value;
		U.variation = F.variation.value;
		U.gamma = F.gamma.value;
		U.breakSpan = F.breakSpan.value;
		U.curl = F.curl.value;
		U.enabled = F.enabled.value;
		U.surfBoost = F.surfBoost.value;
		return U;

	}

	// terrainShoreSample: ( T, dirX * exposure, dirZ * exposure ) bilinear between texel centres
	_field( x, z, out ) {

		const f = this.field;
		const res = f.res;
		const fx = clamp( ( x - f.origin ) / f.size * res - 0.5, 0, Math.max( res - 1.001, 0 ) );
		const fz = clamp( ( z - f.origin ) / f.size * res - 0.5, 0, Math.max( res - 1.001, 0 ) );
		const i = Math.floor( fx ), j = Math.floor( fz ), tx = fx - i, tz = fz - j;
		const i1 = Math.min( i + 1, res - 1 ), j1 = Math.min( j + 1, res - 1 );
		const D = f.data;
		const a = ( j * res + i ) * 4, b = ( j * res + i1 ) * 4, c = ( j1 * res + i ) * 4, d = ( j1 * res + i1 ) * 4;
		for ( let k = 0; k < 3; k ++ ) out[ k ] = mix( mix( D[ a + k ], D[ b + k ], tx ), mix( D[ c + k ], D[ d + k ], tx ), tz );
		return out;

	}

	// shoreEvaluateNoNormal( x0, d, … ).disp (+ what the gameplay needs) at Lagrangian point (x, z)
	_evaluate( x, z, d, U, t, out, detail ) {

		const sh = this._field( x, z, this._ph );
		const T = sh[ 0 ];
		const exposure = Math.hypot( sh[ 1 ], sh[ 2 ] );
		const dx = sh[ 1 ] / Math.max( exposure, 1e-4 ), dz = sh[ 2 ] / Math.max( exposure, 1e-4 );
		const along = - dz * x + dx * z; // dot( xz, ( -dir.y, dir.x ) )
		const bar = shoreBar( along );
		const s = ( t - T ) / U.period + shoreWobble( along, bar );
		const c = Math.sqrt( clamp( d, 0.3, 25 ) * GRAVITY );
		const lam = c * U.period;
		const m = Math.floor( s + 0.5 );
		const u = s - m;
		const A0 = shoreWaveAmp( m, along, U, bar );
		const An = shoreWaveAmp( m + Math.sign( u ), along, U, bar );
		const A = mix( A0, An, smoothstep( 0.32, 0.5, Math.abs( u ) ) * 0.5 );
		// shoreBreakDepth
		const pcx = x + dx * u * lam, pcz = z + dz * u * lam;
		const dc = this.seaLevel.value - this.terrain.heightAt( pcx, pcz );
		const dB = mix( dc, d, smoothstep( 0.3, 0.5, Math.abs( u ) ) );
		const env = smoothstep( 26, 13, d ) * smoothstep( - 0.25, 0.05, d ) * sat( exposure * 1.4 ) * U.enabled;
		const P = breakParams( A, dB, U, this._P );
		const r = profile( u, lam, P, U, this._r0 );
		out.dispX = dx * r.x * env;
		out.dispY = r.y * env;
		out.dispZ = dz * r.x * env;
		if ( detail ) {

			// slope along dir from the cross-section a little shoreward (as shoreShapePair does for the normal)
			const e = 0.15, du = - e / lam;
			const r1 = profile( u + du, lam, P, U, this._r1 );
			const dX = e + ( r1.x - r.x ) * env;
			const slope = ( r1.y - r.y ) * env / ( Math.abs( dX ) > 1e-3 ? dX : 1e-3 );
			out.slope = slope;
			out.gradX = dx * slope;
			out.gradZ = dz * slope;
			out.dirX = dx;
			out.dirZ = dz;
			out.env = env;
			out.u = u;
			out.m = m;
			out.A = A;
			out.b = P.b;
			out.H = ( P.ycB - P.ytB ) * env; // visible height: the bore's, once broken
			out.Hc = P.H * env; // crest-to-trough of the wave before it broke
			out.c = c;
			out.lam = lam;
			out.foam = whitewater( r.x - u * lam, lam, P ) * env;

		}

		return out;

	}

	// the Eulerian water height and the wave state at world (x, z): one sample point
	sample( x, z, out = {}, t = this.time.value ) {

		this.count ++;
		const U = this._uniforms();
		const sea = this.seaLevel.value;
		const depth = sea - this.terrain.heightAt( x, z );
		out.depth = depth;
		let x0 = x, z0 = z;
		for ( let i = 0; i < 2; i ++ ) {

			this._evaluate( x0, z0, depth, U, t, out, false );
			x0 = x - out.dispX;
			z0 = z - out.dispZ;

		}

		this._evaluate( x0, z0, depth, U, t, out, true );
		out.h = sea + out.dispY;
		return out;

	}

}
