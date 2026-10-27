import { Group, Mesh, Vector3, Euler, Quaternion } from '../engine/index.js';
import { prepare, mergePrepared, sphere, roundedBox, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial, PAT } from '../game/GameMaterials.js';
import { ShoreSampler } from '../ocean/ShoreSampler.js';
import { SPRAY } from '../fx/Spray.js';
import { Options } from '../core/Options.js';
import { t } from '../ui/i18n.js';
import { DEFAULT_BOARD } from './SurfboardSpec.js';

// Surfing: the surfboard on the equipment wheel (R), no score, no goals.
//
//   carry   on land: the board under your arm. Wading in past ~0.65 m (or swimming) you lie on it.
//   paddle  prone: W A S D (A / D turn), Shift paddles harder, the board rides the surface. Space next to
//           a breaking wave tries to catch it: on its face, pointing shoreward, fast enough → you stand
//           up; otherwise the wave lifts you and goes on (the board is shoved / spun) and a note says why.
//   ride    standing: A / D carve along the wave, W pumps (more speed), S slows down. Speed, lean and how
//           hard you can turn come from the slope of the face under the board. Space jumps off.
//   loose   after a wipeout (whitewater, the wave fading out, the reef) or jumping off you swim; the
//           board floats next to you on its leash and you climb back on by swimming into it.
//
// The water under the board comes from the CPU mirror of the shore waves (ocean/ShoreSampler.js): no
// read-back latency, in step with the settings. The open-ocean FFT chop is added as a slow residual
// from the player's water query. At most 5 sample points a frame: centre, nose, tail, the residual
// (when a read-back lands) and the loose board.
//
// Free camera (F) and photo mode (P) work while surfing: the ride goes on without input under the
// free camera.

export const SURF_TUNING = {
	// catching a wave (Space while paddling)
	catchMinH: 0.35, // m: smallest wave (crest to trough) that can be caught
	catchFaceSlope: 0.05, // the face under the board must fall shoreward at least this steeply (dh/ds)
	catchPhase: [ - 0.18, 0.06 ], // phase in the wave counted as "on the face" (crest 0, front < 0)
	catchBreak: [ - 3.5, 1.2 ], // breaking progress window: a steepening swell .. just broken
	maxSlope: 1.2, // the steepest slope the board responds to (plunging faces are near vertical)
	catchAlign: 0.6, // cos of the largest angle between the board and the wave's direction
	catchSpeed: 0.38, // speed along the wave / wave speed needed (the wave lifting you helps)
	popSpeed: 0.95, // speed after the pop-up, fraction of the wave speed
	// paddling
	paddleAccel: 1.8, // 1/s: how fast you reach paddling speed
	paddleTurn: 1.25, // rad/s
	paddleDrag: 0.25, // 1/s forward drag when not paddling
	sideDrag: 4, // 1/s: the board doesn't slip sideways
	paddleSlopeGravity: 0.35, // share of gravity along the surface slope while prone
	whitewaterPush: 2.2, // m/s^2 shove of a bore's whitewater
	// riding
	rideGravity: 0.9, // share of gravity along the surface slope while standing
	carry: 2.2, // 1/s: how strongly the face pulls you to its speed
	carryFrac: 1.0, // ... toward the wave speed at the sweet spot
	sweetSpot: - 0.07, // phase just ahead of the crest where the face is steepest
	phaseGain: 3, // speed target per unit of phase away from the sweet spot
	pump: 1.4, // m/s^2 with W (more on a steep face)
	brake: 1.3, // 1/s with S
	grip: 6, // 1/s: rails bite (sideways speed bleeds off)
	rideDrag: 0.12, // 1/s
	fullTurnSpeed: 4, // m/s: below this the carve is weaker
	maxLean: 0.65, // rad
	// wipeouts and the end of a ride
	whitewaterFoam: 0.6, // whitewater under the board above this ...
	whitewaterTime: 0.3, // ... for this long (s): wiped out
	fadeTime: 1.4, // s behind the wave (it has gone on) or stalled: falls off
	stallSpeed: 1.0, // m/s: slower than this counts as stalled
	fadeHeight: 0.12, // m: the wave is gone below this height
	shallowDepth: 0.45, // m of water: the ride ends, you step off (sand)
	rockDepth: 0.6, // m of water over reef / rock: hit it, wiped out
	// the board on the water
	heaveK: 110, // 1/s^2: spring of the board to the water height (higher: stiffer, follows small chop)
	heaveC: 14, // 1/s: its damping (~0.67 of critical: a little overshoot over a crest)
	tiltRate: 12, // 1/s: how fast pitch / roll follow the water under nose, tail and rails
	// first person (V switches to the chase camera)
	eyeProne: 0.32, // m above the board lying on it
	eyeStand: 1.5, // m above the board standing (knees bent)
	bodyFollowProne: 0.85, // share of the board's pitch / roll the view takes lying down
	bodyFollowStand: 0.55, // ... standing (the legs absorb the rest)
	kneeBend: 0.012, // m of eye drop per m/s^2 of heave acceleration
	speedShake: 0.0022, // rad of shake per m/s over 3 m/s
	foamShake: 0.02, // rad of shake in full whitewater
	fovPerSpeed: 1.2, // degrees of extra field of view per m/s over 3 m/s ...
	fovMax: 9, // ... up to this
	// chase camera
	camDist: 5.4,
	camHeight: 0.32, // rad above the board
	camLag: 5, // 1/s
	leash: 2.6, // m
	remountDelay: 1.4, // s after a wipeout before you can climb back on
	wadeMount: 0.65, // m of water at the feet: lie on the board
};
const T = SURF_TUNING;
const GRAV = 9.81;

const sat = ( x ) => ( x < 0 ? 0 : x > 1 ? 1 : x );
const clamp = ( x, a, b ) => ( x < a ? a : x > b ? b : x );
const smoothstep = ( a, b, x ) => {

	const k = sat( ( x - a ) / ( b - a ) );
	return k * k * ( 3 - 2 * k );

};

