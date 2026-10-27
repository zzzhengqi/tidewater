// What the player holds. Items live in a registry; the equipment wheel (R, ui/RadialWheel.js) lays out
// whatever is registered, so a new item (a paraglider, a camera…) is one registry.add() call:
//
//   app.equipment.registry.add( {
//     id: 'glider',
//     label: 'equip.glider',          // i18n key of the name
//     hint: 'equip.gliderHint',       // i18n key of the one-line hint under the name
//     icon: 'glider',                 // ui/icons.js name (or raw SVG markup)
//     order: 20,                      // position on the wheel, clockwise from the top
//     visible: () => true,            // false: not on the wheel at all (e.g. its gameplay option is off)
//     available: () => true,          // false: shown dimmed, can't be picked (e.g. not while swimming)
//     unavailableHint: 'equip.…',     // optional i18n key shown instead of the hint while unavailable
//     busy: () => false,              // true: can't be put away right now (e.g. a fish on the line)
//     equip: ( opts ) => {},          // take it out
//     unequip: ( opts ) => {},        // put it away ( opts.silent: no toast, e.g. forced by swimming )
//   } );
//
// Equipment.set( id ) always puts the current item away before taking the next one out, so exactly one
// item is held at any time. 'hands' (empty hands) is always registered and is the default.

export class ItemRegistry {

	constructor() {

		this.items = [];
		this._listeners = new Set();

	}

	add( item ) {

		if ( ! item || ! item.id ) throw new Error( 'ItemRegistry: an item needs an id' );
		if ( this.get( item.id ) ) throw new Error( `ItemRegistry: "${ item.id }" registered twice` );
		this.items.push( { order: 100, ...item } );
		this.items.sort( ( a, b ) => a.order - b.order );
		for ( const fn of this._listeners ) fn();
		return this;

	}

	remove( id ) {

		this.items = this.items.filter( ( i ) => i.id !== id );
		for ( const fn of this._listeners ) fn();

	}

	get( id ) {

		return this.items.find( ( i ) => i.id === id ) || null;

	}

	// items currently on the wheel, in order
	visible() {

		return this.items.filter( ( i ) => ! i.visible || i.visible() );

	}

	isAvailable( item ) {

		return !! item && ( ! item.visible || item.visible() ) && ( ! item.available || item.available() );

	}

	onChange( fn ) {

		this._listeners.add( fn );
		return () => this._listeners.delete( fn );

	}

}

export class Equipment {

	constructor( { defaultId = 'hands' } = {} ) {

		this.registry = new ItemRegistry();
		this.defaultId = defaultId;
		this.current = defaultId;
		this._listeners = new Set();
		this.registry.add( { id: 'hands', label: 'equip.hands', hint: 'equip.handsHint', icon: 'hand', order: 0, equip() {}, unequip() {} } );

	}

	get item() {

		return this.registry.get( this.current );

	}

	// the current item can't be put away (e.g. mid-fight)
	get busy() {

		const it = this.item;
		return !! ( it && it.busy && it.busy() );

	}

	// put the current item away, take `id` out. Returns false when nothing changed.
	set( id, opts = {} ) {

		if ( id === this.current ) return false;
		const next = this.registry.get( id );
		if ( ! next || ( ! opts.force && ! this.registry.isAvailable( next ) ) ) return false;
		const cur = this.item;
		if ( cur && cur.busy && cur.busy() && ! opts.force ) return false;
		if ( cur ) cur.unequip( opts );
		this.current = id;
		next.equip( opts );
		for ( const fn of [ ...this._listeners ] ) fn( id );
		return true;

	}

	is( id ) {

		return this.current === id;

	}

	// once per frame: an item that stopped being available (rod while swimming, option switched off)
	// is put away and the hands come back
	update() {

		const it = this.item;
		if ( this.current !== this.defaultId && ! this.registry.isAvailable( it ) ) this.set( this.defaultId, { silent: true, force: true } );

	}

	onChange( fn ) {

		this._listeners.add( fn );
		return () => this._listeners.delete( fn );

	}

}
