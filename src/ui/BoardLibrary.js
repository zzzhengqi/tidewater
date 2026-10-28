import { t, onLanguageChange } from './i18n.js';
import { icon } from './icons.js';
import { BOARDS, BOARD_IDS, PATTERNS, boardRatings } from '../surf/SurfboardSpec.js';
import { BoardPreview } from '../surf/BoardPreview.js';
import { importImageFile, MAX_FILE_MB } from '../surf/BoardImage.js';

// The board library: pick a board type, colour it, put a picture on it, keep several designs.
// Opened from the surfboard's button on the equipment wheel (R) or Settings → Gameplay; no key of its
// own. Left: the five board types (name, what it is good at, rating bars) and the saved designs (new,
// rename, delete, export / import as JSON). Right: a live 3D view of the board (drag to turn) and the
// look: colours, pattern, picture (file picker or drop; zoom, turn, move, mirror, deck or bottom).
//
// Everything edits the current design in surf/BoardStore.js (saved as it changes) and is applied to the
// board in the game straight away through Surfing.applyDesign(): the preview and the game board share
// geometry and material, so what you see here is what you ride.
const COLORS = [ [ 'deck', 'board.deck' ], [ 'bottom', 'board.bottom' ], [ 'rail', 'board.rail' ], [ 'fin', 'board.fin' ] ];
const PATTERN_KEYS = { none: 'board.patNone', stripe: 'board.patStripe', gradient: 'board.patGradient', railFade: 'board.patRailFade', bands: 'board.patBands' };
const STATS = [ [ 'speed', 'board.statSpeed' ], [ 'turning', 'board.statTurn' ], [ 'paddling', 'board.statPaddle' ], [ 'ease', 'board.statEase' ], [ 'bigWaves', 'board.statBig' ] ];
const ERRORS = {
	type: 'board.errType', size: 'board.errSize', decode: 'board.errDecode', tooBig: 'board.errTooBig', image: 'board.errDecode',
	quota: 'board.errQuota', unavailable: 'board.errStorage', badJson: 'board.errJson', badFormat: 'board.errJson',
};

const h = ( tag, cls, attrs = {} ) => {

	const el = document.createElement( tag );
	if ( cls ) el.className = cls;
	for ( const k in attrs ) {

		if ( k === 'text' ) el.textContent = attrs[ k ];
		else el.setAttribute( k, attrs[ k ] );

	}

	return el;

};

export class BoardLibrary {

	constructor( app, ui ) {

		this.app = app;
		this.ui = ui;
		this.surf = app.surf;
		this.store = app.surf.store;
		this.preview = new BoardPreview( app.surf.look );
		this.isOpen = false;
		this.el = null;
		this._delArm = null;
		this._offLang = onLanguageChange( () => {

			if ( this.isOpen ) this._render();

		} );

	}

	// ---- open / close

	open() {

		if ( this.isOpen ) return;
		if ( ! this.el ) this._build();
		this.isOpen = true;
		if ( document.pointerLockElement ) document.exitPointerLock?.();
		this._inputWas = this.app.input.enabled;
		this.app.input.enabled = false;
		this.el.hidden = false;
		void this.el.offsetWidth;
		this.el.classList.add( 'is-on' );
		this._render();
		this.preview.auto = true;
		this.preview.attach( this.canvas );
		this._closeBtn.focus( { preventScroll: true } );

	}

	close() {

		if ( ! this.isOpen ) return;
		this.isOpen = false;
		this.el.classList.remove( 'is-on' );
		this.el.hidden = true;
		this.preview.detach();
		this.app.input.enabled = this._inputWas !== false;
		this._status( '' );

	}

	// per frame (inside the frame: the preview records GPU passes)
	update( dt ) {

		if ( this.isOpen ) this.preview.update( dt );

	}

	// ---- DOM

