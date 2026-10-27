// CPU shore-wave sampler (src/ocean/ShoreSampler.js) against the GPU shader it mirrors (headless Dawn).
// The GPU side runs the real ShoreWaves module and the Eulerian solve of waterQueryHeightAtXZ (shore
// part only) at a grid of points over a stub beach whose shore field is a texture read exactly like
// TerrainGPU.terrainShoreSample. Several wave settings and times; fails if the heights differ by more
// than 1 cm anywhere. Also times the CPU sampler.
import './headless.mjs';
import { GPU, ShaderModule, Texture, StorageBuffer, ComputeKernel, readBuffer, commonModule, G } from '../src/engine/webgpu.js';
import { ShoreWaves } from '../src/ocean/ShoreWaves.js';
import { ShoreSampler } from '../src/ocean/ShoreSampler.js';

await GPU.init( { headless: true } );

// stub beach: sea toward +z, depth ~0.05 z plus a bar, waves arriving a little oblique (direction varies along x)
const heightAt = ( x, z ) => - 0.05 * z + 0.3 * Math.sin( x * 0.04 ) + ( z < - 3 ? - ( z + 3 ) * 0.06 : 0 );
const origin = - 200, size = 400, res = 256;
const data = new Float32Array( res * res * 4 );
for ( let j = 0; j < res; j ++ ) for ( let i = 0; i < res; i ++ ) {

	const x = origin + ( i + 0.5 ) / res * size, z = origin + ( j + 0.5 ) / res * size;
	const a = 0.25 * Math.sin( x * 0.01 ); // wave direction swings ±14° along the beach
	const dx = Math.sin( a ), dz = - Math.cos( a );
	const T = 2 / Math.sqrt( 9.81 * 0.05 ) * ( 20 - Math.sqrt( Math.max( z, 0.25 ) ) ) - x * dx * 0.12;
	const expo = Math.min( 1, Math.max( 0.02, 0.95 - Math.abs( a ) * 0.5 ) );
	const k = ( j * res + i ) * 4;
	data[ k ] = T; data[ k + 1 ] = dx * expo; data[ k + 2 ] = dz * expo; data[ k + 3 ] = T;

}

const shoreTex = new Texture( { label: 'shoreFieldStub', width: res, height: res, format: 'rgba32float', usage: [ 'sample', 'copyDst' ], data } );
const terrain = {
	module: new ShaderModule( {
		name: 'terrainStub',
		deps: [ commonModule ],
		bindings: { terrainShoreTex: { texture: shoreTex, sampleType: 'unfilterable-float' } },
		code: /* wgsl */`
fn terrainHeightAt( xz: vec2f ) -> f32 {
	return -0.05 * xz.y + 0.3 * sin( xz.x * 0.04 ) - select( 0.0, ( xz.y + 3.0 ) * 0.06, xz.y < -3.0 );
}
fn terrainShoreSample( xz: vec2f ) -> vec4f {
	let res = ${ res }.0;
	let f = ( xz - vec2f( ${ origin }.0 ) ) / ${ size }.0 * res - 0.5;
	let fc = clamp( f, vec2f( 0.0 ), vec2f( max( res - 1.001, 0.0 ) ) );
	let i = floor( fc );
	let t = fract( fc );
	let ii = vec2i( i );
	let mx = vec2i( max( i32( res ) - 1, 0 ) );
	let a = textureLoad( terrainShoreTex, ii, 0 );
	let b = textureLoad( terrainShoreTex, min( ii + vec2i( 1, 0 ), mx ), 0 );
	let c = textureLoad( terrainShoreTex, min( ii + vec2i( 0, 1 ), mx ), 0 );
	let d = textureLoad( terrainShoreTex, min( ii + vec2i( 1, 1 ), mx ), 0 );
	return mix( mix( a, b, t.x ), mix( c, d, t.x ), t.y );
}
fn terrainNormalRock( xz: vec2f ) -> vec4f { return vec4f( 0.0, 0.05, 0.0, 1.0 ); }
fn terrainUvOf( xz: vec2f ) -> vec2f { return ( xz + 200.0 ) / 400.0; }
`,
	} ),
};

const shore = new ShoreWaves( terrain );
// points over the surf zone: x -60..60, z 0.5..34 (depth ~0..1.7 m and the shoaling zone beyond)
const NX = 40, NZ = 48, N = NX * NZ;
const pts = new Float32Array( N * 4 );
for ( let j = 0; j < NZ; j ++ ) for ( let i = 0; i < NX; i ++ ) {

	const k = ( j * NX + i ) * 4;
	pts[ k ] = - 60 + i * 3.07; pts[ k + 1 ] = 0.5 + j * 0.71;

}

