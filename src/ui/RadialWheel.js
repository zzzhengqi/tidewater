import { icon } from './icons.js';
import { t, onLanguageChange } from './i18n.js';

// A radial selection wheel over the game (the equipment wheel on R; another one, e.g. for cameras, is a
// second instance with its own registry). Items come from an ItemRegistry (core/Equipment.js) and are
// laid out clockwise from the top every time the wheel opens, so it shows exactly what is registered
// and visible.
//
//   const wheel = new RadialWheel( ui, {
//     title: 'wheel.equipment',            // i18n key shown above the item name
//     registry,                            // ItemRegistry
//     current: () => equipment.current,    // the item marked as held
//     onSelect: ( id ) => equipment.set( id ),
//     codes: [ 'KeyR' ],                   // tap: open; again while open: next item clockwise
//     closeCodes: [ 'KeyW', … ],           // movement keys: close without choosing
//     canOpen: () => true,                 // or an i18n key: refused, shown as a toast
//   } );
//
// While open: the mouse moves a virtual cursor (pointer lock stays on) that picks a sector, left click
// or Enter takes the highlighted item, Esc / right click / a movement key closes without a change.
// The wheel swallows the mouse and its own keys so the camera doesn't turn and the rod doesn't cast.

const VB = 200, R_OUT = 96, R_IN = 42, GAP = 1.6; // svg units; GAP in degrees between sectors
const DEAD = 0.2; // virtual cursor dead zone (fraction of the outer radius)

const rad = ( d ) => d * Math.PI / 180;
const pt = ( r, deg ) => [ ( VB / 2 + r * Math.cos( rad( deg ) ) ).toFixed( 2 ), ( VB / 2 + r * Math.sin( rad( deg ) ) ).toFixed( 2 ) ];

function sectorPath( a0, a1 ) {

	if ( a1 - a0 >= 359.9 ) {

		// a whole ring: two half arcs each way
		const [ ox, oy ] = pt( R_OUT, - 90 ), [ px, py ] = pt( R_OUT, 90 ), [ ix, iy ] = pt( R_IN, - 90 ), [ qx, qy ] = pt( R_IN, 90 );
		return `M${ ox } ${ oy }A${ R_OUT } ${ R_OUT } 0 1 1 ${ px } ${ py }A${ R_OUT } ${ R_OUT } 0 1 1 ${ ox } ${ oy }Z`
			+ `M${ ix } ${ iy }A${ R_IN } ${ R_IN } 0 1 0 ${ qx } ${ qy }A${ R_IN } ${ R_IN } 0 1 0 ${ ix } ${ iy }Z`;

	}

	const large = a1 - a0 > 180 ? 1 : 0;
	const [ x0, y0 ] = pt( R_OUT, a0 ), [ x1, y1 ] = pt( R_OUT, a1 ), [ x2, y2 ] = pt( R_IN, a1 ), [ x3, y3 ] = pt( R_IN, a0 );
	return `M${ x0 } ${ y0 }A${ R_OUT } ${ R_OUT } 0 ${ large } 1 ${ x1 } ${ y1 }L${ x2 } ${ y2 }A${ R_IN } ${ R_IN } 0 ${ large } 0 ${ x3 } ${ y3 }Z`;

}

const isTyping = ( el ) => !! el && ( el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test( el.tagName ) );

export class RadialWheel {