	_build() {

		const el = this.el = h( 'div', 'tw-boards', { role: 'dialog', 'aria-modal': 'true' } );
		el.hidden = true;
		el.innerHTML = `<div class="tw-boards-card tw-glass">
			<header class="tw-boards-head"><span class="tw-boards-icon">${ icon( 'surfboard' ) }</span><div><h2 data-t="board.library"></h2><p data-t="board.libraryHint"></p></div><button class="tw-boards-x" type="button">${ icon( 'close' ) }</button></header>
			<div class="tw-boards-body">
				<aside class="tw-boards-side">
					<h3 data-t="board.types"></h3><div class="tw-boards-types" role="listbox"></div>
					<h3 data-t="board.designs"></h3><div class="tw-boards-designs" role="listbox"></div>
					<div class="tw-boards-row"><button type="button" data-act="new" data-t="board.new"></button><button type="button" data-act="rename" data-t="board.rename"></button><button type="button" data-act="delete" data-t="board.delete"></button></div>
					<div class="tw-boards-row"><button type="button" data-act="export" data-t="board.export"></button><button type="button" data-act="import" data-t="board.import"></button></div>
				</aside>
				<section class="tw-boards-main">
					<div class="tw-boards-stage"><canvas></canvas><span class="tw-boards-drop" data-t="board.dropHere"></span><span class="tw-boards-drag" data-t="board.dragHint"></span><button type="button" class="tw-boards-flip" data-t="board.flip"></button></div>
					<div class="tw-boards-edit">
						<div class="tw-boards-colors"></div>
						<label class="tw-boards-field"><span data-t="board.pattern"></span><select data-k="pattern"></select></label>
						<label class="tw-boards-field tw-boards-swatch"><span data-t="board.patternColor"></span><input type="color" data-look="patternColor"></label>
						<div class="tw-boards-pic">
							<div class="tw-boards-row"><button type="button" data-act="pick" data-t="board.pickImage"></button><button type="button" data-act="unpick" data-t="board.removeImage"></button></div>
							<label class="tw-boards-field"><span data-t="board.imageSide"></span><select data-k="side"></select></label>
							<label class="tw-boards-field"><span data-t="board.zoom"></span><input type="range" data-d="scale" min="1" max="4" step="0.01"><output></output></label>
							<label class="tw-boards-field"><span data-t="board.rotate"></span><input type="range" data-d="rot" min="-180" max="180" step="1"><output></output></label>
							<label class="tw-boards-field"><span data-t="board.moveX"></span><input type="range" data-d="x" min="-1" max="1" step="0.01"><output></output></label>
							<label class="tw-boards-field"><span data-t="board.moveY"></span><input type="range" data-d="y" min="-1" max="1" step="0.01"><output></output></label>
							<label class="tw-boards-check"><input type="checkbox" data-d="mirror"><span data-t="board.mirror"></span></label>
							<p class="tw-boards-note" data-t="board.localOnly"></p>
						</div>
					</div>
				</section>
			</div>
			<footer class="tw-boards-status" aria-live="polite"></footer>
			<input type="file" class="tw-boards-file" accept="image/png,image/jpeg,image/webp" hidden>
			<input type="file" class="tw-boards-json" accept=".json,application/json" hidden>
		</div>`;
		const q = ( s ) => el.querySelector( s );
		this.card = q( '.tw-boards-card' );
		this.typesEl = q( '.tw-boards-types' );
		this.designsEl = q( '.tw-boards-designs' );
		this.colorsEl = q( '.tw-boards-colors' );
		this.canvas = q( 'canvas' );
		this.stage = q( '.tw-boards-stage' );
		this.statusEl = q( '.tw-boards-status' );
		this.fileIn = q( '.tw-boards-file' );
		this.jsonIn = q( '.tw-boards-json' );
		this._closeBtn = q( '.tw-boards-x' );
		for ( const [ k ] of COLORS ) {

			const f = h( 'label', 'tw-boards-field tw-boards-swatch' );
			f.append( h( 'span', '', { 'data-t': COLORS.find( ( c ) => c[ 0 ] === k )[ 1 ] } ), h( 'input', '', { type: 'color', 'data-look': k } ) );
			this.colorsEl.append( f );

		}

		( this.ui.root || document.body ).append( el );
		this._wire();

	}

