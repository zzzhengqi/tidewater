// Gameplay options: on / off switches for the optional parts of the game, shown in the settings panel
// (H → Gameplay → Gameplay options, built by ui/AppUI.js from this list) and saved in localStorage.
//
//   Options.define( { id, label, tip, value } )  label / tip are i18n keys (options.*), value the default
//   Options.get( id ) -> boolean, Options.set( id, v ), Options.list(), Options.onChange( fn( id, v ) ) -> off
//
// Adding a switch (e.g. a surfing mode) is one define() call here plus its options.* strings in every
// locale; code reads it with Options.get( 'surfing' ) and listens with Options.onChange.

const KEY = 'tidewater.options';
const defs = [];
const listeners = new Set();
let saved = {};
try {

	saved = JSON.parse( globalThis.localStorage?.getItem( KEY ) || '{}' ) || {};

} catch { /* storage blocked: defaults */ }

const values = {};

export const Options = {

	define( { id, label, tip = null, value = true } ) {

		if ( defs.some( ( d ) => d.id === id ) ) throw new Error( `Options: "${ id }" defined twice` );
		defs.push( { id, label, tip, value } );
		values[ id ] = typeof saved[ id ] === 'boolean' ? saved[ id ] : value;

	},

	get( id ) {

		return values[ id ] ?? false;

	},

	set( id, v ) {

		v = !! v;
		if ( ! ( id in values ) || values[ id ] === v ) return;
		values[ id ] = v;
		try {

			globalThis.localStorage?.setItem( KEY, JSON.stringify( values ) );

		} catch { /* storage blocked: lasts for this visit */ }

		for ( const fn of [ ...listeners ] ) fn( id, v );

	},

	list() {

		return defs.slice();

	},

	onChange( fn ) {

		listeners.add( fn );
		return () => listeners.delete( fn );

	},

};

Options.define( { id: 'fishing', label: 'options.fishing', tip: 'options.fishingTip', value: true } );
Options.define( { id: 'surfing', label: 'options.surfing', tip: 'options.surfingTip', value: true } );
Options.define( { id: 'surfHud', label: 'options.surfHud', tip: 'options.surfHudTip', value: false } );
Options.define( { id: 'minimap', label: 'options.minimap', tip: 'options.minimapTip', value: true } );
Options.define( { id: 'lightHud', label: 'options.lightHud', tip: 'options.lightHudTip', value: false } );
Options.define( { id: 'guide', label: 'options.guide', tip: 'options.guideTip', value: true } );
