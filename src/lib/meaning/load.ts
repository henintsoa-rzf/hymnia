/**
 * Reading the meaning data files (contracts/meaning-data.md) and checking they fit the loaded
 * catalog (FR-015). Shared by the search worker and the tests.
 */
import type { MeaningManifest } from '../domain/schema';

export type RowInfo = { hymnIndex: number; section: number; scale: number };

/** Meaning data ready for ranking. */
export type MeaningData = {
	configId: string;
	dims: number;
	rows: number;
	vectors: Int8Array;
	hymnIndex: Uint16Array;
	section: Uint16Array;
	scale: Float32Array;
};

export const ROW_BYTES = 8;

export function writeRowMap(rows: RowInfo[]): Uint8Array {
	const bytes = new Uint8Array(rows.length * ROW_BYTES);
	const view = new DataView(bytes.buffer);
	rows.forEach((r, i) => {
		view.setUint16(i * ROW_BYTES, r.hymnIndex, true);
		view.setUint16(i * ROW_BYTES + 2, r.section, true);
		view.setFloat32(i * ROW_BYTES + 4, r.scale, true);
	});
	return bytes;
}

export function readRowMap(bytes: Uint8Array): RowInfo[] {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const rows: RowInfo[] = [];
	for (let o = 0; o + ROW_BYTES <= bytes.byteLength; o += ROW_BYTES) {
		rows.push({
			hymnIndex: view.getUint16(o, true),
			section: view.getUint16(o + 2, true),
			scale: view.getFloat32(o + 4, true)
		});
	}
	return rows;
}

/**
 * Checks the two files against the manifest and the catalog, and unpacks them. Throws when they
 * do not belong together, so the worker reports `failed` rather than ranking wrong hymns.
 */
export function loadMeaningData(
	meta: MeaningManifest,
	vectorBytes: ArrayBuffer,
	rowMapBytes: ArrayBuffer,
	catalog: { hymns: { sections: unknown[] }[] }
): MeaningData {
	const { rows, dims } = meta;
	if (vectorBytes.byteLength !== rows * dims) {
		throw new Error(`Meaning vectors: ${vectorBytes.byteLength} bytes, expected ${rows * dims}`);
	}
	if (rowMapBytes.byteLength !== rows * ROW_BYTES) {
		throw new Error(`Meaning rows: ${rowMapBytes.byteLength} bytes, expected ${rows * ROW_BYTES}`);
	}
	const view = new DataView(rowMapBytes);
	const hymnIndex = new Uint16Array(rows);
	const section = new Uint16Array(rows);
	const scale = new Float32Array(rows);
	for (let r = 0; r < rows; r++) {
		const o = r * ROW_BYTES;
		hymnIndex[r] = view.getUint16(o, true);
		section[r] = view.getUint16(o + 2, true);
		scale[r] = view.getFloat32(o + 4, true);
		const hymn = catalog.hymns[hymnIndex[r]];
		if (!hymn || section[r] >= hymn.sections.length) {
			throw new Error(`Meaning row ${r} does not fit the catalog`);
		}
	}
	return {
		configId: meta.configId,
		dims,
		rows,
		vectors: new Int8Array(vectorBytes),
		hymnIndex,
		section,
		scale
	};
}