	_wire() {

		const el = this.el;
		this._closeBtn.addEventListener( 'click', () => this.close() );
		el.addEventListener( 'mousedown', ( e ) => {

			if ( e.target === el ) this.close();

		} );
		el.addEventListener( 'keydown', ( e ) => {

			if ( e.code === 'Escape' ) {

				e.preventDefault();
				this.close();

			}

			e.stopPropagation(); // typing a name is not playing

		} );
		el.addEventListener( 'keyup', ( e ) => e.stopPropagation() );
		this.typesEl.addEventListener( 'click', ( e ) => {

			const b = e.target.closest( '[data-board]' );
			if ( b ) this._edit( { board: b.dataset.board } );

		} );
		this.designsEl.addEventListener( 'click', ( e ) => {

			const b = e.target.closest( '[data-id]' );
			if ( ! b || e.target.closest( 'input' ) ) return;
			this._report( this.store.select( b.dataset.id ) );
			this._changed( { image: true } );

		} );
		el.querySelector( '.tw-boards-body' ).addEventListener( 'click', ( e ) => {

			const b = e.target.closest( '[data-act]' );
			if ( b ) this._act( b.dataset.act );

		} );
		el.querySelector( '.tw-boards-flip' ).addEventListener( 'click', () => this.preview.flip() );
		el.addEventListener( 'input', ( e ) => {

			const x = e.target;
			if ( x.dataset.look ) this._edit( { look: { [ x.dataset.look ]: x.value } }, false );
			else if ( x.dataset.d ) this._edit( { decal: { [ x.dataset.d ]: x.type === 'checkbox' ? x.checked : Number( x.value ) } }, false );

		} );
		el.addEventListener( 'change', ( e ) => {

			const x = e.target;
			if ( x.dataset.k === 'pattern' ) this._edit( { look: { pattern: x.value } } );
			else if ( x.dataset.k === 'side' ) this._edit( { decal: { side: x.value } } );
			else if ( x.dataset.d === 'mirror' ) this._edit( { decal: { mirror: x.checked } } );

		} );
		this.fileIn.addEventListener( 'change', () => {

			const f = this.fileIn.files && this.fileIn.files[ 0 ];
			this.fileIn.value = '';
			if ( f ) this._image( f );

		} );
		this.jsonIn.addEventListener( 'change', async () => {

			const f = this.jsonIn.files && this.jsonIn.files[ 0 ];
			this.jsonIn.value = '';
			if ( ! f ) return;
			let text = '';
			try {

				text = f.size > 8 * 1024 * 1024 ? '' : await f.text();

			} catch ( err ) {

				text = '';

			}

			const r = this.store.importDesign( text );
			if ( r.ok ) {

				this._changed( { image: true } );
				this._status( t( 'board.imported', { name: this._name( r.design ) } ) );

			} else this._report( r );

		} );
		// drag a picture onto the panel
		const over = ( on ) => this.stage.classList.toggle( 'is-drop', on );
		this.card.addEventListener( 'dragover', ( e ) => {

			if ( ! e.dataTransfer || ! [ ...e.dataTransfer.types ].includes( 'Files' ) ) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = 'copy';
			over( true );

		} );
		this.card.addEventListener( 'dragleave', ( e ) => {

			if ( ! this.card.contains( e.relatedTarget ) ) over( false );

		} );
		this.card.addEventListener( 'drop', ( e ) => {

			e.preventDefault();
			over( false );
			const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[ 0 ];
			if ( f ) this._image( f );

		} );

	}

	// ---- actions

	get design() {

		return this.store.current;

	}

	_name( d ) {

		return d.name || t( BOARDS[ d.board ].name );

	}

	_edit( patch, rerender = true ) {

		this._report( this.store.update( this.design.id, patch ) );
		this._changed( { rerender } );

	}

	// the design changed: the board in the game (and the preview's mesh), then the panel
	_changed( { image = false, rerender = true } = {} ) {

		this.surf.applyDesign( { reloadImage: image } );
		const spec = BOARDS[ this.design.board ];
		if ( this.preview.spec !== spec ) this.preview.setGeometry( this.surf.geometry( spec ), spec );
		if ( rerender ) this._render();
		else this._outputs();

	}