const _e = new Euler( 0, 0, 0, 'YXZ' );
const _a = new Vector3(), _b = new Vector3(), _c = new Vector3();
const _q = new Quaternion(), _q2 = new Quaternion(), _q3 = new Quaternion(), _q4 = new Quaternion();
const _yAxis = new Vector3( 0, 1, 0 );
// the board's water points: ( along the board, across ) in units of 0.42 length / 0.45 width
const WATER_POINTS = [ [ 0, 0 ], [ 1, 0 ], [ - 1, 0 ], [ 0, 1 ], [ 0, - 1 ] ];

function boardGeometry( spec ) {

	const L = spec.length, W = spec.width, H = spec.thickness, C = spec.colors;
	const parts = [];
	// the blank: a flattened ellipsoid, nose a little narrower (stretched forward)
	parts.push( prepare( sphere( 1, 32, 12 ), { color: C.deck, rough: 0.35, matrix: mat4( 0, 0, 0, 0, 0, 0, W / 2, H / 2, L / 2 ) } ) );
	// rails: a slightly wider, thinner coloured band
	parts.push( prepare( sphere( 1, 32, 6 ), { color: C.rail, rough: 0.4, matrix: mat4( 0, - H * 0.08, 0, 0, 0, 0, W / 2 * 1.015, H / 2 * 0.55, L / 2 * 0.99 ) } ) );
	// stringer stripe and deck pad
	parts.push( prepare( roundedBox( 0.035, 0.004, L * 0.82, 0.0015, 1 ), { color: C.stripe, rough: 0.4, matrix: mat4( 0, H / 2 - 0.001, 0.02 ) } ) );
	parts.push( prepare( roundedBox( W * 0.62, 0.006, L * 0.2, 0.003, 1 ), { color: 0x222628, rough: 0.9, pattern: PAT.rubber, matrix: mat4( 0, H / 2 - 0.004, - L * 0.36 ) } ) );
	// fin
	parts.push( prepare( roundedBox( 0.012, 0.13, 0.12, 0.004, 1 ), { color: C.fin, rough: 0.3, matrix: mat4( 0, - H / 2 - 0.06, - L * 0.42, - 0.25, 0, 0 ) } ) );
	return mergePrepared( parts );

}

export class Surfing {

	constructor( app ) {

		this.app = app;
		this.player = app.player;
		this.input = app.input;
		this.spec = DEFAULT_BOARD;
		this.sampler = new ShoreSampler( { shore: app.shore, field: app.shoreField, terrain: app.terrainData } );
		this.state = 'off'; // off | carry | paddle | ride | loose
		this.pos = new Vector3(); // board centre (x, water y, z)
		this.vel = new Vector3(); // horizontal velocity (y unused)
		this.heading = 0; // the nose points along ( sin, cos )
		this.pitch = 0;
		this.roll = 0;
		this.lean = 0;
		this.wobble = 0; // a failed catch shakes the board
		this.residual = 0; // FFT and the rest, from the read-back (slow)
		this._rv = - 1;
		this.camPos = new Vector3();
		this.camInit = false;
		this.camYawOff = 0;
		this.camPitch = T.camHeight;
		this.ride = { t: 0, dist: 0, shownT: 0 };
		this._whiteT = 0;
		this._fadeT = 0;
		this._cooldown = 0;
		this._carry = [ 0, 0, 0, 0 ];
		this.s = {}; // the last centre sample
		this._sn = {};
		this._st = {};
		this._tmp = {};
		this._tmp2 = {};
		this._pt = { x: 0, z: 0 };
		this.stats = { samples: 0, ms: 0 };
		// the swell under the board (see _readWater): five query slots, one result per point + its rate
		this.slot = app.query.allocate( 'surfboard', 5 );
		this.water = { r: new Float32Array( 5 ), w: new Float32Array( 5 ), t: 0, age: 0, valid: false };
		this.h = new Float32Array( 5 ); // water height at the board points this frame
		this.swellGrad = { x: 0, z: 0 };
		this.vy = 0; // heave velocity (the board is a spring on the water, not glued to it)
		// view: 'first' (standing / lying on the board) or 'chase' (behind the board); V switches
		this.view = 'first';
		this.lookYaw = 0;
		this.lookPitch = - 0.12;
		this._fov = null; // the camera's own field of view while a ride widens it

		// the board (first person: no body of your own for now)
		const mat = createPropMaterial( 'surfboard' );
		this.group = new Group();
		this.group.name = 'Surfboard';
		this.boardMesh = new Mesh( boardGeometry( this.spec ), mat );
		this.boardMesh.frustumCulled = false;
		this.boardMesh.castShadow = true;
		this.group.add( this.boardMesh );

		this.group.visible = false;
		app.scene.add( this.group );

		// the surfboard on the equipment wheel (core/Equipment.js); the 'surfing' gameplay option shows it
		app.equipment.registry.add( {
			id: 'surfboard', label: 'equip.surfboard', hint: 'equip.surfboardHint', unavailableHint: 'equip.surfboardUnavailable', icon: 'surfboard', order: 20,
			visible: () => Options.get( 'surfing' ),
			available: () => [ 'walk', 'swim', 'surf' ].includes( this.player.mode ),
			busy: () => this.state === 'ride',
			equip: () => this._equip(),
			unequip: () => this._unequip(),
		} );

	}

	get active() {

		return this.state === 'paddle' || this.state === 'ride';

	}

	// the mode chip (ui/AppUI.js)
	get modeLabel() {

		return this.state === 'ride' ? 'Riding a wave' : 'Paddling';

	}

	_equip() {

		this.state = 'carry';
		this.group.visible = true;
		this.boardMesh.castShadow = false; // (under the arm, right by the camera: no shadow until on the water)

	}

