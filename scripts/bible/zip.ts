/**
 * Minimal zip reader for the Bible import (specs/015-bible-verse-search, plan.md): reads the
 * central directory and returns every file entry, stored (method 0) or deflated (method 8). No
 * zip64, no encryption: the eBible archives need neither.
 */
import { inflateRawSync } from 'node:zlib';

const END_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

export function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	// The end record is in the last 22 + 65,535 bytes (its comment is at most 64 KB).
	let end = -1;
	for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
		if (view.getUint32(i, true) === END_SIGNATURE) {
			end = i;
			break;
		}
	}
	if (end < 0) throw new Error('Not a zip archive: no end of central directory record');

	const count = view.getUint16(end + 10, true);
	let at = view.getUint32(end + 16, true);
	const files = new Map<string, Uint8Array>();
	const decoder = new TextDecoder();

	for (let n = 0; n < count; n++) {
		if (view.getUint32(at, true) !== CENTRAL_SIGNATURE) {
			throw new Error(`Bad zip archive: central directory entry ${n} not found`);
		}
		const method = view.getUint16(at + 10, true);
		const compressedSize = view.getUint32(at + 20, true);
		const size = view.getUint32(at + 24, true);
		const nameLength = view.getUint16(at + 28, true);
		const extraLength = view.getUint16(at + 30, true);
		const commentLength = view.getUint16(at + 32, true);
		const localOffset = view.getUint32(at + 42, true);
		const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
		at += 46 + nameLength + extraLength + commentLength;
		if (name.endsWith('/')) continue; // folder

		if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) {
			throw new Error(`Bad zip archive: local header of ${name} not found`);
		}
		const localName = view.getUint16(localOffset + 26, true);
		const localExtra = view.getUint16(localOffset + 28, true);
		const start = localOffset + 30 + localName + localExtra;
		const body = bytes.subarray(start, start + compressedSize);

		let data: Uint8Array;
		if (method === 0) data = body.slice();
		else if (method === 8) data = new Uint8Array(inflateRawSync(body));
		else throw new Error(`Unsupported zip compression method ${method} for ${name}`);
		if (data.length !== size) throw new Error(`Bad zip archive: ${name} has the wrong size`);
		files.set(name, data);
	}
	return files;
}
