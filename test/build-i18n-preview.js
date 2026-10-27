import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

// Builds test/i18n.html: one self-contained file (open it straight from disk, no server, no WebGPU)
// with every screen of the interface in every language. Run after changing UI text:
//   npm run i18n:preview
// The 3D-only modules the HUD pulls in (fish portrait renderer, the stall / chandlery models) are
// replaced by stubs so the page stays small; the loader markup is copied from index.html.
const src = ( p ) => fileURLToPath( new URL( '../src/' + p, import.meta.url ) );
const constant = ( file, name ) => new RegExp( `export const ${ name } = (\\{[^}]*\\});` ).exec( readFileSync( src( file ), 'utf8' ) )[ 1 ];
const STUBS = {
	[ src( 'game/FishPortrait.js' ) ]: 'export class FishPortrait { attach() { return false; } show() {} detach() {} update() {} }',
	[ src( 'game/FishStand.js' ) ]: `export const STAND = ${ constant( 'game/FishStand.js', 'STAND' ) };`,
	[ src( 'game/Chandlery.js' ) ]: `export const CHANDLERY = ${ constant( 'game/Chandlery.js', 'CHANDLERY' ) };`,
};
const norm = ( p ) => p.replaceAll( '\\', '/' ).toLowerCase();
const stubs = new Map( Object.entries( STUBS ).map( ( [ k, v ] ) => [ norm( k ), v ] ) );

const out = await build( {
	configFile: false,
	logLevel: 'warn',
	build: { write: false, minify: true, target: 'esnext', rollupOptions: { input: fileURLToPath( new URL( './i18n-preview.js', import.meta.url ) ) } },
	plugins: [ { name: 'preview-stubs', enforce: 'pre', load: ( id ) => stubs.get( norm( id.split( '?' )[ 0 ] ) ) } ],
} );
const js = out.output.find( ( file ) => file.type === 'chunk' ).code;
const css = readFileSync( src( 'ui/ui.css' ), 'utf8' );
const index = readFileSync( new URL( '../index.html', import.meta.url ), 'utf8' );
const loader = /<div id="loader"[\s\S]*?\n\t<\/div>\n/.exec( index.replace( /\r\n/g, '\n' ) )[ 0 ].replace( /<img class="loader-art"[^>]*>/, '' );
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tidewater · i18n preview</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:linear-gradient(180deg,#6fa7d6 0%,#9cc9e8 45%,#1f8fa3 46%,#0c5f77 100%)}${ css }
.i18n-bar{position:fixed;left:8px;bottom:8px;z-index:100;display:flex;flex-wrap:wrap;gap:4px;max-width:min(760px,calc(100vw - 16px));padding:6px;border-radius:10px;background:rgba(8,14,22,.78);font:12px/1.2 system-ui,sans-serif}
.i18n-bar button{border:0;border-radius:6px;padding:4px 8px;background:rgba(170,215,235,.14);color:#eef6f8;cursor:pointer;font:inherit}
.i18n-bar button.is-on{background:#5fe3d4;color:#08141a}.i18n-bar hr{flex-basis:100%;height:0;margin:2px 0;border:0}.i18n-bar small{color:#ffb86b}</style></head>
<body>${ loader }<script type="module">${ js.replaceAll( '</script', '<\\/script' ) }</script></body></html>`;
writeFileSync( new URL( './i18n.html', import.meta.url ), html );
console.log( `Created test/i18n.html (standalone preview, ${ ( html.length / 1024 ).toFixed( 0 ) } KB)` );
