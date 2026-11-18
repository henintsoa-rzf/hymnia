/**
 * Theme descriptions for the `title+theme+stanza` representation (research R11), only kept if
 * the measured comparison shows a gain (FR-021). Each description is 1–2 French sentences on
 * the themes and uses of a hymn, quoting no lyrics. They are never displayed (FR-022): only the
 * meaning build and the comparison read `content/generated/themes.json`.
 *
 * Usage:
 *   npx tsx scripts/semantic/generate-themes.ts --sample 30   # a sample to review first
 *   npx tsx scripts/semantic/generate-themes.ts               # every published hymn
 *
 * Needs ANTHROPIC_API_KEY (in `.env`). Uses the Message Batches API (half price, asynchronous).
 * Only hymns whose lyrics changed since their description (lyricsHash) are sent again.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { buildData } from '../build-data';
import type { PublishedHymn } from '../../src/lib/domain/schema';
import { normalizeText } from '../../src/lib/search/normalize';

export const THEMES_FILE = 'content/generated/themes.json';
const MODEL = 'claude-haiku-5-5';
const MAX_CHARS = 300;
/** A description holding this many consecutive lyric words is rejected (no quoting). */
const COPIED_WORDS = 6;

export type ThemeDescription = {
	text: string;
	lyricsHash: string;
	model: string;
	generatedAt: string;
};
export type ThemesFile = Record<string, ThemeDescription>;

export const lyricsHash = (hymn: Pick<PublishedHymn, 'sections'>) =>
	createHash('sha256')
		.update(hymn.sections.flatMap((s) => s.lines).join('\n'))
		.digest('hex');

/** True when `text` repeats a run of `COPIED_WORDS` consecutive words of the lyrics. */
export function quotesLyrics(text: string, hymn: Pick<PublishedHymn, 'sections'>): boolean {
	const lyrics = ` ${normalizeText(hymn.sections.flatMap((s) => s.lines).join(' '))} `;
	const words = normalizeText(text).split(' ');
	for (let i = 0; i + COPIED_WORDS <= words.length; i++) {
		if (lyrics.includes(` ${words.slice(i, i + COPIED_WORDS).join(' ')} `)) return true;
	}
	return false;
}

const SYSTEM = `Tu rédiges, pour un moteur de recherche de chants chrétiens, une description de 1 à 2 phrases en français (au plus ${MAX_CHARS} caractères) des thèmes et des usages d'un chant : sujets (grâce, fidélité de Dieu, pardon…), moments du culte ou de l'année (Noël, Pâques, cène, baptême, mariage, enterrement, envoi…) et passages bibliques évoqués. Ne cite aucune phrase des paroles. Réponds uniquement par la description, sans guillemets ni préambule.`;

function prompt(hymn: PublishedHymn): string {
	const lyrics = hymn.sections.map((s) => s.lines.join('\n')).join('\n\n');
	return `Titre : ${hymn.title}\n\nParoles :\n${lyrics}`;
}

async function main() {
	if (existsSync('.env')) process.loadEnvFile('.env');
	const sampleArg = process.argv.indexOf('--sample');
	const sample = sampleArg > 0 ? Number(process.argv[sampleArg + 1]) : undefined;

	const { errors, catalog } = await buildData('content', {
		personalUse: process.env.HYMNIA_PERSONAL_USE === '1'
	});
	if (errors.length || !catalog) throw new Error(errors.join('\n'));

	const themes: ThemesFile = existsSync(THEMES_FILE)
		? JSON.parse(await readFile(THEMES_FILE, 'utf8'))
		: {};
	let todo = catalog.hymns.filter((h) => themes[h.id]?.lyricsHash !== lyricsHash(h));
	if (sample) {
		// Spread over the collection, so the sample covers every hymnal.
		const step = Math.max(1, Math.floor(todo.length / sample));
		todo = todo.filter((_, i) => i % step === 0).slice(0, sample);
	}
	if (todo.length === 0) {
		console.log('✓ every theme description is up to date');
		return;
	}
	console.log(`Sending ${todo.length} hymns to ${MODEL} (Message Batches API)…`);

	const client = new Anthropic();
	const batch = await client.messages.batches.create({
		requests: todo.map((hymn, i) => ({
			// custom_id allows only [a-zA-Z0-9_-] up to 64 characters: use the position.
			custom_id: `h${i}`,
			params: {
				model: MODEL,
				max_tokens: 4000,
				output_config: { effort: 'low' },
				system: SYSTEM,
				messages: [{ role: 'user', content: prompt(hymn) }]
			}
		}))
	});

	let status = batch;
	while (status.processing_status !== 'ended') {
		await new Promise((r) => setTimeout(r, 30_000));
		status = await client.messages.batches.retrieve(batch.id);
		console.log(
			`  ${status.processing_status}: ${status.request_counts.succeeded} done, ` +
				`${status.request_counts.processing} in progress`
		);
	}

	const generatedAt = new Date().toISOString();
	let kept = 0;
	const rejected: string[] = [];
	for await (const result of await client.messages.batches.results(batch.id)) {
		const hymn = todo[Number(result.custom_id.slice(1))];
		if (result.result.type !== 'succeeded') {
			rejected.push(`${hymn.id}: ${result.result.type}`);
			continue;
		}
		const message = result.result.message;
		if (message.stop_reason === 'refusal') {
			rejected.push(`${hymn.id}: refusal`);
			continue;
		}
		const text = message.content
			.flatMap((b) => (b.type === 'text' ? [b.text] : []))
			.join(' ')
			.replace(/\s+/g, ' ')
			.trim();
		if (!text || text.length > MAX_CHARS) {
			rejected.push(`${hymn.id}: ${text.length} characters`);
		} else if (quotesLyrics(text, hymn)) {
			rejected.push(`${hymn.id}: quotes the lyrics — « ${text} »`);
		} else {
			themes[hymn.id] = { text, lyricsHash: lyricsHash(hymn), model: MODEL, generatedAt };
			kept++;
		}
	}

	const sorted = Object.fromEntries(Object.entries(themes).sort(([a], [b]) => a.localeCompare(b)));
	await mkdir(dirname(THEMES_FILE), { recursive: true });
	await writeFile(THEMES_FILE, JSON.stringify(sorted, null, '\t') + '\n');
	console.log(`✓ ${kept} descriptions written to ${THEMES_FILE}`);
	if (rejected.length) {
		console.warn(`⚠ ${rejected.length} rejected (run again to retry them):`);
		for (const r of rejected) console.warn(`  - ${r}`);
	}
	if (sample) {
		console.log('\nSample to review:');
		for (const hymn of todo) {
			if (themes[hymn.id]) console.log(`- ${hymn.title}: ${themes[hymn.id].text}`);
		}
	}
}

if (process.argv[1]?.endsWith('generate-themes.ts')) await main();
