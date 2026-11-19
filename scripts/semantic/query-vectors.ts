/**
 * Query vectors of the meaning reference set (tests/queries/meaning-queries.json) for the
 * shipped configuration, so tests/queries/meaning.test.ts runs offline (task T049). The texts are
 * made exactly as the Worker makes them: cut to 500 code points, tidied, embedded, then cut to
 * the shipped dims and re-normalised.
 *
 * Feature 015: also the verse reference set (tests/queries/verse-queries.json), in both query
 * forms of research R4 (the verses' text, and the label first), from content/bible/. Verse texts
 * are never cut: each must fit in MAX_EMBED_CHARS.
 *
 * Usage: npx tsx scripts/semantic/query-vectors.ts   (needs MAMMOUTH_API_KEY, or a full cache)
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createBible } from '../../src/lib/bible/bible';
import { verseQueryText } from '../../src/lib/bible/query';
import { MAX_EMBED_CHARS, MEANING_CONFIG, configId, tidyQuery } from '../../src/lib/meaning/config';
import { cutQuery } from '../../src/lib/meaning/embed-client';
import { cutAndNormalize, toBase64 } from '../../src/lib/meaning/vector';
import { createEmbedder, envOptions } from './embed';

const QUERIES = 'tests/queries/meaning-queries.json';
const OUT = 'tests/queries/meaning-query-vectors.json';
const VERSE_QUERIES = 'tests/queries/verse-queries.json';
const VERSE_OUT = 'tests/queries/verse-query-vectors.json';

export type VerseQuery = { id: string; refs: string[]; expect: string[] };

/** Both query forms of a verse selection, tidied as the Worker does (no cut). */
export function verseForms(
	query: VerseQuery,
	bible: ReturnType<typeof createBible>
): { plain: string; labelled: string } {
	const plain = tidyQuery(verseQueryText(query.refs, bible));
	const labelled = tidyQuery(verseQueryText(query.refs, bible, { withLabel: true }));
	for (const text of [plain, labelled]) {
		if ([...text].length > MAX_EMBED_CHARS) throw new Error(`${query.id}: over ${MAX_EMBED_CHARS}`);
	}
	return { plain, labelled };
}

async function verseVectors(embedder: ReturnType<typeof createEmbedder>) {
	const queries: VerseQuery[] = JSON.parse(await readFile(VERSE_QUERIES, 'utf8'));
	const bible = createBible(JSON.parse(await readFile('content/bible/lsg1910.json', 'utf8')));
	const forms = queries.map((q) => verseForms(q, bible));
	const texts = forms.flatMap((f) => [f.plain, f.labelled]);
	const { vectors, embedded, cached } = await embedder.embed(texts);
	const cut = (i: number) => toBase64(cutAndNormalize(vectors[i], MEANING_CONFIG.dims));
	const out = {
		configId: configId(MEANING_CONFIG),
		plain: Object.fromEntries(queries.map((q, i) => [q.id, cut(2 * i)])),
		labelled: Object.fromEntries(queries.map((q, i) => [q.id, cut(2 * i + 1)]))
	};
	await writeFile(VERSE_OUT, JSON.stringify(out, null, '\t') + '\n');
	console.log(
		`✓ ${queries.length} verse selections × 2 forms (${out.configId}) written to ${VERSE_OUT} (embedded ${embedded}, cached ${cached})`
	);
}

export const queryText = (query: string) => tidyQuery(cutQuery(query).text);

async function main() {
	if (existsSync('.env')) process.loadEnvFile('.env');
	const queries: { id: string; query: string }[] = JSON.parse(await readFile(QUERIES, 'utf8'));
	const embedder = createEmbedder(envOptions());
	const { vectors, embedded, cached } = await embedder.embed(
		queries.map((q) => queryText(q.query))
	);
	const out = {
		configId: configId(MEANING_CONFIG),
		vectors: Object.fromEntries(
			queries.map((q, i) => [q.id, toBase64(cutAndNormalize(vectors[i], MEANING_CONFIG.dims))])
		)
	};
	await writeFile(OUT, JSON.stringify(out, null, '\t') + '\n');
	console.log(
		`✓ ${queries.length} query vectors (${out.configId}) written to ${OUT} (embedded ${embedded}, cached ${cached})`
	);
	await verseVectors(embedder);
}

if (process.argv[1]?.endsWith('query-vectors.ts')) await main();
