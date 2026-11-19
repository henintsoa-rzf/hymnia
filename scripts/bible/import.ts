/**
 * Import of the Louis Segond 1910 Bible (specs/015-bible-verse-search, research R1–R3):
 * download the eBible.org `fraLSG` USFM archive (kept in import/cache/, never committed), parse
 * it, validate it, and write content/bible/lsg1910.json and content/bible/source.json.
 * Running it again on the same archive writes the same files (idempotent).
 *
 * Usage: npm run bible [-- --offline]   (--offline: use the cached archive only)
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { BibleDataSchema, BibleSourceSchema, type BibleData } from '../../src/lib/bible/schema';
import { parseUsfmBooks } from './usfm';
import { readZip } from './zip';

export const SOURCE = {
	translation: 'lsg1910',
	name: 'Louis Segond 1910',
	rights: 'public-domain',
	edition: 'eBible.org fraLSG',
	url: 'https://ebible.org/Scriptures/fraLSG_usfm.zip'
} as const;

const CACHE_DIR = 'import/cache/bible/fraLSG';
const ARCHIVE = join(CACHE_DIR, 'fraLSG_usfm.zip');
const FETCHED_AT = join(CACHE_DIR, 'retrieved-at.txt');
const OUT_DIR = 'content/bible';

const today = () => new Date().toISOString().slice(0, 10);

async function archive(offline: boolean): Promise<{ bytes: Uint8Array; retrievedAt: string }> {
	if (existsSync(ARCHIVE)) {
		const retrievedAt = existsSync(FETCHED_AT)
			? (await readFile(FETCHED_AT, 'utf8')).trim()
			: today();
		return { bytes: new Uint8Array(await readFile(ARCHIVE)), retrievedAt };
	}
	if (offline) throw new Error(`--offline: no archive at ${ARCHIVE}`);
	console.log(`Downloading ${SOURCE.url}…`);
	const response = await fetch(SOURCE.url);
	if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
	const bytes = new Uint8Array(await response.arrayBuffer());
	await mkdir(CACHE_DIR, { recursive: true });
	await writeFile(ARCHIVE, bytes);
	await writeFile(FETCHED_AT, today() + '\n');
	return { bytes, retrievedAt: today() };
}

/** One chapter per line: small diffs when the source changes, readable in review. */
export function formatBible(data: BibleData): string {
	const books = data.books.map((book) => {
		const chapters = book.chapters.map((verses) => `\t\t\t\t${JSON.stringify(verses)}`);
		return `\t\t{\n\t\t\t"code": ${JSON.stringify(book.code)},\n\t\t\t"chapters": [\n${chapters.join(',\n')}\n\t\t\t]\n\t\t}`;
	});
	return (
		`{\n\t"translation": ${JSON.stringify(data.translation)},\n\t"name": ${JSON.stringify(data.name)},\n` +
		`\t"books": [\n${books.join(',\n')}\n\t]\n}\n`
	);
}

async function main() {
	const offline = process.argv.includes('--offline');
	const { bytes, retrievedAt } = await archive(offline);
	const files = [...readZip(bytes)]
		.filter(([name]) => name.endsWith('.usfm'))
		.map(([name, data]) => ({ name, text: new TextDecoder().decode(data) }));
	const { books, dropped, skipped } = parseUsfmBooks(files);

	const data: BibleData = { translation: SOURCE.translation, name: SOURCE.name, books };
	const checked = BibleDataSchema.safeParse(data);
	if (!checked.success) {
		for (const issue of checked.error.issues.slice(0, 20)) console.error(`✗ ${issue.message}`);
		process.exit(1);
	}

	const verses = books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.length, 0), 0);
	const chapters = books.reduce((n, b) => n + b.chapters.length, 0);
	const source = BibleSourceSchema.parse({
		...SOURCE,
		retrievedAt,
		sha256: createHash('sha256').update(bytes).digest('hex'),
		dropped,
		skipped,
		verses
	});

	const json = formatBible(data);
	await mkdir(OUT_DIR, { recursive: true });
	await writeFile(join(OUT_DIR, 'lsg1910.json'), json);
	await writeFile(join(OUT_DIR, 'source.json'), JSON.stringify(source, null, '\t') + '\n');

	const compact = JSON.stringify(data);
	const mb = (n: number) => (n / 1024 / 1024).toFixed(2);
	console.log(
		`✓ ${SOURCE.name}: ${books.length} books, ${chapters} chapters, ${verses} verses` +
			` — ${mb(compact.length)} MB raw, ${mb(gzipSync(compact).length)} MB gzip`
	);
	console.log(`  dropped: ${dropped.join(' ')}`);
	if (skipped.length) console.log(`  skipped books: ${skipped.join(' ')}`);
	console.log(`  written to ${OUT_DIR}/lsg1910.json and ${OUT_DIR}/source.json`);
}

if (process.argv[1]?.endsWith('import.ts')) await main();
