import { describe, expect, it } from 'vitest';
import {
	cutAndNormalize,
	dotInt8,
	fromBase64,
	quantizeInt8,
	toBase64
} from '../../src/lib/meaning/vector';

function randomUnit(n: number, seed = 1): Float32Array {
	let s = seed;
	const v = new Float32Array(n);
	let norm = 0;
	for (let i = 0; i < n; i++) {
		s = (s * 1103515245 + 12345) % 2147483648;
		v[i] = s / 2147483648 - 0.5;
		norm += v[i] * v[i];
	}
	norm = Math.sqrt(norm);
	for (let i = 0; i < n; i++) v[i] /= norm;
	return v;
}

const dot = (a: Float32Array, b: Float32Array) => a.reduce((s, x, i) => s + x * b[i], 0);

describe('meaning vectors', () => {
	it('cuts to dims and re-normalises', () => {
		const v = randomUnit(3072);
		const cut = cutAndNormalize(v, 512);
		expect(cut.length).toBe(512);
		expect(Math.sqrt(dot(cut, cut))).toBeCloseTo(1, 5);
		// Same direction as the first 512 values.
		expect(cut[3] / cut[0]).toBeCloseTo(v[3] / v[0], 4);
	});

	it('quantises to int8 with scale = maxAbs / 127', () => {
		const v = randomUnit(512, 7);
		const { q, scale } = quantizeInt8(v);
		const maxAbs = Math.max(...Array.from(v, Math.abs));
		expect(scale).toBeCloseTo(maxAbs / 127, 7);
		const back = Float32Array.from(q, (x) => x * scale);
		const n = Math.sqrt(dot(back, back));
		expect(dot(back, v) / n).toBeGreaterThan(0.999);
	});

	it('dotInt8 * scale matches the float dot product', () => {
		const rows = [randomUnit(512, 3), randomUnit(512, 4)];
		const quantised = rows.map(quantizeInt8);
		const flat = new Int8Array(1024);
		flat.set(quantised[0].q, 0);
		flat.set(quantised[1].q, 512);
		const query = randomUnit(512, 9);
		for (const r of [0, 1]) {
			expect(dotInt8(query, flat, r, 512) * quantised[r].scale).toBeCloseTo(dot(query, rows[r]), 2);
		}
	});

	it('round-trips base64 (little-endian float32)', () => {
		const v = randomUnit(64, 5);
		const b64 = toBase64(v);
		expect(Array.from(fromBase64(b64))).toEqual(Array.from(v));
		// 1.0 little-endian is 00 00 80 3f.
		expect(toBase64(Float32Array.of(1))).toBe('AACAPw==');
	});
});
