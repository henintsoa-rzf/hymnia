/**
 * Vector helpers shared by the build, the search worker and the Cloudflare Worker (research R4,
 * R7). The same code cuts and normalises stanza and query vectors, so both are made the same way.
 * Pure typed-array code: no DOM, Node or Workers-only API.
 */

/** Keep the first `dims` values and scale to an L2 norm of 1. */
export function cutAndNormalize(v: ArrayLike<number>, dims: number): Float32Array {
	if (v.length < dims) throw new Error(`Vector has ${v.length} values, ${dims} needed`);
	const out = new Float32Array(dims);
	let sum = 0;
	for (let i = 0; i < dims; i++) {
		out[i] = v[i];
		sum += v[i] * v[i];
	}
	const norm = Math.sqrt(sum);
	if (norm === 0) return out;
	for (let i = 0; i < dims; i++) out[i] /= norm;
	return out;
}

/** Symmetric int8 quantisation: `v[i] ≈ q[i] * scale`, with `scale = maxAbs / 127`. */
export function quantizeInt8(v: Float32Array): { q: Int8Array; scale: number } {
	let maxAbs = 0;
	for (let i = 0; i < v.length; i++) maxAbs = Math.max(maxAbs, Math.abs(v[i]));
	// Stored as float32 in the row map: round it now so build and reader agree exactly.
	const scale = Math.fround(maxAbs / 127);
	const q = new Int8Array(v.length);
	if (scale === 0) return { q, scale };
	for (let i = 0; i < v.length; i++) q[i] = Math.max(-127, Math.min(127, Math.round(v[i] / scale)));
	return { q, scale };
}

/** Dot product of a float query with row `row` of a flat int8 matrix (multiply by its scale). */
export function dotInt8(query: Float32Array, rows: Int8Array, row: number, dims: number): number {
	const offset = row * dims;
	let sum = 0;
	for (let i = 0; i < dims; i++) sum += query[i] * rows[offset + i];
	return sum;
}

/** Float32 values as little-endian bytes, in base64. */
export function toBase64(v: Float32Array): string {
	const view = new DataView(new ArrayBuffer(v.length * 4));
	for (let i = 0; i < v.length; i++) view.setFloat32(i * 4, v[i], true);
	const bytes = new Uint8Array(view.buffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary);
}

/** Inverse of `toBase64`. */
export function fromBase64(b64: string): Float32Array {
	const binary = atob(b64);
	if (binary.length % 4 !== 0) throw new Error('Invalid vector: length is not a multiple of 4');
	const view = new DataView(new ArrayBuffer(binary.length));
	for (let i = 0; i < binary.length; i++) view.setUint8(i, binary.charCodeAt(i));
	const out = new Float32Array(binary.length / 4);
	for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true);
	return out;
}