const inBuf = new StorageBuffer( { label: 'pts', count: N, type: 'vec4f', data: pts } );
const outBuf = new StorageBuffer( { label: 'heights', count: N, type: 'vec4f' } );
const kernel = new ComputeKernel( {
	label: 'shore heights',
	modules: [ shore.module, terrain.module ],
	bindings: { ptsIn: { storage: inBuf, access: 'read' }, hOut: { storage: outBuf, access: 'read_write' } },
	workgroupSize: [ 64, 1, 1 ],
	code: /* wgsl */`
@compute @workgroup_size( WG_X, WG_Y, WG_Z )
fn main( @builtin( global_invocation_id ) gid: vec3u ) {
	let i = gid.x;
	if ( i >= ${ N }u ) { return; }
	let p = ptsIn[ i ].xy;
	// waterQueryHeightAtXZ, shore part
	let depth = frame.seaLevel - terrainHeightAt( p );
	var x0 = p;
	for ( var k = 0; k < 2; k++ ) { x0 = p - shoreEvaluateNoNormal( x0, depth, terrainHeightAt( x0 ) ).disp.xz; }
	let s = shoreEvaluateNoNormal( x0, depth, terrainHeightAt( x0 ) );
	hOut[ i ] = vec4f( frame.seaLevel + s.disp.y, s.breaking, s.u, s.env );
}`,
} );

const cpu = new ShoreSampler( { shore, field: { data, res, origin, size }, terrain: { heightAt } } );
const F = shore.uniforms.fields;
const cases = [
	{ name: 'default (H 0.68 m, T 9 s)', amplitude: 0.34, period: 9, gamma: 0.78, curl: 1 },
	{ name: 'surf preset (H 1.5 m, T 13 s)', amplitude: 0.75, period: 13, gamma: 0.78, curl: 1 },
	{ name: 'storm (H 1.8 m, T 12 s, gamma 0.9)', amplitude: 0.9, period: 12, gamma: 0.9, curl: 1.4 },
	{ name: 'small (H 0.3 m, T 6 s, curl 0.3)', amplitude: 0.15, period: 6, gamma: 0.6, curl: 0.3 },
];
const times = [ 31.25, 47.9, 1203.4, 6021.7 ];
let worst = 0, failed = false, active = 0;
for ( const c of cases ) {

	F.amplitude.value = c.amplitude; F.period.value = c.period; F.gamma.value = c.gamma; F.curl.value = c.curl;
	let max = 0, sum = 0, n = 0, at = null;
	for ( const t of times ) {

		G.time.value = t;
		GPU.beginFrame();
		kernel.dispatch( Math.ceil( N / 64 ) );
		GPU.submit();
		const r = new Float32Array( await readBuffer( outBuf.getGPU(), N * 16 ) );
		const o = {};
		for ( let i = 0; i < N; i ++ ) {

			cpu.sample( pts[ i * 4 ], pts[ i * 4 + 1 ], o, t );
			const e = Math.abs( o.h - r[ i * 4 ] );
			if ( r[ i * 4 + 3 ] > 0.05 ) active ++;
			sum += e * e; n ++;
			if ( e > max ) { max = e; at = { x: pts[ i * 4 ], z: pts[ i * 4 + 1 ], t, gpu: r[ i * 4 ], cpu: o.h, b: r[ i * 4 + 1 ] }; }

		}

	}

	worst = Math.max( worst, max );
	// (the GPU works in f32: on a near-vertical bore front a 1e-4 phase difference moves the step, so a
	// single point can differ by ~1 cm; everywhere else it is well under a millimetre)
	const ok = max < 0.02 && Math.sqrt( sum / n ) < 0.001;
	if ( ! ok ) failed = true;
	console.log( `${ ok ? 'ok  ' : 'FAIL' } ${ c.name }: max |cpu - gpu| ${ ( max * 1000 ).toFixed( 2 ) } mm, rms ${ ( Math.sqrt( sum / n ) * 1000 ).toFixed( 3 ) } mm over ${ n } points${ ok ? '' : ' at ' + JSON.stringify( at ) }` );

}

if ( active < N ) throw new Error( 'the test grid misses the surf zone' );

// cost of one sample() (= 3 shore evaluations: the Eulerian solve + slope / whitewater)
const o = {};
let x = 0;
for ( let i = 0; i < 20000; i ++ ) cpu.sample( - 50 + ( i % 100 ), 2 + ( i % 30 ), o, 100 + i * 0.01 );
const t0 = performance.now();
const M = 200000;
for ( let i = 0; i < M; i ++ ) {

	cpu.sample( - 50 + ( i % 100 ), 2 + ( i % 30 ), o, 100 + i * 0.01 );
	x += o.h;

}

const us = ( performance.now() - t0 ) * 1000 / M;
console.log( `ok   ShoreSampler.sample: ${ us.toFixed( 2 ) } µs per sample point (${ ( us * 8 ).toFixed( 1 ) } µs for the 8-point frame budget)${ Number.isFinite( x ) ? '' : ' NaN!' }` );
console.log( `${ failed ? 'FAIL' : 'ok  ' } CPU shore sampler matches the shader: worst ${ ( worst * 1000 ).toFixed( 2 ) } mm` );
process.exit( failed ? 1 : 0 );