	_unequip() {

		const p = this.player;
		if ( p.mode === 'surf' ) this._toSwim( 0 );
		this.state = 'off';
		this.group.visible = false;

	}

	_toast( key, ms = 2600 ) {

		const ui = this.app.ui && this.app.ui.ui;
		if ( ui ) ui.toast( t( key ), ms );

	}

	_sample( x, z, out ) {

		const t0 = performance.now();
		this.sampler.sample( x, z, out );
		this.stats.ms += performance.now() - t0;
		// the exact slope of a plunging face / bore front is near vertical: the board feels at most maxSlope
		out.sl = Number.isFinite( out.slope ) ? clamp( out.slope, - T.maxSlope, T.maxSlope ) : 0;
		if ( ! Number.isFinite( out.h ) ) out.h = this.app.query.cpuValid ? this.player.waterH : 0;
		out.gx = out.dirX * out.sl;
		out.gz = out.dirZ * out.sl;
		return out;

	}

	// ---- the open-sea swell (FFT) under the board, from the GPU water query: the same technique as the
	// boat (player/BoatController.js readQueries): five points (centre, nose, tail, both rails) are queried
	// where the board will be when the result comes back; each result minus the CPU shore waves at that
	// point and time is the swell there, and its rate of change extrapolates it over the 1-3 frames until
	// the next result. The breaking shore waves stay on the CPU (no latency).
	_boardPoint( i, out ) {

		const fx = Math.sin( this.heading ), fz = Math.cos( this.heading );
		const h = this.spec.length * 0.42, w = this.spec.width * 0.45;
		const f = WATER_POINTS[ i ];
		out.x = this.pos.x + fx * f[ 0 ] * h - fz * f[ 1 ] * w;
		out.z = this.pos.z + fz * f[ 0 ] * h + fx * f[ 1 ] * w;
		return out;

	}

	_queueWater() {

		const q = this.app.query, lead = q.latency, P = this._pt;
		for ( let i = 0; i < 5; i ++ ) {

			this._boardPoint( i, P );
			q.setPoint( this.slot + i, P.x + this.vel.x * lead, P.z + this.vel.z * lead );

		}

	}

	_readWater( dt ) {

		const q = this.app.query, W = this.water;
		W.age = Math.min( W.age + dt, 0.15 );
		if ( ! q.cpuValid || q.version === this._rv ) return;
		this._rv = q.version;
		const t = q.resultTime, dtR = t - W.t;
		const pts = q.resultInputs, c = q.cpu, k0 = this.slot * 4;
		const t0 = performance.now();
		// CPU shore waves at the queried centre, nose and tail (the rails: the centre plus its slope)
		const sc = this.sampler.sample( pts[ k0 ], pts[ k0 + 1 ], this._tmp, t );
		const shore = [ sc.h, 0, 0, 0, 0 ];
		for ( const i of [ 1, 2 ] ) shore[ i ] = this.sampler.sample( pts[ k0 + i * 4 ], pts[ k0 + i * 4 + 1 ], this._tmp2, t ).h;
		const sl = Number.isFinite( sc.slope ) ? clamp( sc.slope, - 1, 1 ) : 0;
		for ( const i of [ 3, 4 ] ) shore[ i ] = sc.h + sl * ( ( pts[ k0 + i * 4 ] - pts[ k0 ] ) * sc.dirX + ( pts[ k0 + i * 4 + 1 ] - pts[ k0 + 1 ] ) * sc.dirZ );
		this.stats.ms += performance.now() - t0;
		for ( let i = 0; i < 5; i ++ ) {

			const gpu = c[ k0 + i * 4 ];
			if ( ! Number.isFinite( gpu ) || ! Number.isFinite( shore[ i ] ) ) continue;
			const r = clamp( gpu - shore[ i ], - 4, 4 );
			const rate = W.valid && dtR > 1e-4 ? clamp( ( r - W.r[ i ] ) / dtR, - 4, 4 ) : 0;
			W.w[ i ] += ( rate - W.w[ i ] ) * 0.5;
			W.r[ i ] = r;

		}

		W.t = t;
		W.age = 0;
		W.valid = true;

	}

	// the swell at board point i now (extrapolated from the last result)
	_swell( i ) {

		const W = this.water;
		return W.valid ? W.r[ i ] + W.w[ i ] * W.age : 0;

	}

	// everything the board needs about the water this frame: the CPU shore waves at the centre (with the
	// wave state), nose and tail, plus the swell at all five points. Sets this.h (heights), this.swellGrad
	// (the swell's slope along / across the board) and this.residual (the swell at the centre).
	_sampleBoard() {

		const s = this._sample( this.pos.x, this.pos.z, this.s );
		const P = this._pt;
		this._boardPoint( 1, P );
		const n = this._sample( P.x, P.z, this._sn );
		this._boardPoint( 2, P );
		const tl = this._sample( P.x, P.z, this._st );
		const h = this.spec.length * 0.42, w = this.spec.width * 0.45;
		const fx = Math.sin( this.heading ), fz = Math.cos( this.heading );
		const across = ( - fz * s.dirX + fx * s.dirZ ) * s.sl * w; // shore height change from the centre to a rail
		const H = this.h;
		H[ 0 ] = s.h + this._swell( 0 );
		H[ 1 ] = n.h + this._swell( 1 );
		H[ 2 ] = tl.h + this._swell( 2 );
		H[ 3 ] = s.h + across + this._swell( 3 );
		H[ 4 ] = s.h - across + this._swell( 4 );
		for ( let i = 0; i < 5; i ++ ) if ( ! Number.isFinite( H[ i ] ) ) H[ i ] = Number.isFinite( this.player.waterH ) ? this.player.waterH : 0;
		this.residual = this._swell( 0 );
		// the swell's slope: the board slides down a swell's face like down a breaking wave's
		const gF = clamp( ( this._swell( 1 ) - this._swell( 2 ) ) / ( 2 * h ), - 0.6, 0.6 );
		const gS = clamp( ( this._swell( 3 ) - this._swell( 4 ) ) / ( 2 * w ), - 0.6, 0.6 );
		this.swellGrad.x = fx * gF - fz * gS;
		this.swellGrad.z = fz * gF + fx * gS;
		return s;

	}

