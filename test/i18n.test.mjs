// Runtime behaviour of src/ui/i18n.js: default language, saved choice, English fallback with a warning.
// Each case imports a fresh copy of the module (query string) after setting up navigator / localStorage.
import assert from 'node:assert/strict';

const store = new Map();
Object.defineProperty( globalThis, 'localStorage', { configurable: true, value: {
	getItem: ( k ) => ( store.has( k ) ? store.get( k ) : null ),
	setItem: ( k, v ) => store.set( k, String( v ) ),
	removeItem: ( k ) => store.delete( k ),
} } );
const browser = ( languages ) => Object.defineProperty( globalThis, 'navigator', { configurable: true, value: { language: languages[ 0 ], languages } } );
let n = 0;
const fresh = () => import( `../src/ui/i18n.js?case=${ ++ n }` );
const ok = ( msg ) => console.log( 'ok   ' + msg );

// browser language picks the default when nothing is saved
browser( [ 'zh-TW', 'en' ] );
assert.equal( ( await fresh() ).getLanguage(), 'zh-CN' );
browser( [ 'zh' ] );
assert.equal( ( await fresh() ).getLanguage(), 'zh-CN' );
browser( [ 'de-DE', 'fr' ] );
assert.equal( ( await fresh() ).getLanguage(), 'en' );
browser( [ 'en-GB', 'zh-CN' ] );
assert.equal( ( await fresh() ).getLanguage(), 'en' );
ok( 'a Chinese browser defaults to zh-CN, other unsupported languages to English' );

// the choice is saved and wins over the browser language next time
{

	browser( [ 'zh-CN' ] );
	const i18n = await fresh();
	let heard = null;
	const off = i18n.onLanguageChange( ( code ) => { heard = code; } );
	assert.equal( i18n.setLanguage( 'ja' ), true );
	assert.equal( heard, 'ja' );
	assert.equal( store.get( i18n.STORAGE_KEY ), 'ja' );
	off();
	assert.equal( i18n.setLanguage( 'xx' ), false );
	assert.equal( store.get( i18n.STORAGE_KEY ), 'ja' );
	assert.equal( ( await fresh() ).getLanguage(), 'ja' );
	store.set( i18n.STORAGE_KEY, 'nonsense' );
	assert.equal( ( await fresh() ).getLanguage(), 'zh-CN' );
	ok( 'setLanguage saves to localStorage, notifies listeners and survives a reload; bad values are ignored' );

}

// translation, parameters, English fallback with a console warning
{

	store.clear();
	browser( [ 'zh-CN' ] );
	const i18n = await fresh();
	assert.equal( i18n.t( 'fish.mahi' ), '鲯鳅' );
	assert.equal( i18n.t( 'unit.kg', { v: '1.20' } ), '1.20 公斤' );
	assert.equal( i18n.t( 'prompt.talkTo', { name: '乔' } ), '与乔交谈' );
	assert.equal( i18n.phrase( 'Wind speed' ), '风速' );
	assert.equal( i18n.phrase( 'Reset Wind speed' ), '重置风速' );
	assert.equal( i18n.phrase( 'E' ), 'E', 'key caps are not translated as compass points' );
	assert.equal( i18n.phrase( '12.5 m/s' ), '12.5 m/s' );

	const warnings = [];
	const warn = console.warn;
	console.warn = ( m ) => warnings.push( String( m ) );
	const zh = i18n.locales[ 'zh-CN' ];
	const saved = zh[ 'hud.sonar' ];
	delete zh[ 'hud.sonar' ];
	try {

		assert.equal( i18n.t( 'hud.sonar' ), 'Sonar' );
		assert.equal( i18n.t( 'hud.sonar' ), 'Sonar' );
		assert.equal( i18n.t( 'no.such.key' ), 'no.such.key' );

	} finally {

		zh[ 'hud.sonar' ] = saved;
		console.warn = warn;

	}

	assert.equal( warnings.length, 2, 'one warning per missing key' );
	assert.match( warnings[ 0 ], /hud\.sonar.*zh-CN/ );
	assert.match( warnings[ 1 ], /no\.such\.key/ );
	i18n.setLanguage( 'en' );
	assert.equal( i18n.t( 'fish.mahi' ), 'Mahi-mahi' );
	ok( 't() fills parameters, phrase() maps English source text, missing keys fall back to English with one warning' );

}