	constructor( ui, { title, registry, current, onSelect, codes, closeCodes = [], canOpen = () => true } ) {

		this.ui = ui;
		this.title = title;
		this.registry = registry;
		this.current = current;
		this.onSelect = onSelect;
		this.codes = codes;
		this.closeCodes = closeCodes;
		this.canOpen = canOpen;
		this.isOpen = false;
		this.items = [];
		this.hot = - 1;
		this.cursor = { x: 0, y: 0 };

		this.el = document.createElement( 'div' );
		this.el.className = 'tw-wheel';
		this.el.setAttribute( 'aria-hidden', 'true' );
		this.el.innerHTML = `<div class="tw-wheel-dial" role="listbox">
			<svg class="tw-wheel-ring" viewBox="0 0 ${ VB } ${ VB }"></svg>
			<div class="tw-wheel-icons"></div>
			<div class="tw-wheel-center"><span class="tw-wheel-title"></span><b class="tw-wheel-name"></b><span class="tw-wheel-hint"></span></div>
			<span class="tw-wheel-cursor"></span>
		</div><div class="tw-wheel-keys"></div>`;
		this.dial = this.el.querySelector( '.tw-wheel-dial' );
		this.svg = this.el.querySelector( 'svg' );
		this.iconsEl = this.el.querySelector( '.tw-wheel-icons' );
		this.titleEl = this.el.querySelector( '.tw-wheel-title' );
		this.nameEl = this.el.querySelector( '.tw-wheel-name' );
		this.hintEl = this.el.querySelector( '.tw-wheel-hint' );
		this.keysEl = this.el.querySelector( '.tw-wheel-keys' );
		this.cursorEl = this.el.querySelector( '.tw-wheel-cursor' );
		( ui.root || document.body ).append( this.el );

		this._ac = new AbortController();
		const opts = { capture: true, signal: this._ac.signal };
		window.addEventListener( 'keydown', ( e ) => this._onKey( e ), opts );
		window.addEventListener( 'mousemove', ( e ) => this._onMove( e ), opts );
		window.addEventListener( 'mousedown', ( e ) => this._onDown( e ), opts );
		window.addEventListener( 'contextmenu', ( e ) => {

			if ( this.isOpen ) e.preventDefault();

		}, opts );
		document.addEventListener( 'pointerlockchange', () => {

			if ( this.isOpen && ! document.pointerLockElement && this._lockedAtOpen ) this.close();

		}, { signal: this._ac.signal } );
		this._offLanguage = onLanguageChange( () => {

			if ( this.isOpen ) this._paintText();

		} );

	}

	open() {

		if ( this.isOpen ) return true;
		const ok = this.canOpen();
		if ( ok !== true ) {

			if ( typeof ok === 'string' && this.ui.toast ) this.ui.toast( t( ok ), 1800 );
			return false;

		}

		this.items = this.registry.visible();
		if ( ! this.items.length ) return false;
		const cur = this.items.findIndex( ( i ) => i.id === this.current() );
		this.hot = cur >= 0 ? cur : 0;
		this.cursor.x = this.cursor.y = 0;
		this._lockedAtOpen = !! document.pointerLockElement;
		this._build();
		this.isOpen = true;
		this.el.classList.add( 'is-on' );
		this._paint();
		return true;

	}

	// confirm: pick the highlighted item
	close( confirm = false ) {

		if ( ! this.isOpen ) return;
		this.isOpen = false;
		this.el.classList.remove( 'is-on' );
		const it = this.items[ this.hot ];
		if ( confirm && it && this.registry.isAvailable( it ) && it.id !== this.current() ) this.onSelect( it.id );

	}

	// next available item clockwise
	next() {

		const n = this.items.length;
		for ( let k = 1; k <= n; k ++ ) {

			const j = ( this.hot + k ) % n;
			if ( this.registry.isAvailable( this.items[ j ] ) ) {

				this.hot = j;
				break;

			}

		}

		this._paint();

	}

	_build() {

		const n = this.items.length, span = 360 / n;
		let paths = '', icons = '';
		this.items.forEach( ( it, i ) => {

			const mid = - 90 + i * span;
			const g = n > 1 ? GAP / 2 : 0;
			paths += `<path class="tw-wheel-sector" data-i="${ i }" d="${ sectorPath( mid - span / 2 + g, mid + span / 2 - g ) }"/>`;
			const [ x, y ] = pt( ( R_OUT + R_IN ) / 2, n > 1 ? mid : - 90 );
			icons += `<span class="tw-wheel-item" data-i="${ i }" style="left:${ ( x / VB * 100 ).toFixed( 2 ) }%;top:${ ( y / VB * 100 ).toFixed( 2 ) }%">${ icon( it.icon ) }<i></i></span>`;

		} );
		this.svg.innerHTML = `<circle class="tw-wheel-hub" cx="${ VB / 2 }" cy="${ VB / 2 }" r="${ R_IN - 4 }"/>${ paths }`;
		this.iconsEl.innerHTML = icons;
		this._sectors = [ ...this.svg.querySelectorAll( '.tw-wheel-sector' ) ];
		this._icons = [ ...this.iconsEl.querySelectorAll( '.tw-wheel-item' ) ];

	}

