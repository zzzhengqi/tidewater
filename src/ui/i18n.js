import en from './locales/en.js';
import zhCN from './locales/zh-CN.js';
import ja from './locales/ja.js';
import ko from './locales/ko.js';
import ar from './locales/ar.js';

// UI language. Every user-visible string lives in ui/locales/<code>.js under a key (en.js is the
// source: a key is added there first, then to every other locale; npm run i18n:check enforces it).
//
//   t( key, params )   the current language's string, {name} placeholders filled from params.
//                      A key missing in the current language falls back to English with a console warning.
//   phrase( english )  translates an English source string that is itself a value in en.js (the settings
//                      panel is built from English labels in AppUI.js, mode / prompt / loader text arrives
//                      in English). Unknown text is returned unchanged.
//   setLanguage( code ), getLanguage(), onLanguageChange( fn ) -> unsubscribe
//
// The choice is saved in localStorage; without one the browser language picks (any zh-* → zh-CN), else English.

export const languages = [
	[ 'en', 'English' ], [ 'zh-CN', '简体中文' ], [ 'ja', '日本語' ], [ 'ko', '한국어' ], [ 'ar', 'العربية' ],
];

export const locales = { en, 'zh-CN': zhCN, ja, ko, ar };
export const STORAGE_KEY = 'tidewater.ui.language';

const isSupported = ( code ) => Object.prototype.hasOwnProperty.call( locales, code );

// first supported language in the browser's preference list
export function detectLanguage( preferred = [] ) {

	for ( const tag of preferred ) {

		const s = String( tag || '' ).toLowerCase();
		if ( s.startsWith( 'zh' ) ) return 'zh-CN';
		const base = s.split( '-' )[ 0 ];
		const hit = languages.find( ( [ code ] ) => code.toLowerCase() === s || code.toLowerCase() === base );
		if ( hit ) return hit[ 0 ];

	}

	return 'en';

}

function initialLanguage() {

	try {

		const saved = globalThis.localStorage?.getItem( STORAGE_KEY );
		if ( saved && isSupported( saved ) ) return saved;

	} catch { /* storage blocked */ }

	const nav = globalThis.navigator;
	return detectLanguage( nav ? ( nav.languages?.length ? nav.languages : [ nav.language ] ) : [] );

}

let current = initialLanguage();
const listeners = new Set();
const warned = new Set();

function warnOnce( id, message ) {

	if ( warned.has( id ) ) return;
	warned.add( id );
	console.warn( message );

}

function format( s, params ) {

	return params ? s.replace( /\{(\w+)\}/g, ( m, k ) => ( k in params ? String( params[ k ] ) : m ) ) : s;

}

export function t( key, params ) {

	let s = locales[ current ][ key ];
	if ( s == null || s === '' ) {

		s = en[ key ];
		if ( s == null ) {

			warnOnce( 'en:' + key, `[i18n] unknown key "${ key }"` );
			return key;

		}

		if ( current !== 'en' ) warnOnce( current + ':' + key, `[i18n] "${ key }" is missing in ${ current }, showing English` );

	}

	return format( s, params );

}

// English value → key (first key wins when two keys share a value). Only these namespaces are looked up
// by English text, so short strings elsewhere ('E' as a compass point, 'Fish', 'Next') never replace
// a key cap or a number in the panel.
export const PHRASE_NAMESPACES = [ 'language', 'ui', 'settings', 'options', 'phase', 'mode', 'prompt', 'toast', 'loader', 'error' ];

// the English source of a key (for components built from English labels, like the settings panel)
export const english = ( key ) => en[ key ] ?? key;
let reverse = null;

export function keyOf( english ) {

	if ( ! reverse ) {

		reverse = new Map();
		for ( const [ k, v ] of Object.entries( en ) ) {

			if ( PHRASE_NAMESPACES.includes( k.split( '.' )[ 0 ] ) && ! reverse.has( v ) ) reverse.set( v, k );

		}

	}

	return reverse.get( english );

}

export function phrase( text ) {

	if ( text == null || text === '' ) return text;
	const key = keyOf( text );
	if ( key ) return t( key );
	const reset = /^Reset (.+)$/.exec( text ); // reset buttons: "Reset <label>"
	if ( reset && keyOf( reset[ 1 ] ) ) return t( 'ui.resetNamed', { name: phrase( reset[ 1 ] ) } );
	return text;

}

export function getLanguage() {

	return current;

}

export function setLanguage( code ) {

	if ( ! isSupported( code ) ) return false;
	try {

		globalThis.localStorage?.setItem( STORAGE_KEY, code );

	} catch { /* storage blocked: the choice lasts for this visit */ }

	if ( code === current ) return true;
	current = code;
	applyDocumentLanguage();
	for ( const fn of [ ...listeners ] ) {

		try {

			fn( code );

		} catch ( e ) {

			console.error( e );

		}

	}

	return true;

}

export function onLanguageChange( fn ) {

	listeners.add( fn );
	return () => listeners.delete( fn );

}

// <html lang>, and static markup tagged data-i18n="key" (innerHTML) / data-i18n-attr="attr:key;attr:key"
export function localizeStatic( root = globalThis.document ) {

	if ( ! root || ! root.querySelectorAll ) return;
	for ( const el of root.querySelectorAll( '[data-i18n]' ) ) el.innerHTML = t( el.dataset.i18n );
	for ( const el of root.querySelectorAll( '[data-i18n-attr]' ) ) {

		for ( const pair of el.dataset.i18nAttr.split( ';' ) ) {

			const [ attr, key ] = pair.split( ':' ).map( ( x ) => x.trim() );
			if ( attr && key ) el.setAttribute( attr, t( key ) );

		}

	}

}

function applyDocumentLanguage() {

	const doc = globalThis.document;
	if ( ! doc ) return;
	doc.documentElement.lang = current;
	localizeStatic( doc );

}

applyDocumentLanguage();
