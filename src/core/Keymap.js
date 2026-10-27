// The key registry: every keyboard key and mouse control the game listens to, in one list. The help
// sheet (F1) is generated from it, and test/keymap.test.mjs fails when code reads a key that is not
// registered here. Policy: new features do not get a letter key of their own; they go into a wheel
// (R: the equipment wheel, see core/Equipment.js and ui/RadialWheel.js) or the settings panel (H).
//
//   id       stable name, used by code: pressed( input, 'flashlight' ), codesOf( 'help' )
//   section  'move' | 'actions' | 'interface' (the help sheet's columns)
//   codes    KeyboardEvent.code values (mouse controls have none)
//   caps     key caps shown in the help (default: from codes); 'WASD' and 'Mouse' render as glyphs
//   label    i18n key of the action; sub: i18n key of the small second line (optional)
//   option   only listed (and active) while this gameplay option is on (core/Options.js)

export const KEYMAP = [
	{ id: 'move', section: 'move', codes: [ 'KeyW', 'KeyA', 'KeyS', 'KeyD' ], caps: [ 'WASD' ], label: 'keys.move', sub: 'keys.moveSub' },
	{ id: 'look', section: 'move', caps: [ 'Mouse' ], label: 'keys.look', sub: 'keys.lookSub' },
	{ id: 'sprint', section: 'move', codes: [ 'ShiftLeft', 'ShiftRight' ], caps: [ 'Shift' ], label: 'keys.sprint' },
	{ id: 'up', section: 'move', codes: [ 'Space' ], label: 'keys.up' },
	{ id: 'down', section: 'move', codes: [ 'KeyC' ], label: 'keys.down' },

	{ id: 'interact', section: 'actions', codes: [ 'KeyE' ], label: 'keys.interact', sub: 'keys.interactSub' },
	{ id: 'equipment', section: 'actions', codes: [ 'KeyR' ], label: 'keys.equipment', sub: 'keys.equipmentSub' },
	{ id: 'use', section: 'actions', caps: [ 'LMB' ], label: 'keys.use', sub: 'keys.useSub', option: 'fishing' },
	{ id: 'useAlt', section: 'actions', caps: [ 'RMB' ], label: 'keys.useAlt', option: 'fishing' },
	{ id: 'cooler', section: 'actions', codes: [ 'KeyI', 'Tab' ], label: 'keys.cooler', option: 'fishing' },
	{ id: 'boatCamera', section: 'actions', codes: [ 'KeyV' ], label: 'keys.boatCamera', sub: 'keys.boatCameraSub' },
	{ id: 'freeCamera', section: 'actions', codes: [ 'KeyF' ], label: 'keys.freeCamera', sub: 'keys.freeCameraSub' },
	{ id: 'time', section: 'actions', codes: [ 'KeyT' ], label: 'keys.time' },
	{ id: 'flashlight', section: 'actions', codes: [ 'KeyL' ], label: 'keys.flashlight' },
	{ id: 'mute', section: 'actions', codes: [ 'KeyM' ], label: 'keys.mute' },

	{ id: 'settings', section: 'interface', codes: [ 'KeyH' ], label: 'keys.settings', sub: 'keys.settingsSub' },
	{ id: 'photo', section: 'interface', codes: [ 'KeyP' ], label: 'keys.photo', sub: 'keys.photoSub' },
	{ id: 'help', section: 'interface', codes: [ 'F1' ], caps: [ 'F1', '?' ], label: 'keys.help' },
	{ id: 'back', section: 'interface', codes: [ 'Escape' ], caps: [ 'Esc' ], label: 'keys.back', sub: 'keys.backSub' },
];

export const SECTIONS = [ [ 'move', 'keys.sectionMove' ], [ 'actions', 'keys.sectionActions' ], [ 'interface', 'keys.sectionInterface' ] ];

// keys used only inside menus and dialogs (lists, sliders, the wheel, the guide): not game bindings
export const NAVIGATION_KEYS = [ 'Enter', 'NumpadEnter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown' ];

const byId = new Map( KEYMAP.map( ( k ) => [ k.id, k ] ) );

export function binding( id ) {

	const k = byId.get( id );
	if ( ! k ) throw new Error( `Keymap: no binding "${ id }"` );
	return k;

}

export const codesOf = ( id ) => binding( id ).codes || [];

// true once per press of any of the binding's keys
export const pressed = ( input, id ) => codesOf( id ).some( ( c ) => input.hit( c ) );

// keydown event → binding id (or null)
export function bindingOf( code ) {

	for ( const k of KEYMAP ) if ( k.codes && k.codes.includes( code ) ) return k.id;
	return null;

}

const CAP = { KeyW: 'W', ShiftLeft: 'Shift', ShiftRight: 'Shift', Escape: 'Esc' };
export function capsOf( id ) {

	const k = binding( id );
	if ( k.caps ) return k.caps;
	return [ ...new Set( k.codes.map( ( c ) => CAP[ c ] || c.replace( /^Key|^Digit/, '' ) ) ) ];

}
