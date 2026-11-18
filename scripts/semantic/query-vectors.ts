/**
 * Query vectors of the meaning reference set (tests/queries/meaning-queries.json) for the
 * shipped configuration, so tests/queries/meaning.test.ts runs offline (task T049). The texts are
 * made exactly as the Worker makes them: cut to 500 code points, tidied, embedded, then cut to
 * the shipped dims and re-normalised.
 *
 * Usage: npx tsx scripts/semantic/query-vectors.ts   (needs MAMMOUTH_API_KEY, or a full cache)
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { MEANING_CONFIG, configId, tidyQuery } from '../../src/lib/meaning/config';
import { cutQuery } from '../../src/lib/meaning/embed-client';
import { cutAndNormalize, toBase64 } from '../../src/lib/meaning/vector';
import { createEmbedder, envOptions } from './embed';

const QUERIES = 'tests/queries/meaning-queries.json';
const OUT = 'tests/queries/meaning-query-vectors.json';

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
}

if (process.argv[1]?.endsWith('query-vectors.ts')) await main();
