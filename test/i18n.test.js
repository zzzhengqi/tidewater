import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { translate } from '../src/ui/i18n.js';

const source = readFileSync( new URL( '../src/ui/AppUI.js', import.meta.url ), 'utf8' );
const labels = [ ...source.matchAll( /\b(?:label|tooltip):\s*'((?:\\.|[^'])*)'|\.addTab\(\s*'[^']+'\s*,\s*'([^']+)'|\.addFolder\(\s*'([^']+)'/g ) ]
	.map( ( match ) => ( match[ 1 ] || match[ 2 ] || match[ 3 ] ).replaceAll( "\\'", "'" ) );
labels.push( 'Calm', 'Breezy', 'Choppy', 'Storm', 'Settings', 'Settings sections', 'Language', 'Time of day', 'Off' );
for ( const language of [ 'zh-CN', 'ja', 'ko', 'ar' ] ) {
	const missing = labels.filter( ( label ) => translate( label, language ) === label );
	assert.deepEqual( missing, [], `${ language } untranslated settings copy` );
}
assert.equal( translate( 'Reset Wind speed' ), '重置风速' );
assert.equal( translate( 'Wind speed', 'en' ), 'Wind speed' );
console.log( `Settings translations checked: ${ new Set( labels ).size } phrases × 4 languages` );