	_paint() {

		const cur = this.current();
		this.items.forEach( ( it, i ) => {

			const off = ! this.registry.isAvailable( it );
			for ( const el of [ this._sectors[ i ], this._icons[ i ] ] ) {

				el.classList.toggle( 'is-hot', i === this.hot );
				el.classList.toggle( 'is-current', it.id === cur );
				el.classList.toggle( 'is-off', off );

			}

		} );
		this._paintText();
		this.cursorEl.style.transform = `translate(calc(-50% + ${ this.cursor.x.toFixed( 1 ) }px), calc(-50% + ${ this.cursor.y.toFixed( 1 ) }px))`;

	}

	_paintText() {

		const it = this.items[ this.hot ];
		this.titleEl.textContent = t( this.title );
		this.nameEl.textContent = it ? t( it.label ) : '';
		const off = it && ! this.registry.isAvailable( it );
		this.hintEl.textContent = ! it ? '' : off ? t( it.unavailableHint || 'wheel.unavailable' ) : it.id === this.current() ? t( 'wheel.equipped' ) : t( it.hint );
		this.keysEl.innerHTML = t( 'wheel.controls' );

	}

	_onKey( e ) {

		if ( e.ctrlKey || e.metaKey || e.altKey || isTyping( e.target ) ) return;
		if ( ! this.isOpen ) {

			if ( this.codes.includes( e.code ) && ! e.repeat && this.open() ) {

				e.preventDefault();
				e.stopImmediatePropagation();

			}

			return;

		}

		if ( this.codes.includes( e.code ) ) {

			if ( ! e.repeat ) this.next();

		} else if ( e.code === 'Enter' || e.code === 'NumpadEnter' ) {

			this.close( true );

		} else if ( e.code === 'Escape' ) {

			this.close();

		} else if ( this.closeCodes.includes( e.code ) ) {

			this.close();
			return; // the movement key goes on to the game

		} else return;

		e.preventDefault();
		e.stopImmediatePropagation();

	}

	_onMove( e ) {

		if ( ! this.isOpen ) return;
		e.stopImmediatePropagation(); // the camera doesn't turn while choosing
		const box = this.dial.getBoundingClientRect();
		const R = box.width / 2;
		if ( document.pointerLockElement ) {

			this.cursor.x += e.movementX;
			this.cursor.y += e.movementY;

		} else {

			this.cursor.x = e.clientX - ( box.left + R );
			this.cursor.y = e.clientY - ( box.top + R );

		}

		const d = Math.hypot( this.cursor.x, this.cursor.y );
		if ( d > R ) {

			this.cursor.x *= R / d;
			this.cursor.y *= R / d;

		}

		if ( d > R * DEAD ) {

			const n = this.items.length;
			const a = ( Math.atan2( this.cursor.y, this.cursor.x ) * 180 / Math.PI + 90 + 360 + 180 / n ) % 360;
			const i = Math.floor( a / ( 360 / n ) ) % n;
			if ( this.registry.isAvailable( this.items[ i ] ) ) this.hot = i;

		}

		this._paint();

	}

	_onDown( e ) {

		if ( ! this.isOpen ) return;
		e.preventDefault();
		e.stopImmediatePropagation();
		this.close( e.button === 0 );

	}

	dispose() {

		this._ac.abort();
		this._offLanguage();
		this.el.remove();

	}

}
