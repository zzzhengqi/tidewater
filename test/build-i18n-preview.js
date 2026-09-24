import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const out = await build( { configFile: false, build: { write: false, minify: true,
	rollupOptions: { input: fileURLToPath( new URL( './i18n-preview.js', import.meta.url ) ) } } } );
const js = out.output.find( ( file ) => file.type === 'chunk' ).code;
const css = readFileSync( new URL( '../src/ui/ui.css', import.meta.url ), 'utf8' );
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tidewater 设置语言预览</title><style>html,body{margin:0;min-height:100%;background:#102033}${ css }</style></head>
<body><script type="module">${ js.replaceAll( '</script', '<\\/script' ) }</script></body></html>`;
writeFileSync( new URL( './i18n.html', import.meta.url ), html );
console.log( 'Created test/i18n.html (standalone preview)' );
