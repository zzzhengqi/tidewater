import { t } from '../ui/i18n.js';

// Display text for the fishing game: names come from the locale (fish.<id>, gear.<track>.<level>,
// vendor.<id>.*), the English ones in FishTable / Gear / the vendors stay as data. Units go through
// unit.* so Chinese reads 公斤 / 厘米.
export const fishName = ( id ) => t( 'fish.' + id );
export const gearName = ( key ) => t( 'gear.' + key );
export const gearLabel = ( key, level ) => t( `gear.${ key }.${ level | 0 }` );
export const kg = ( v, digits = 2 ) => t( 'unit.kg', { v: v.toFixed( digits ) } );
export const cm = ( v ) => t( 'unit.cm', { v: Math.round( v ) } );
export const metres = ( v, digits = 0 ) => t( 'unit.m', { v: v.toFixed( digits ) } );
export const litres = ( v ) => t( 'unit.l', { v: v.toFixed( 0 ) } );
export const money = ( v ) => '$' + v.toLocaleString();

// a vendor's name / short name / greeting / idle line ( field: 'name' | 'short' | 'greeting' | 'idle' )
export function vendorText( v, field ) {

	if ( v && v.id ) return t( `vendor.${ v.id }.${ field }` );
	const fallback = { name: 'stand.fishBuyer', short: 'stand.fishBuyer', greeting: 'stand.greeting', idle: 'stand.idle' }[ field ];
	return fallback ? t( fallback ) : '';

}
