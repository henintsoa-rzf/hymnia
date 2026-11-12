/**
 * Pages saved from a browser, for sources that block the importer
 * (specs/004-evangile21-hymnal/contracts/cli-add-pages.md, research R1–R2).
 *
 * Each `*.html` / `*.htm` file of a folder becomes a cache entry in the fetcher's format, so a
 * `run` finds it offline exactly like a fetched page. No network access.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { cachePaths, pageUrl, sha256, type CachedMeta } from './fetcher';
import { CACHE_DIR, type SourceConfig } from './store/state';
import { writeJsonStable, writeTextAtomic } from './store/files';

export type SavedPageOutcome = 'added' | 'replaced' | 'unchanged' | 'refused';
export type RefusalReason = 'no url' | 'other host' | 'challenge page' | 'empty';

export type SavedPageResult = {
	file: string;
	outcome: SavedPageOutcome;
	url?: string;
	reason?: RefusalReason;
};

export type AddSavedPagesResult = {
	files: SavedPageResult[];
	counts: Record<SavedPageOutcome, number>;
};

const SAVED_FROM = /<!-- saved from url=\(\d+\)(\S+?) -->/u;
const CANONICAL = /<link\b[^>]*\brel=["']canonical["'][^>]*>/iu;
const OG_URL = /<meta\b[^>]*\bproperty=["']og:url["'][^>]*>/iu;
const CHALLENGE_TITLE = /<title>\s*Just a moment\.\.\.\s*<\/title>/iu;

function attribute(tag: string | undefined, name: string): string | undefined {
	if (!tag) return undefined;
	return new RegExp(`\\b${name}=["']([^"']+)["']`, 'iu').exec(tag)?.[1];
}

/** The page URL a browser recorded in a saved file, without fragment; null when none. */
export function pageUrlOf(html: string): string | null {
	const candidates = [
		SAVED_FROM.exec(html)?.[1],
		attribute(CANONICAL.exec(html)?.[0], 'href'),
		attribute(OG_URL.exec(html)?.[0], 'content')
	];
	for (const candidate of candidates) {
		if (!candidate) continue;
		try {
			return pageUrl(candidate.replace(/&amp;/gu, '&'));
		} catch {
			// Not a URL: try the next marker.
		}
	}
	return null;
}

export const isChallengePage = (html: string) => CHALLENGE_TITLE.test(html);

async function readOrNull(path: string): Promise<string | null> {
	try {
		return await readFile(path, 'utf8');
	} catch {
		return null;
	}
}

export async function addSavedPages(options: {
	root: string;
	source: Pick<SourceConfig, 'id' | 'baseUrl'>;
	folder: string;
	dryRun?: boolean;
}): Promise<AddSavedPagesResult> {
	const { root, source, folder, dryRun = false } = options;
	const cacheDir = join(root, CACHE_DIR, source.id);
	const host = new URL(source.baseUrl).host;
	const entries = await readdir(folder, { withFileTypes: true });
	const names = entries
		.filter((e) => e.isFile() && /\.html?$/iu.test(e.name))
		.map((e) => e.name)
		.sort();

	const files: SavedPageResult[] = [];
	for (const file of names) {
		const path = join(folder, file);
		const body = await readFile(path, 'utf8');
		const refuse = (reason: RefusalReason, url?: string) =>
			files.push({ file, outcome: 'refused', reason, ...(url ? { url } : {}) });

		if (body.trim() === '') {
			refuse('empty');
			continue;
		}
		const url = pageUrlOf(body);
		if (!url) {
			refuse('no url');
			continue;
		}
		if (new URL(url).host !== host) {
			refuse('other host', url);
			continue;
		}
		if (isChallengePage(body)) {
			refuse('challenge page', url);
			continue;
		}

		const paths = cachePaths(cacheDir, url);
		const cached = await readOrNull(paths.page);
		const outcome: SavedPageOutcome =
			cached === null ? 'added' : cached === body ? 'unchanged' : 'replaced';
		files.push({ file, outcome, url });
		if (dryRun || outcome === 'unchanged') continue;

		const meta: CachedMeta = {
			url,
			retrievedAt: (await stat(path)).mtime.toISOString(),
			status: 200,
			etag: null,
			lastModified: null,
			sha256: sha256(body)
		};
		await writeTextAtomic(paths.page, body);
		await writeJsonStable(paths.meta, meta);
	}

	const counts: Record<SavedPageOutcome, number> = { added: 0, replaced: 0, unchanged: 0, refused: 0 };
	for (const f of files) counts[f.outcome] += 1;
	return { files, counts };
}
