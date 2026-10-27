// Surfboard shapes as data. One board for now (a forgiving 7'6" funboard); the next stage adds more
// specs here and lets the player pick one. Everything the surfing model and the board mesh read
// about a board comes from its spec.
//
//   length / width / thickness   m (mesh, the nose / tail sample points, how high it floats)
//   buoyancy                     0..1: how much of the board rides above the water while paddling
//   paddleSpeed                  m/s top paddling speed (Shift: x paddleBoost)
//   turnRate                     rad/s of carve at full A / D on a steep face (less on flat water / slow)
//   maxSpeed                     m/s cap while riding
export const SurfboardSpec = {
	funboard: {
		id: 'funboard',
		length: 2.29,
		width: 0.56,
		thickness: 0.075,
		buoyancy: 0.6,
		paddleSpeed: 1.9,
		paddleBoost: 1.45,
		turnRate: 1.6,
		maxSpeed: 9.5,
		colors: { deck: 0xf3efe2, rail: 0x2f8fb5, stripe: 0xff8a3d, fin: 0x1f2a30 },
	},
};

export const DEFAULT_BOARD = SurfboardSpec.funboard;
