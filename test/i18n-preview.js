import { UI } from '../src/ui/UI.js';

// Uses the real settings components without starting the WebGPU simulation.
const ui = new UI();
const sea = { wind: 7, clarity: 1, time: 12, advance: true, camera: 'third', bloom: 0.08, shadows: true };
const ocean = ui.addTab( 'ocean', 'Ocean', 'ocean' );
const conditions = ocean.addFolder( 'Sea state', { icon: 'wind' } );
conditions.addPresets( { label: 'Conditions', active: 'Breezy', presets: [ 'Calm', 'Breezy', 'Choppy', 'Storm' ].map( ( label ) => ( { label } ) ) } );
conditions.addSlider( { label: 'Wind speed', object: sea, key: 'wind', min: 0.5, max: 30, step: 0.1, unit: 'm/s', tooltip: 'Wind 10 m above the sea. Drives the local wind waves, whitecaps and spray.' } );
ocean.addFolder( 'Water', { icon: 'droplet' } ).addSlider( { label: 'Clarity', object: sea, key: 'clarity', min: 0.3, max: 2, step: 0.01 } );
ui.addTab( 'shore', 'Shore', 'shore' ).addFolder( 'Surf', { icon: 'wave' } ).addSlider( { label: 'Wave height', object: { wave: 0.5 }, key: 'wave', min: 0, max: 1.4, step: 0.01, unit: 'm' } );
const sky = ui.addTab( 'sky', 'Sky', 'sky' );
const sun = sky.addFolder( 'Sun', { icon: 'clock' } );
sun.addTimeOfDay( { object: sea, key: 'time' } );
sun.addToggle( { label: 'Advance time', object: sea, key: 'advance' } );
const camera = ui.addTab( 'camera', 'Camera', 'camera' );
camera.addFolder( 'View', { icon: 'camera' } ).addSelect( { label: 'Boat camera', object: sea, key: 'camera', options: [ { label: '1st person', value: 'first' }, { label: '3rd person', value: 'third' } ] } );
ui.addTab( 'effects', 'Effects', 'effects' ).addFolder( 'Post-processing', { icon: 'sparkles' } ).addSlider( { label: 'Bloom', object: sea, key: 'bloom', min: 0, max: 0.3, step: 0.005 } );
ui.addTab( 'performance', 'Performance', 'performance' ).addFolder( 'Quality', { icon: 'layers' } ).addToggle( { label: 'Shadows', object: sea, key: 'shadows' } );
ui.togglePanel( true );
