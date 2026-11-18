/**
 * Smoke test of the embeddings provider (specs/011-semantic-search, task T001, research R1).
 *
 * Usage: npx tsx scripts/semantic/smoke.ts "la fidélité de Dieu"
 *
 * Reads MAMMOUTH_API_KEY, EMBEDDINGS_BASE_URL and EMBEDDINGS_MODEL from the environment or `.env`.
 * Prints `OK <model> <dims> dims via <base>`, or the HTTP status and error body (never the key).
 */
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const base = process.env.EMBEDDINGS_BASE_URL ?? 'https://api.mammouth.ai/v1';
const model = process.env.EMBEDDINGS_MODEL ?? 'text-embedding-3-large';
const key = process.env.MAMMOUTH_API_KEY;
const text = process.argv[2] ?? 'la fidélité de Dieu';

if (!key) {
	console.error('MAMMOUTH_API_KEY is not set (in .env or the environment).');
	process.exit(2);
}

const response = await fetch(`${base}/embeddings`, {
	method: 'POST',
	headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
	body: JSON.stringify({ model, input: [text] })
});
const body = await response.text();
if (!response.ok) {
	console.error(`FAILED ${response.status} ${response.statusText}\n${body.replaceAll(key, '***')}`);
	process.exit(1);
}
const json = JSON.parse(body) as { model?: string; data?: { embedding?: number[] }[] };
const dims = json.data?.[0]?.embedding?.length ?? 0;
if (dims !== 3072) {
	console.error(
		`FAILED unexpected vector length ${dims} (expected 3072) for ${json.model ?? model}`
	);
	process.exit(1);
}
console.log(`OK ${json.model ?? model} ${dims} dims via ${base}`);
