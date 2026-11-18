// FR-015 and US4 scenario 4: devices never mix two builds or two configurations.
import { describe, expect, it } from 'vitest';
import { loadMeaningData, writeRowMap } from '../../src/lib/meaning/load';
import { createQueryCache } from '../../src/lib/meaning/query-cache';
import { MemoryStorage } from '../helpers/memory-storage';

const catalog = { hymns: [{ sections: [1, 2] }, { sections: [1] }] };
const meta = (rows: number) => ({
	configId: 'c',
	dims: 4,
	rows,
	vectors: 'v',
	rowMap: 'r',
	bytes: rows * 12
});
const buffer = (bytes: Uint8Array) => bytes.slice().buffer;

describe('loadMeaningData', () => {
	it('loads rows that fit the catalog', () => {
		const rowMap = writeRowMap([
			{ hymnIndex: 0, section: 1, scale: 0.5 },
			{ hymnIndex: 1, section: 0, scale: 0.25 }
		]);
		const data = loadMeaningData(meta(2), new ArrayBuffer(8), buffer(rowMap), catalog);
		expect(Array.from(data.hymnIndex)).toEqual([0, 1]);
		expect(Array.from(data.scale)).toEqual([0.5, 0.25]);
	});

	it('refuses a row count that differs from the manifest', () => {
		const rowMap = writeRowMap([{ hymnIndex: 0, section: 0, scale: 1 }]);
		expect(() => loadMeaningData(meta(2), new ArrayBuffer(8), buffer(rowMap), catalog)).toThrow();
		expect(() => loadMeaningData(meta(1), new ArrayBuffer(8), buffer(rowMap), catalog)).toThrow();
	});

	it('refuses a hymn or section the catalog does not have', () => {
		const badHymn = writeRowMap([{ hymnIndex: 2, section: 0, scale: 1 }]);
		expect(() => loadMeaningData(meta(1), new ArrayBuffer(4), buffer(badHymn), catalog)).toThrow(
			/catalog/
		);
		const badSection = writeRowMap([{ hymnIndex: 1, section: 1, scale: 1 }]);
		expect(() => loadMeaningData(meta(1), new ArrayBuffer(4), buffer(badSection), catalog)).toThrow(
			/catalog/
		);
	});
});

describe('query cache across configurations', () => {
	it('drops the vectors of an old configId', () => {
		const storage = new MemoryStorage();
		createQueryCache({ storage, configId: 'te3-large/stanza/512/i8/v1' }).put(
			'grâce',
			Float32Array.of(1)
		);
		const next = createQueryCache({ storage, configId: 'te3-large/title+stanza/512/i8/v2' });
		expect(next.get('grâce')).toBeUndefined();
		next.put('paix', Float32Array.of(1));
		expect(JSON.parse(storage.getItem('hymnia.meaning.queries')!).items).toHaveLength(1);
	});
});