	async _image( file ) {

		this._status( t( 'board.reading' ) );
		const r = await importImageFile( file );
		if ( ! r.ok ) return this._report( r );
		const w = this.store.setImage( this.design.id, r.url );
		if ( ! w.ok ) return this._report( w );
		if ( this.design.decal.side === 'off' ) this.store.update( this.design.id, { decal: { side: 'deck' } } );
		this._changed( { image: true } );
		this._status( t( 'board.imageReady', { w: r.width, h: r.height } ) );

	}

	_act( a ) {

		const d = this.design;
		if ( a !== 'delete' ) this._delArm = null;
		switch ( a ) {

			case 'new': {

				const r = this.store.create( d.board, t( 'board.designName', { n: this.store.designs.length + 1 } ) );
				this._report( r );
				this._changed( { image: true } );
				break;

			}

			case 'rename': this._rename(); break;
			case 'delete':
				if ( this._delArm !== d.id ) {

					this._delArm = d.id;
					this._status( t( 'board.deleteConfirm', { name: this._name( d ) } ) );
					this._render();
					return;

				}

				this._delArm = null;
				this._report( this.store.remove( d.id ) );
				this._changed( { image: true } );
				break;
			case 'export': {

				const json = this.store.exportDesign( d.id );
				if ( ! json ) return;
				const blob = new Blob( [ json ], { type: 'application/json' } );
				const a = h( 'a', '', { download: ( this._name( d ).replace( /[\\/:*?"<>|]+/g, '_' ) || 'board' ) + '.tidewater-board.json' } );
				a.href = URL.createObjectURL( blob );
				document.body.append( a );
				a.click();
				a.remove();
				setTimeout( () => URL.revokeObjectURL( a.href ), 2000 );
				this._status( t( 'board.exported' ) );
				break;

			}

			case 'import': this.jsonIn.click(); break;
			case 'pick': this.fileIn.click(); break;
			case 'unpick':
				this._report( this.store.setImage( d.id, null ) );
				this._changed( { image: true } );
				break;

		}

	}

	_rename() {

		const row = this.designsEl.querySelector( `[data-id="${ this.design.id }"]` );
		if ( ! row ) return;
		const name = row.querySelector( '.tw-boards-dname' );
		const input = h( 'input', 'tw-boards-name', { type: 'text', maxlength: '40', 'aria-label': t( 'board.rename' ) } );
		input.value = this.design.name || this._name( this.design );
		name.replaceWith( input );
		input.focus();
		input.select();
		let done = false;
		const finish = ( ok ) => {

			if ( done ) return;
			done = true;
			if ( ok ) this._report( this.store.rename( this.design.id, input.value ) );
			this._render();

		};

		input.addEventListener( 'keydown', ( e ) => {

			if ( e.code === 'Enter' ) finish( true );
			else if ( e.code === 'Escape' ) {

				e.stopPropagation();
				finish( false );

			}

		} );
		input.addEventListener( 'blur', () => finish( true ) );

	}

	_status( text, bad = false ) {

		if ( ! this.statusEl ) return;
		this.statusEl.textContent = text;
		this.statusEl.classList.toggle( 'is-bad', bad );

	}

	// a store / import result: nothing on success, the reason otherwise
	_report( r ) {

		if ( ! r || r.ok ) return;
		this._status( t( ERRORS[ r.error ] || 'board.errStorage', { mb: MAX_FILE_MB } ), true );

	}

	// ---- rendering

	_render() {

		const el = this.el, d = this.design;
		for ( const n of el.querySelectorAll( '[data-t]' ) ) n.textContent = t( n.dataset.t );
		this._closeBtn.setAttribute( 'aria-label', t( 'board.close' ) );
		// board types
		this.typesEl.innerHTML = '';
		for ( const id of BOARD_IDS ) {

			const sp = BOARDS[ id ], r = boardRatings( sp );
			const b = h( 'button', 'tw-boards-type' + ( d.board === id ? ' is-on' : '' ), { type: 'button', 'data-board': id, role: 'option', 'aria-selected': String( d.board === id ) } );
			const head = h( 'span', 'tw-boards-tname' );
			head.append( h( 'b', '', { text: t( sp.name ) } ), h( 'em', '', { text: `${ ( sp.length / 0.3048 ).toFixed( 0 ) }′${ Math.round( ( sp.length / 0.3048 % 1 ) * 12 ) }″ · ${ t( 'unit.m', { v: sp.length.toFixed( 2 ) } ) }` } ) );
			b.append( head, h( 'span', 'tw-boards-thint', { text: t( sp.hint ) } ) );
			const bars = h( 'span', 'tw-boards-bars' );
			for ( const [ k, key ] of STATS ) {

				const row = h( 'span', 'tw-boards-bar' );
				const meter = h( 'i' );
				meter.style.setProperty( '--v', r[ k ].toFixed( 2 ) );
				row.append( h( 'small', '', { text: t( key ) } ), meter );
				bars.append( row );

			}

			b.append( bars );
			this.typesEl.append( b );

		}

		// designs
		this.designsEl.innerHTML = '';
		for ( const x of this.store.designs ) {

			const b = h( 'div', 'tw-boards-design' + ( x.id === d.id ? ' is-on' : '' ), { 'data-id': x.id, role: 'option', tabindex: '0', 'aria-selected': String( x.id === d.id ) } );
			const sw = h( 'span', 'tw-boards-dot' );
			sw.style.background = `linear-gradient(135deg, ${ x.look.deck } 50%, ${ x.look.rail } 50%)`;
			b.append( sw, h( 'span', 'tw-boards-dname', { text: this._name( x ) } ), h( 'small', '', { text: t( BOARDS[ x.board ].name ) + ( x.image ? ' · ' + t( 'board.hasImage' ) : '' ) } ) );
			this.designsEl.append( b );

		}

		el.querySelector( '[data-act="delete"]' ).classList.toggle( 'is-armed', this._delArm === d.id );
		el.querySelector( '[data-act="delete"]' ).textContent = t( this._delArm === d.id ? 'board.deleteSure' : 'board.delete' );
		// look
		for ( const n of el.querySelectorAll( '[data-look]' ) ) n.value = d.look[ n.dataset.look ];
		const pat = el.querySelector( '[data-k="pattern"]' );
		pat.innerHTML = PATTERNS.map( ( p ) => `<option value="${ p }">${ t( PATTERN_KEYS[ p ] ) }</option>` ).join( '' );
		pat.value = d.look.pattern;
		const side = el.querySelector( '[data-k="side"]' );
		side.innerHTML = [ [ 'deck', 'board.sideDeck' ], [ 'bottom', 'board.sideBottom' ], [ 'off', 'board.sideOff' ] ].map( ( [ v, k ] ) => `<option value="${ v }">${ t( k ) }</option>` ).join( '' );
		side.value = d.decal.side;
		for ( const n of el.querySelectorAll( '[data-d]' ) ) {

			if ( n.type === 'checkbox' ) n.checked = !! d.decal[ n.dataset.d ];
			else n.value = d.decal[ n.dataset.d ];

		}

		el.querySelector( '.tw-boards-pic' ).classList.toggle( 'has-image', !! d.image );
		const spec = BOARDS[ d.board ];
		if ( this.preview.spec !== spec ) this.preview.setGeometry( this.surf.geometry( spec ), spec );
		this._outputs();

	}

	// the numbers next to the sliders
	_outputs() {

		const d = this.design.decal;
		const fmt = { scale: ( v ) => `${ Math.round( v * 100 ) }%`, rot: ( v ) => `${ Math.round( v ) }°`, x: ( v ) => `${ Math.round( v * 100 ) }`, y: ( v ) => `${ Math.round( v * 100 ) }` };
		for ( const n of this.el.querySelectorAll( 'input[type=range][data-d]' ) ) {

			const o = n.parentElement.querySelector( 'output' );
			if ( o ) o.textContent = fmt[ n.dataset.d ]( d[ n.dataset.d ] );

		}

	}

	dispose() {

		this._offLang();
		this.preview.detach();
		if ( this.el ) this.el.remove();

	}

}
