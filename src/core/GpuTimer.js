import { GPU } from '../engine/gpu/GPU.js';

// GPU time of a whole frame, for adaptive resolution (core/Quality.js). Needs 'timestamp-query'; without
// it `ms` stays null and the caller falls back to frame times.
//
// Every `every`-th frame the render / compute passes recorded on GPU.encoder get timestamp writes (the
// encoder's begin*Pass is wrapped, as in core/Bench.js; passes that already write timestamps for the
// profiler or the bench are left alone). The frame's GPU time is the last pass end minus the first
// pass begin, read back asynchronously a frame or two later. Sampling a few frames a second keeps the
// cost out of sight.
const MAX = 256;

export class GpuTimer {

	constructor( { every = 10 } = {} ) {

		this.enabled = GPU.hasTimestamp;
		this.every = every;
		this.ms = null; // smoothed GPU ms per frame
		this.last = null; // the latest sample
		this._n = 0;
		this._arm = false;
		this._count = 0;
		if ( ! this.enabled ) return;
		const d = GPU.device;
		this.querySet = d.createQuerySet( { label: 'frame timer', type: 'timestamp', count: MAX * 2 } );
		this.resolve = d.createBuffer( { label: 'frame timer resolve', size: MAX * 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC } );
		this.ring = [ 0, 1, 2 ].map( () => ( { buffer: d.createBuffer( { label: 'frame timer read', size: MAX * 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST } ), busy: false } ) );
		this._wrap();

	}

	_wrap() {

		const self = this;
		const proto = GPUCommandEncoder.prototype;
		const rp = proto.beginRenderPass, cp = proto.beginComputePass;
		const tag = ( enc, desc ) => {

			if ( ! self._arm || enc !== GPU.encoder || self._count >= MAX || ( desc && desc.timestampWrites ) ) return desc;
			const i = self._count ++;
			return { ...( desc || {} ), timestampWrites: { querySet: self.querySet, beginningOfPassWriteIndex: i * 2, endOfPassWriteIndex: i * 2 + 1 } };

		};

		proto.beginRenderPass = function ( desc ) {

			return rp.call( this, tag( this, desc ) );

		};

		proto.beginComputePass = function ( desc ) {

			return cp.call( this, tag( this, desc ) );

		};

	}

	// call at the start of a frame (before any pass is recorded)
	beginFrame() {

		if ( ! this.enabled ) return;
		this._arm = ++ this._n % this.every === 0 && this.ring.some( ( s ) => ! s.busy );
		this._count = 0;

	}

	// call right before the frame's GPU.submit()
	endFrame() {

		if ( ! this._arm ) return;
		this._arm = false;
		const n = this._count;
		const slot = this.ring.find( ( s ) => ! s.busy );
		if ( ! n || ! slot || ! GPU.encoder ) return;
		slot.busy = true;
		GPU.encoder.resolveQuerySet( this.querySet, 0, n * 2, this.resolve, 0 );
		GPU.encoder.copyBufferToBuffer( this.resolve, 0, slot.buffer, 0, n * 16 );
		GPU.onSubmit( null, () => {

			slot.buffer.mapAsync( GPUMapMode.READ ).then( () => {

				const t = new BigInt64Array( slot.buffer.getMappedRange(), 0, n * 2 );
				let first = null, last = null;
				for ( let i = 0; i < n; i ++ ) {

					const a = t[ i * 2 ], b = t[ i * 2 + 1 ];
					if ( b <= 0n || b < a ) continue;
					if ( first === null || a < first ) first = a;
					if ( last === null || b > last ) last = b;

				}

				slot.buffer.unmap();
				slot.busy = false;
				if ( first === null ) return;
				const ms = Number( last - first ) / 1e6;
				if ( ! ( ms > 0 && ms < 1000 ) ) return;
				this.last = ms;
				this.ms = this.ms === null ? ms : this.ms + ( ms - this.ms ) * 0.3;

			} ).catch( () => {

				slot.busy = false;

			} );

		} );

	}

}
