import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { parseUsfmBooks } from '../../scripts/bible/usfm';
import { readZip } from '../../scripts/bible/zip';

const dir = fileURLToPath(new URL('../fixtures/bible', import.meta.url));
const files = readdirSync(dir)
	.filter((f) => f.endsWith('.usfm'))
	.map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));
const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'));

const book = (body: string, id = 'GEN') => [{ name: 'x.usfm', text: `\\id ${id} test\n${body}` }];

describe('parseUsfmBooks', () => {
	it('keeps book, chapter, verse and text only (research R2)', () => {
		const { books } = parseUsfmBooks(files);
		expect(books).toEqual(expected.books);
	});

	it('drops notes, cross-references, introductions, headings and parallel references', () => {
		const text = JSON.stringify(parseUsfmBooks(files).books);
		for (const gone of ['Job 38:4', 'une note', 'INTRODUCTION', 'Création du monde', '2 S 15']) {
			expect(text).not.toContain(gone);
		}
		expect(text).not.toContain('\\');
		expect(text).not.toContain('strong');
		expect(text).toContain('— Pause.');
	});

	it('lists the markers it dropped', () => {
		const { dropped } = parseUsfmBooks(files);
		for (const marker of ['\\x', '\\f', '\\s1', '\\r', '\\ip', '\\imt1', '\\ms1', '\\mr']) {
			expect(dropped).toContain(marker);
		}
		expect(dropped).toEqual([...dropped].sort());
	});

	it('gives NFC text with single spaces', () => {
		const { books } = parseUsfmBooks(book('\\c 1\n\\p\n\\v 1 Éternel   bon  \n'));
		expect(books[0].chapters[0][0]).toBe('Éternel bon');
		expect(books[0].chapters[0][0]).toBe(books[0].chapters[0][0].normalize('NFC'));
	});

	it('names the place of a verse gap, a duplicate, an empty verse', () => {
		expect(() => parseUsfmBooks(book('\\c 1\n\\v 1 a\n\\v 3 b\n'))).toThrow(/GEN 1:3/);
		expect(() => parseUsfmBooks(book('\\c 1\n\\v 1 a\n\\v 1 b\n'))).toThrow(/GEN 1:1/);
		expect(() => parseUsfmBooks(book('\\c 1\n\\v 1 a\n\\v 2 \\x a \\xt Ps 1.\\x*\n'))).toThrow(
			/GEN 1:2/
		);
		expect(() => parseUsfmBooks(book('\\c 1\n\\v 1 a\n\\c 3\n\\v 1 b\n'))).toThrow(/GEN 3/);
	});

	it('refuses an unknown book code', () => {
		expect(() => parseUsfmBooks(book('\\c 1\n\\v 1 a\n', 'XYZ'))).toThrow(/XYZ/);
	});

	it('sorts books in canonical order whatever the file order', () => {
		const { books } = parseUsfmBooks([...files].reverse());
		expect(books.map((b) => b.code)).toEqual(['GEN', 'PSA']);
	});
});

/** A tiny zip writer for the test: stored or deflated entries, no data descriptors. */
function makeZip(entries: { name: string; data: Uint8Array; deflate: boolean }[]): Uint8Array {
	const chunks: Buffer[] = [];
	const central: Buffer[] = [];
	let offset = 0;
	for (const e of entries) {
		const name = Buffer.from(e.name);
		const body = e.deflate ? deflateRawSync(e.data) : Buffer.from(e.data);
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(e.deflate ? 8 : 0, 8);
		local.writeUInt32LE(body.length, 18);
		local.writeUInt32LE(e.data.length, 22);
		local.writeUInt16LE(name.length, 26);
		const head = Buffer.alloc(46);
		head.writeUInt32LE(0x02014b50, 0);
		head.writeUInt16LE(e.deflate ? 8 : 0, 10);
		head.writeUInt32LE(body.length, 20);
		head.writeUInt32LE(e.data.length, 24);
		head.writeUInt16LE(name.length, 28);
		head.writeUInt32LE(offset, 42);
		chunks.push(local, name, body);
		central.push(head, name);
		offset += 30 + name.length + body.length;
	}
	const centralBytes = Buffer.concat(central);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(centralBytes.length, 12);
	end.writeUInt32LE(offset, 16);
	return new Uint8Array(Buffer.concat([...chunks, centralBytes, end]));
}

describe('readZip', () => {
	it('reads stored and deflated entries', () => {
		const zip = makeZip(
			files.map((f, i) => ({ name: f.name, data: Buffer.from(f.text), deflate: i === 0 }))
		);
		const read = readZip(zip);
		expect([...read.keys()].sort()).toEqual(files.map((f) => f.name).sort());
		for (const f of files) expect(Buffer.from(read.get(f.name)!).toString('utf8')).toBe(f.text);
	});

	it('refuses something that is not a zip', () => {
		expect(() => readZip(new Uint8Array(100))).toThrow(/zip/i);
	});
});
