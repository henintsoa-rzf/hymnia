/**
 * Deterministic stand-in for the embeddings API (tests and e2e; never the network). Each word is
 * hashed into a 3,072-dim bag of words, then L2-normalised: texts that share words get close
 * vectors, which is enough to test the plumbing, not the quality.
 */
import { FULL_DIMS } from '../../src/lib/meaning/config';
import { tokenize } from '../../src/lib/search/normalize';

const SEED = 0x9e3779b9;

function hash(word: string, seed: number): number {
	let h = seed >>> 0;
	for (let i = 0; i < word.length; i++) {
		h ^= word.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h;
}

export function fakeEmbedOne(text: string): Float32Array {
	const v = new Float32Array(FULL_DIMS);
	for (const word of tokenize(text)) {
		// Two slots per word, with a sign, to keep unrelated words close to orthogonal.
		for (const seed of [SEED, SEED ^ 0x5bd1e995]) {
			const h = hash(word, seed);
			v[h % FULL_DIMS] += h & 0x80000000 ? -1 : 1;
		}
	}
	let norm = 0;
	for (const x of v) norm += x * x;
	norm = Math.sqrt(norm) || 1;
	for (let i = 0; i < v.length; i++) v[i] /= norm;
	return v;
}

export async function fakeEmbed(texts: string[]): Promise<Float32Array[]> {
	return texts.map(fakeEmbedOne);
}