	// ------------------------------------------------------------------ per frame

	update( dt, freeCam = false ) {

		dt = Math.min( dt, 0.05 );
		this.sampler.count = 0;
		this.stats.ms = 0;
		const p = this.player;
		if ( this.state === 'off' ) return;
		if ( this.state !== 'carry' ) {

			this._readWater( dt );
			this._queueWater();

		}

		this._cooldown = Math.max( 0, this._cooldown - dt );
		// V: first person on the board / chase camera behind it
		if ( this.active && ! freeCam && this.input.hit( 'KeyV' ) ) {

			this.view = this.view === 'first' ? 'chase' : 'first';
			this.camInit = false;
			this._toast( this.view === 'first' ? 'surf.viewFirst' : 'surf.viewChase', 1400 );

		}

		switch ( this.state ) {

			case 'carry': this._carryUpdate( dt ); break;
			case 'loose': this._looseUpdate( dt ); break;
			case 'paddle': this._paddle( dt, freeCam ); break;
			case 'ride': this._ride( dt, freeCam ); break;

		}

		if ( this.active ) {

			this._applyPose( dt );
			if ( ! freeCam ) this._camera( dt );
			else this._restoreFov();

		} else this._restoreFov();

		this._hud( dt );
		this.stats.samples = this.sampler.count;

	}

	// ---- on land: the board under the right arm; into the water: lie on it
	_carryUpdate() {

		const p = this.player;
		const deep = p.waterH - p.position.y;
		if ( p.mode === 'swim' || ( p.mode === 'walk' && deep > T.wadeMount ) ) {

			this._mount( p.yaw + Math.PI );
			return;

		}

		const fx = - Math.sin( p.yaw ), fz = - Math.cos( p.yaw );
		this.group.position.set( p.position.x - fz * 0.42 + fx * 0.1, p.position.y + 1.02, p.position.z + fx * 0.42 + fz * 0.1 );
		this.group.quaternion.setFromEuler( _e.set( - 0.15, p.yaw + Math.PI, 1.35 ) );

	}

	_mount( heading ) {

		const p = this.player;
		this.state = 'paddle';
		p.mode = 'surf';
		this.heading = heading;
		this.pos.set( p.position.x, p.waterH, p.position.z );
		this.vel.set( p.velocity.x, 0, p.velocity.z ).multiplyScalar( 0.5 );
		this.pitch = this.roll = this.lean = 0;
		this.vy = 0;
		this.camInit = false;
		this.camYawOff = 0;
		this.lookYaw = 0;
		this.lookPitch = - 0.12;
		this.boardMesh.castShadow = true;
		// the water under the board before the first pose: _applyPose runs this same frame, and without a
		// sample the height would be undefined (NaN in the board, the camera and the player: a black view)
		this._sampleBoard();
		this.pos.y = this.h[ 0 ];

	}

	// ---- prone
	_paddle( dt, freeCam ) {

		const p = this.player, inp = this.input, sp = this.spec;
		const s = this._sampleBoard();
		const on = ! freeCam;
		const turn = on ? ( inp.down( 'KeyA' ) ? 1 : 0 ) - ( inp.down( 'KeyD' ) ? 1 : 0 ) : 0;
		const fwd = on && inp.down( 'KeyW' ), back = on && inp.down( 'KeyS' );
		const boost = on && ( inp.down( 'ShiftLeft' ) || inp.down( 'ShiftRight' ) ) ? sp.paddleBoost : 1;
		this.heading += turn * T.paddleTurn * dt;
		const fx = Math.sin( this.heading ), fz = Math.cos( this.heading ), rx = - fz, rz = fx;
		let vf = this.vel.x * fx + this.vel.z * fz, vs = this.vel.x * rx + this.vel.z * rz;
		if ( fwd ) vf += ( sp.paddleSpeed * boost - vf ) * ( 1 - Math.exp( - dt * T.paddleAccel * boost ) );
		else vf *= Math.exp( - dt * T.paddleDrag );
		if ( back ) vf *= Math.exp( - dt * 2.5 );
		vs *= Math.exp( - dt * T.sideDrag );
		this.vel.set( fx * vf + rx * vs, 0, fz * vf + rz * vs );
		// the water: down the surface slope (a wave lifting the tail pushes you shoreward), whitewater shoves
		this.vel.x -= GRAV * ( s.gx + this.swellGrad.x ) * T.paddleSlopeGravity * dt;
		this.vel.z -= GRAV * ( s.gz + this.swellGrad.z ) * T.paddleSlopeGravity * dt;
		if ( s.foam > 0.3 && s.b > 1 ) {

			this.vel.x += s.dirX * T.whitewaterPush * s.foam * dt;
			this.vel.z += s.dirZ * T.whitewaterPush * s.foam * dt;

		}

		this.pos.x += this.vel.x * dt;
		this.pos.z += this.vel.z * dt;
		if ( fwd ) this._paddleSplash( dt, boost );

		// paddled into the shallows: stand up, board under the arm
		const water = s.h + this.residual;
		const ground = p.groundAt( this.pos.x, this.pos.z, water + 1 );
		if ( water - ground < T.shallowDepth ) {

			this._toWalk( ground );
			return;

		}

		if ( on ) {

			p.prompt = { key: 'Space', text: t( 'prompt.paddle' ) };
			if ( inp.hit( 'Space' ) ) this._tryCatch( s, vf );

		}

	}

