import { MAX_IMAGE_CHARS } from './BoardStore.js';

// A picture for the board, from a local file (file picker or drag and drop): checked, decoded and
// scaled in this browser, never uploaded.
//
//   const r = await importImageFile( file )
//   r: { ok: true, url, width, height } (a WebP data URL, longest side <= 1024 px, ready for BoardStore)
//      { ok: false, error: 'type' | 'size' | 'decode' | 'tooBig' }
export const IMAGE_TYPES = [ 'image/png', 'image/jpeg', 'image/webp' ];
export const MAX_FILE_MB = 15;
export const MAX_SIDE = 1024;

const EXT = /\.(png|jpe?g|webp)$/i;

export function imageFileError( file ) {

	if ( ! file ) return 'decode';
	const typeOk = IMAGE_TYPES.includes( file.type ) || ( ! file.type && EXT.test( file.name || '' ) );
	if ( ! typeOk ) return 'type';
	if ( file.size > MAX_FILE_MB * 1024 * 1024 ) return 'size';
	return null;

}

async function decode( file ) {

	if ( typeof createImageBitmap === 'function' ) {

		try {

			return await createImageBitmap( file );

		} catch ( e ) { /* fall through to <img> */ }

	}

	const url = URL.createObjectURL( file );
	try {

		const im = new Image();
		im.src = url;
		await im.decode();
		return im;

	} finally {

		URL.revokeObjectURL( url );

	}

}

export async function importImageFile( file ) {

	const err = imageFileError( file );
	if ( err ) return { ok: false, error: err };
	let src;
	try {

		src = await decode( file );

	} catch ( e ) {

		return { ok: false, error: 'decode' };

	}

	const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
	if ( ! ( w0 > 0 && h0 > 0 ) ) return { ok: false, error: 'decode' };
	// smaller and smaller until the data URL fits the store's limit
	for ( const [ side, q ] of [ [ MAX_SIDE, 0.9 ], [ MAX_SIDE, 0.75 ], [ 768, 0.75 ], [ 512, 0.7 ] ] ) {

		const k = Math.min( 1, side / Math.max( w0, h0 ) );
		const w = Math.max( 1, Math.round( w0 * k ) ), h = Math.max( 1, Math.round( h0 * k ) );
		const c = document.createElement( 'canvas' );
		c.width = w;
		c.height = h;
		const g = c.getContext( '2d' );
		g.imageSmoothingQuality = 'high';
		g.drawImage( src, 0, 0, w, h );
		let url = c.toDataURL( 'image/webp', q );
		// no WebP encoder: PNG keeps transparency (bigger)
		if ( ! url.startsWith( 'data:image/webp' ) ) url = c.toDataURL( 'image/png' );
		if ( url.length <= MAX_IMAGE_CHARS * 0.9 ) {

			if ( src.close ) src.close();
			return { ok: true, url, width: w, height: h };

		}

	}

	if ( src.close ) src.close();
	return { ok: false, error: 'tooBig' };

}
