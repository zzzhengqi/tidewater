// Surfboard shapes as data. Everything the surfing model, the board mesh (BoardGeometry.js) and the
// board library (ui/BoardLibrary.js) read about a board comes from its spec.
//
//   name / hint                  i18n keys (board.*)
//   length / width / thickness   m (mesh, the nose / tail sample points, how high it floats)
//   outline                      plan shape: widest (fraction of the length from the tail), nose (0 pointed
//                                .. 1 full round), tailW (half width at the tail end, fraction of the
//                                widest), tail: square | squash |
//                                round | pin | swallow
//   rocker                       m the nose / tail lift above the middle
//   fins                         single | twin | thruster | quad
//   pad / stringer               a traction pad on the tail / a wooden stringer down the middle
//   buoyancy                     0..1: how high the board floats with you on it
//   paddleSpeed                  m/s top paddling speed (Shift: x paddleBoost)
//   turnRate                     rad/s cap of the carve
//   maxSpeed                     m/s cap while riding
//   catchEase                    0..1: a wider take-off window (volume and length: longboards and soft tops)
//   stability                    0..1: how long it stays upright in whitewater, how little it is knocked about
//   bigWave                      0..1: holds a line on steep, big faces; gives up some speed in small ones
//   look                         the default colours of a new design (see BoardMaterial.js PATTERNS)
export const BOARDS = {
	softtop: {
		id: 'softtop', name: 'board.softtop', hint: 'board.softtopHint',
		length: 2.44, width: 0.58, thickness: 0.09,
		outline: { widest: 0.5, nose: 0.75, tailW: 0.62, tail: 'square' },
		rocker: { nose: 0.1, tail: 0.03 },
		fins: 'thruster', pad: false, stringer: false,
		buoyancy: 0.8, paddleSpeed: 2.0, paddleBoost: 1.45, turnRate: 1.35, maxSpeed: 8.5,
		catchEase: 0.85, stability: 0.9, bigWave: 0.05,
		look: { deck: 0x2f86c8, bottom: 0xf4f2ea, rail: 0x2f86c8, fin: 0x23323d, pattern: 'stripe', patternColor: 0xf8f6ef },
	},
	longboard: {
		id: 'longboard', name: 'board.longboard', hint: 'board.longboardHint',
		length: 2.8, width: 0.57, thickness: 0.075,
		outline: { widest: 0.52, nose: 0.95, tailW: 0.66, tail: 'square' },
		rocker: { nose: 0.09, tail: 0.04 },
		fins: 'single', pad: false, stringer: true,
		buoyancy: 0.75, paddleSpeed: 2.15, paddleBoost: 1.4, turnRate: 1.05, maxSpeed: 9,
		catchEase: 1, stability: 1, bigWave: 0.25,
		look: { deck: 0xf3ecd8, bottom: 0xf3ecd8, rail: 0xc8452f, fin: 0xc8452f, pattern: 'railFade', patternColor: 0xc8452f },
	},
	shortboard: {
		id: 'shortboard', name: 'board.shortboard', hint: 'board.shortboardHint',
		length: 1.83, width: 0.49, thickness: 0.062,
		outline: { widest: 0.54, nose: 0.15, tailW: 0.56, tail: 'squash' },
		rocker: { nose: 0.13, tail: 0.055 },
		fins: 'thruster', pad: true, stringer: true,
		buoyancy: 0.45, paddleSpeed: 1.65, paddleBoost: 1.5, turnRate: 2.3, maxSpeed: 11,
		catchEase: 0, stability: 0.45, bigWave: 0.5,
		look: { deck: 0xf7f7f4, bottom: 0xf7f7f4, rail: 0xf7f7f4, fin: 0x1b1d20, pattern: 'bands', patternColor: 0x1b1d20 },
	},
	fish: {
		id: 'fish', name: 'board.fish', hint: 'board.fishHint',
		length: 1.75, width: 0.54, thickness: 0.066,
		outline: { widest: 0.44, nose: 0.55, tailW: 0.84, tail: 'swallow' },
		rocker: { nose: 0.085, tail: 0.03 },
		fins: 'twin', pad: true, stringer: true,
		buoyancy: 0.6, paddleSpeed: 1.85, paddleBoost: 1.45, turnRate: 1.95, maxSpeed: 10.5,
		catchEase: 0.45, stability: 0.6, bigWave: 0.15,
		look: { deck: 0xf1d9a6, bottom: 0x2f8f8a, rail: 0x2f8f8a, fin: 0x7a4a28, pattern: 'gradient', patternColor: 0x2f8f8a },
	},
	gun: {
		id: 'gun', name: 'board.gun', hint: 'board.gunHint',
		length: 2.39, width: 0.5, thickness: 0.078,
		outline: { widest: 0.58, nose: 0.05, tailW: 0.16, tail: 'pin' },
		rocker: { nose: 0.12, tail: 0.075 },
		fins: 'thruster', pad: true, stringer: true,
		buoyancy: 0.6, paddleSpeed: 2.05, paddleBoost: 1.5, turnRate: 1.45, maxSpeed: 12.5,
		catchEase: 0.35, stability: 0.75, bigWave: 1,
		look: { deck: 0xf5f2ea, bottom: 0xe94e1b, rail: 0x1d2329, fin: 0x1d2329, pattern: 'stripe', patternColor: 0xe94e1b },
	},
};

// the look's pattern names (BoardMaterial.js) and where an imported picture goes
export const PATTERNS = [ 'none', 'stripe', 'gradient', 'railFade', 'bands' ];
export const DECAL_SIDES = [ 'off', 'deck', 'bottom' ];

export const BOARD_IDS = [ 'softtop', 'longboard', 'shortboard', 'fish', 'gun' ];

// a forgiving board to start on
export const DEFAULT_BOARD = BOARDS.softtop;

// legacy name (stage 3): the spec table
export const SurfboardSpec = BOARDS;

// 0..1 ratings for the library's bars (relative across the five boards)
export function boardRatings( spec ) {

	const r = ( v, a, b ) => Math.min( 1, Math.max( 0, ( v - a ) / ( b - a ) ) );
	return {
		speed: r( spec.maxSpeed, 8, 12.5 ),
		turning: r( spec.turnRate, 1, 2.3 ),
		paddling: r( spec.paddleSpeed, 1.6, 2.15 ),
		ease: Math.min( 1, spec.catchEase * 0.6 + spec.stability * 0.4 ),
		bigWaves: spec.bigWave,
	};

}