	_tryCatch( s, vf ) {

		const along = this.vel.x * s.dirX + this.vel.z * s.dirZ;
		const align = Math.sin( this.heading ) * s.dirX + Math.cos( this.heading ) * s.dirZ;
		const onFace = s.env > 0.25 && s.H > T.catchMinH && s.u > T.catchPhase[ 0 ] && s.u < T.catchPhase[ 1 ] && s.slope < - T.catchFaceSlope;
		const side = Math.sign( ( Math.cos( this.heading ) * s.dirX - Math.sin( this.heading ) * s.dirZ ) ) || 1;
		if ( s.foam > 0.55 && s.b > T.catchBreak[ 1 ] ) {

			this._toast( 'surf.whitewater' );
			this.wobble = 0.6;

		} else if ( ! onFace || s.b < T.catchBreak[ 0 ] ) {

			this._toast( 'surf.noWave' );

		} else if ( s.b > T.catchBreak[ 1 ] ) {

			this._toast( 'surf.whitewater' );
			this.wobble = 0.6;

		} else if ( align < T.catchAlign ) {

			// side-on to the wave: it shoves the board along and spins it
			this._toast( 'surf.wrongDir' );
			this.vel.x += s.dirX * s.c * 0.55;
			this.vel.z += s.dirZ * s.c * 0.55;
			this.heading += side * 0.7;
			this.wobble = 1;

		} else if ( along < T.catchSpeed * s.c ) {

			// too slow: the wave lifts you, gives a shove and rolls on under the board
			this._toast( 'surf.tooSlow' );
			this.vel.x += s.dirX * s.c * 0.3;
			this.vel.z += s.dirZ * s.c * 0.3;
			this.wobble = 0.8;

		} else {

			this.state = 'ride';
			const v = Math.max( vf, s.c * T.popSpeed );
			this.vel.set( Math.sin( this.heading ) * v, 0, Math.cos( this.heading ) * v );
			this.ride.t = this.ride.dist = 0;
			this.ride.shownT = 0;
			this._whiteT = this._fadeT = 0;
			this._toast( 'surf.caught', 1600 );
			if ( this.app.audio ) this.app.audio.splash( 0.3, this.player.position );

		}

	}

	// ---- standing
	_ride( dt, freeCam ) {

		const p = this.player, inp = this.input, sp = this.spec;
		const s = this._sampleBoard();
		const on = ! freeCam;
		const face = smoothstep( 0.015, 0.2, - s.sl ) * s.env;
		// down the face, and the face carrying you toward its own speed
		this.vel.x -= GRAV * ( s.gx + this.swellGrad.x ) * T.rideGravity * dt;
		this.vel.z -= GRAV * ( s.gz + this.swellGrad.z ) * T.rideGravity * dt;
		// the face pulls you toward its speed, adjusted by where you are on it: too far ahead of the crest a
		// little slower (the crest catches up), at the sweet spot just ahead of the crest at the wave's speed
		const along = this.vel.x * s.dirX + this.vel.z * s.dirZ;
		const target = s.c * ( T.carryFrac + T.phaseGain * clamp( s.u - T.sweetSpot, - 0.3, 0.1 ) );
		const pull = ( target - along ) * face * T.carry * dt;
		this.vel.x += s.dirX * pull;
		this.vel.z += s.dirZ * pull;
		// carving: how hard depends on speed and on how steep the face is
		let speed = Math.hypot( this.vel.x, this.vel.z );
		const turn = on ? ( inp.down( 'KeyA' ) ? 1 : 0 ) - ( inp.down( 'KeyD' ) ? 1 : 0 ) : 0;
		const rate = sp.turnRate * turn * clamp( speed / T.fullTurnSpeed, 0.35, 1 ) * ( 0.45 + 0.75 * face );
		this.heading += rate * dt;
		const fx = Math.sin( this.heading ), fz = Math.cos( this.heading ), rx = - fz, rz = fx;
		if ( on && inp.down( 'KeyW' ) ) {

			this.vel.x += fx * T.pump * ( 0.3 + face ) * dt;
			this.vel.z += fz * T.pump * ( 0.3 + face ) * dt;

		}

		if ( on && inp.down( 'KeyS' ) ) this.vel.multiplyScalar( Math.exp( - dt * T.brake ) );
		// the rails bite: the board goes where it points
		let vf = this.vel.x * fx + this.vel.z * fz, vs = this.vel.x * rx + this.vel.z * rz;
		vs *= Math.exp( - dt * T.grip );
		if ( vf < 0 ) vf *= Math.exp( - dt * 3 );
		this.vel.set( fx * vf + rx * vs, 0, fz * vf + rz * vs ).multiplyScalar( Math.exp( - dt * T.rideDrag ) );
		speed = Math.hypot( this.vel.x, this.vel.z );
		if ( speed > sp.maxSpeed ) this.vel.multiplyScalar( sp.maxSpeed / speed );
		this.pos.x += this.vel.x * dt;
		this.pos.z += this.vel.z * dt;
		this.lean += ( clamp( - rate * speed * 0.09, - T.maxLean, T.maxLean ) - this.lean ) * ( 1 - Math.exp( - dt * 6 ) );
		this.ride.t += dt;
		this.ride.dist += speed * dt;
		this._spray( dt, s, speed, face );

		// the end of the ride
		this._whiteT = s.foam > T.whitewaterFoam && s.b > 1 ? this._whiteT + dt : 0;
		// the wave has gone on without you (behind its crest, off the face) or you have all but stopped;
		// out in the flats ahead of a broken wave you wait for its whitewater instead
		this._fadeT = ( s.u > 0.04 && face < 0.05 ) || speed < T.stallSpeed ? this._fadeT + dt : 0;
		const water = s.h + this.residual;
		const ground = p.groundAt( this.pos.x, this.pos.z, water + 1 );
		if ( water - ground < T.rockDepth && this._rocky( this.pos.x, this.pos.z, ground ) ) return this._wipe( 'surf.wipeRocks' );
		if ( water - ground < T.shallowDepth ) {

			this._toast( 'surf.rideEnd' );
			return this._toWalk( ground );

		}

		if ( this._whiteT > T.whitewaterTime ) return this._wipe( 'surf.wipeWhitewater' );
		if ( this._fadeT > T.fadeTime || s.H < T.fadeHeight ) return this._wipe( 'surf.waveFaded' );
		if ( on ) {

			p.prompt = { key: 'Space', text: t( 'prompt.ride' ) };
			if ( inp.hit( 'Space' ) ) return this._wipe( 'surf.jumpedOff' );

		}

	}

	// reef or rock under the board (the reef floor, or steep rocky ground), as opposed to a sandy bottom
	_rocky( x, z, ground ) {

		const reef = this.player.reef;
		if ( reef && reef.floorHeightAt && reef.floorHeightAt( x, z ) >= ground - 0.02 && reef.floorHeightAt( x, z ) > this.app.terrainData.heightAt( x, z ) + 0.05 ) return true;
		const T0 = this.app.terrainData;
		const sx = T0.heightAt( x + 0.6, z ) - T0.heightAt( x - 0.6, z ), sz = T0.heightAt( x, z + 0.6 ) - T0.heightAt( x, z - 0.6 );
		return Math.hypot( sx, sz ) / 1.2 > 0.32;

	}

	// off the board: swimming, the board floating next to you on its leash
	_wipe( key ) {

		this._toast( key, 2800 );
		this._toSwim( 1 );
		this.state = 'loose';
		this._cooldown = T.remountDelay;
		const rx = - Math.cos( this.heading ), rz = Math.sin( this.heading );
		this.pos.x += rx * 1.2;
		this.pos.z += rz * 1.2;
		this.vel.multiplyScalar( 0.5 );
		this.heading += ( Math.random() - 0.5 ) * 1.6;
		if ( this.app.audio ) this.app.audio.splash( key === 'surf.jumpedOff' ? 0.5 : 0.9, this.player.position );

	}

	_toSwim( keepSpeed ) {

		const p = this.player;
		const water = ( this.s.h ?? p.waterH ) + this.residual;
		p.mode = 'swim';
		p.position.set( this.pos.x, water - 0.35, this.pos.z );
		p.velocity.set( this.vel.x * 0.3 * keepSpeed, 0, this.vel.z * 0.3 * keepSpeed );
		p.waterH = p.waterMean = water;
		p.floating = true;
		p.yaw = this.heading + Math.PI;
		p.pitch = - 0.1;
		p._camY = null;

	}

	_toWalk( ground ) {

		const p = this.player;
		p.mode = 'walk';
		p.position.set( this.pos.x, ground, this.pos.z );
		p.velocity.set( 0, 0, 0 );
		p.yaw = this.heading + Math.PI;
		p.pitch = - 0.05;
		p._camY = null;
		this.state = 'carry';

	}

	// ---- after a wipeout: the board floats beside you on the leash; swim into it to climb back on
	_looseUpdate( dt ) {

		const p = this.player;
		if ( p.mode === 'walk' ) {

			this.state = 'carry'; // out of the water: the leash brings the board to hand
			return;

		}

		if ( p.mode !== 'swim' ) return;
		const s = this._sample( this.pos.x, this.pos.z, this.s );
		this.vel.multiplyScalar( Math.exp( - dt * 0.8 ) );
		if ( s.foam > 0.3 ) {

			this.vel.x += s.dirX * T.whitewaterPush * s.foam * dt;
			this.vel.z += s.dirZ * T.whitewaterPush * s.foam * dt;

		}

		this.pos.x += this.vel.x * dt;
		this.pos.z += this.vel.z * dt;
		const dx = this.pos.x - p.position.x, dz = this.pos.z - p.position.z, d = Math.hypot( dx, dz );
		if ( d > T.leash ) {

			this.pos.x = p.position.x + dx / d * T.leash;
			this.pos.z = p.position.z + dz / d * T.leash;

		}

		this.pos.y = s.h + this._swell( 0 ) + this.spec.thickness * 0.3;
		this.pitch = Math.atan( s.sl * Math.cos( this.heading - Math.atan2( s.dirX, s.dirZ ) ) );
		this.group.position.copy( this.pos );
		this.group.quaternion.setFromEuler( _e.set( - this.pitch, this.heading, 0 ) );
		if ( d < 1.1 && this._cooldown <= 0 ) this._mount( this.heading );

	}

	// ---- the board on the water: heave as a damped spring to the water at the centre, pitch from the nose
	// and tail heights, roll from the two rails (all including the swell: _sampleBoard)
	_applyPose( dt ) {

		const sp = this.spec, H = this.h;
		const h = sp.length * 0.42, w = sp.width * 0.45;
		const water = H[ 0 ];
		const float = this.state === 'paddle' ? sp.thickness * ( sp.buoyancy - 0.5 ) - 0.02 : sp.thickness * 0.1;
		const target = water + float;
		if ( ! Number.isFinite( this.pos.y ) || ! Number.isFinite( this.vy ) ) {

			this.pos.y = target;
			this.vy = 0;

		}

		const acc = T.heaveK * ( target - this.pos.y ) - T.heaveC * this.vy;
		this.vy += acc * dt;
		this.pos.y = clamp( this.pos.y + this.vy * dt, target - 0.35, target + 0.45 ); // (never through the water / off a crest)
		this.heaveAcc = acc;
		const pitch = Math.atan2( H[ 1 ] - H[ 2 ], 2 * h );
		const roll = - Math.atan2( H[ 3 ] - H[ 4 ], 2 * w );
		this.wobble *= Math.exp( - dt * 2.5 );
		const tt = performance.now() / 1000;
		this.pitch += ( pitch + Math.sin( tt * 7 ) * this.wobble * 0.25 - this.pitch ) * ( 1 - Math.exp( - dt * T.tiltRate ) );
		this.roll += ( roll + ( this.state === 'ride' ? this.lean : 0 ) + Math.sin( tt * 9 ) * this.wobble * 0.35 - this.roll ) * ( 1 - Math.exp( - dt * T.tiltRate ) );
		// (a non-finite sample must never stick in the smoothed angles)
		if ( ! Number.isFinite( this.pitch ) ) this.pitch = 0;
		if ( ! Number.isFinite( this.roll ) ) this.roll = 0;
		if ( ! Number.isFinite( this.lean ) ) this.lean = 0;
		if ( ! Number.isFinite( this.pos.y ) ) this.pos.y = water;
		this.group.position.copy( this.pos );
		this.group.quaternion.setFromEuler( _e.set( - this.pitch, this.heading, this.roll ) );
		// the swimmer / rider is the board (water queries, audio, wildlife)
		const p = this.player;
		p.position.set( this.pos.x, water - 0.2, this.pos.z );
		p.waterH = p.waterMean = water;
		p.yaw = this.heading + Math.PI + ( this.view === 'first' ? this.lookYaw : 0 );
		p.pitch = this.view === 'first' ? this.lookPitch : - 0.1;

	}

	_camera( dt ) {

		const look = this.input.consumeLook();
		if ( this.view === 'chase' ) this._chaseCamera( dt, look );
		else this._firstPerson( dt, look );

	}

	// First person: lying on the board while paddling, standing on it while riding. The eye rides the
	// board's heave fully and part of its pitch / roll (the body balances the rest); the mouse turns the
	// head. Feedback: the heave acceleration bends the knees (the eye dips as the board is lifted, rises
	// as it drops), speed and whitewater shake the view, the field of view widens with speed.
	_firstPerson( dt, look ) {

		const p = this.player, cam = p.camera;
		this.lookYaw = clamp( this.lookYaw - look.x * 0.0022, - 2.0, 2.0 );
		this.lookPitch = clamp( this.lookPitch - look.y * 0.0022, - 1.3, 1.1 );
		const standing = this.state === 'ride';
		const board = _q.setFromEuler( _e.set( - this.pitch, this.heading, this.roll ) );
		const yawOnly = _q2.setFromEuler( _e.set( 0, this.heading, 0 ) );
		const body = _q3.slerpQuaternions( yawOnly, board, standing ? T.bodyFollowStand : T.bodyFollowProne );
		const eye = _a.set( 0, standing ? T.eyeStand : T.eyeProne, standing ? - 0.2 : 0.15 ).applyQuaternion( body ).add( this.pos );
		eye.y -= clamp( ( this.heaveAcc || 0 ) * T.kneeBend, - 0.14, 0.14 );
		const speed = Math.hypot( this.vel.x, this.vel.z );
		const shake = ( standing ? Math.max( 0, speed - 3 ) * T.speedShake : 0 ) + ( this.s.foam || 0 ) * T.foamShake + this.wobble * 0.02;
		const tt = performance.now() / 1000;
		const sy = ( Math.sin( tt * 23.1 ) + Math.sin( tt * 37.7 ) * 0.5 ) * shake, sp = ( Math.sin( tt * 29.3 ) + Math.sin( tt * 41.9 ) * 0.5 ) * shake;
		cam.position.copy( eye );
		// camera looks down its -Z: turn the body frame (+Z forward) around, then the head
		cam.quaternion.copy( body ).multiply( _q2.setFromAxisAngle( _yAxis, Math.PI ) ).multiply( _q4.setFromEuler( _e.set( this.lookPitch + sp, this.lookYaw + sy, 0 ) ) );
		if ( cam.fov !== undefined ) {

			if ( this._fov === null ) this._fov = cam.fov;
			const want = this._fov + ( standing ? clamp( ( speed - 3 ) * T.fovPerSpeed, 0, T.fovMax ) : 0 );
			const f = cam.fov + ( want - cam.fov ) * ( 1 - Math.exp( - dt * 3 ) );
			if ( Math.abs( f - cam.fov ) > 0.01 ) {

				cam.fov = f;
				cam.updateProjectionMatrix();

			}

		}

		p._camY = null;

	}

	_restoreFov() {

		const cam = this.player.camera;
		if ( this._fov === null || ! cam ) return;
		cam.fov = this._fov;
		cam.updateProjectionMatrix();
		this._fov = null;

	}

	// third-person chase camera behind the board (V; the mouse orbits around it)
	_chaseCamera( dt, look ) {

		const p = this.player, cam = p.camera;
		this._restoreFov();
		this.camYawOff -= look.x * 0.003;
		this.camPitch = clamp( this.camPitch + look.y * 0.003, 0.02, 1.2 );
		if ( Math.abs( look.x ) < 0.5 ) this.camYawOff *= Math.exp( - dt * 0.6 ); // swings back behind the board
		const yaw = this.heading + Math.PI + this.camYawOff;
		const tgt = _a.set( this.pos.x, this.pos.y + ( this.state === 'ride' ? 1.1 : 0.45 ), this.pos.z );
		const d = T.camDist * ( this.state === 'ride' ? 1 : 0.8 );
		const want = _b.set( tgt.x + Math.sin( yaw ) * Math.cos( this.camPitch ) * d, tgt.y + Math.sin( this.camPitch ) * d, tgt.z + Math.cos( yaw ) * Math.cos( this.camPitch ) * d );
		want.y = Math.max( want.y, this.pos.y + 0.45 );
		if ( ! Number.isFinite( want.x + want.y + want.z ) || ! Number.isFinite( tgt.y ) ) return; // (keep the last good view)
		if ( ! this.camInit || ! Number.isFinite( this.camPos.x + this.camPos.y + this.camPos.z ) ) {

			this.camPos.copy( want );
			this.camInit = true;

		}

		this.camPos.lerp( want, 1 - Math.exp( - dt * T.camLag ) );
		cam.position.copy( this.camPos );
		cam.lookAt( tgt );
		p._camY = null;

	}

	// ---- spray off the nose, the foam trail behind the tail, whitewater around the board
	_emit( i, rate, dt, pos, vel, size, kind, opts ) {

		const spray = this.app.spray;
		if ( ! spray ) return;
		this._carry[ i ] += rate * dt;
		const n = Math.floor( this._carry[ i ] );
		if ( n <= 0 ) return;
		this._carry[ i ] -= n;
		if ( spray.nReq > 24 ) return; // leave the shared pool its other requests
		spray.emit( pos, vel, n, size, kind, opts );

	}

	_spray( dt, s, speed, face ) {

		const fx = Math.sin( this.heading ), fz = Math.cos( this.heading ), L = this.spec.length;
		const y = this.pos.y;
		// nose: a fan thrown off the rail on the turn's outside
		const side = this.lean >= 0 ? 1 : - 1;
		_c.set( this.pos.x + fx * L * 0.25, y, this.pos.z + fz * L * 0.25 );
		_b.set( this.vel.x * 0.4 - fz * side * 1.4, 1.1 + speed * 0.12, this.vel.z * 0.4 + fx * side * 1.4 );
		this._emit( 0, Math.max( 0, speed - 2.5 ) * 9 * ( 0.3 + face ), dt, _c, _b, 0.012, SPRAY.SPRAY, { spread: 0.7, jitter: 0.15, life: 0.9 } );
		// tail: drops that fall straight back and leave foam: the trail
		_c.set( this.pos.x - fx * L * 0.45, y + 0.03, this.pos.z - fz * L * 0.45 );
		_b.set( this.vel.x * 0.15, 0.4, this.vel.z * 0.15 );
		this._emit( 1, 22 * sat( speed / 3 ), dt, _c, _b, 0.01, SPRAY.DROPLET, { spread: 0.3, jitter: 0.12, life: 0.4 } );
		// whitewater under the board
		if ( s.foam > 0.3 ) {

			_c.set( this.pos.x, y + 0.05, this.pos.z );
			_b.set( this.vel.x * 0.5, 0.8, this.vel.z * 0.5 );
			this._emit( 2, 30 * s.foam, dt, _c, _b, 0.03, SPRAY.MIST, { spread: 0.9, jitter: 0.4, life: 1.2 } );

		}

	}

	_paddleSplash( dt, boost ) {

		const fx = Math.sin( this.heading ), fz = Math.cos( this.heading );
		const arm = Math.sin( performance.now() / 1000 * 5.5 * boost ) > 0 ? 1 : - 1;
		_c.set( this.pos.x + fx * 0.3 - fz * arm * 0.35, this.pos.y + 0.02, this.pos.z + fz * 0.3 + fx * arm * 0.35 );
		_b.set( - fx * 0.6, 0.9, - fz * 0.6 );
		this._emit( 3, 14 * boost, dt, _c, _b, 0.008, SPRAY.DROPLET, { spread: 0.5, jitter: 0.08, life: 0.5 } );

	}

	// ---- ride time and distance (gameplay option 'surfHud', off by default)
	_hud( dt ) {

		const ui = this.app.ui && this.app.ui.ui;
		if ( ! ui ) return;
		if ( ! this.hudEl ) {

			this.hudEl = document.createElement( 'div' );
			this.hudEl.className = 'tw-surf-hud tw-glass';
			( ui.hud || ui.root ).append( this.hudEl );

		}

		if ( this.state === 'ride' ) this.ride.shownT = 3;
		else this.ride.shownT = Math.max( 0, this.ride.shownT - dt );
		const on = Options.get( 'surfHud' ) && this.ride.shownT > 0;
		this.hudEl.classList.toggle( 'is-on', on );
		if ( on ) this.hudEl.textContent = t( 'surf.hud', { time: t( 'unit.s', { v: this.ride.t.toFixed( 1 ) } ), dist: t( 'unit.m', { v: this.ride.dist.toFixed( 0 ) } ) } );

	}

	// dev: CPU sampler vs the GPU read-back around the player (8 extra query points), for the deviation
	// report. Call window.__surfProbe() repeatedly; returns the running statistics.
	probe() {

		const q = this.app.query, p = this.player;
		if ( ! this._probe ) {

			this._probe = { slot: q.allocate( 'surfProbe', 8 ), v: - 1, n: 0, max: 0, sum: 0, maxRes: 0 };

		}

		const P = this._probe;
		for ( let i = 0; i < 8; i ++ ) {

			const a = i / 8 * Math.PI * 2;
			q.setPoint( P.slot + i, p.position.x + Math.cos( a ) * ( 2 + i ), p.position.z + Math.sin( a ) * ( 2 + i ) );

		}

		if ( q.cpuValid && q.version !== P.v ) {

			P.v = q.version;
			for ( let i = 0; i < 8; i ++ ) {

				const k = ( P.slot + i ) * 4;
				if ( q.resultInputs[ k ] === 0 && q.resultInputs[ k + 1 ] === 0 ) continue;
				const gpu = q.cpu[ k ];
				const s = this.sampler.sample( q.resultInputs[ k ], q.resultInputs[ k + 1 ], this._tmp, q.resultTime );
				if ( s.env < 0.05 ) continue; // only where the shore waves are
				const e = Math.abs( gpu - s.h ), e2 = Math.abs( gpu - s.h - this.residual );
				P.n ++;
				P.sum += e * e;
				P.max = Math.max( P.max, e );
				P.maxRes = Math.max( P.maxRes, e2 );

			}

		}

		return { points: P.n, maxShoreOnly: P.max, rmsShoreOnly: Math.sqrt( P.sum / Math.max( P.n, 1 ) ), maxWithResidual: P.maxRes };

	}

}
