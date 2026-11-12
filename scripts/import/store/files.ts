/**
 * Stable, atomic JSON files (specs/002-hymnal-import/research.md R6, contracts/import-files.md).
 *
 * Same format as the existing content/ files: tab indentation, keys in the order of the value
 * (callers pass values parsed by their Zod schema, so keys follow the schema), final newline,
 * strings in Unicode NFC. A write goes to a temporary file that is then renamed, so an
 * interrupted run never leaves a half-written file.
 */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function nfc(value: unknown): unknown {
	if (typeof value === 'string') return value.normalize('NFC');
	if (Array.isArray(value)) return value.map(nfc);
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k.normalize('NFC'), nfc(v)]));
	}
	return value;
}

export function stringifyStable(value: unknown): string {
	return JSON.stringify(nfc(value), null, '\t') + '\n';
}

export type WriteOptions = {
	/** Test hook: runs after the temporary file is written, before it replaces the target. */
	beforeRename?: () => void | Promise<void>;
};

export async function writeJsonStable(path: string, value: unknown, options: WriteOptions = {}) {
	await writeTextAtomic(path, stringifyStable(value), options);
}

export async function writeTextAtomic(path: string, text: string, options: WriteOptions = {}) {
	await mkdir(dirname(path), { recursive: true });
	const tmp = `${path}.tmp-${process.pid}`;
	try {
		await writeFile(tmp, text);
		await options.beforeRename?.();
		await rename(tmp, path);
	} catch (error) {
		await rm(tmp, { force: true });
		throw error;
	}
}

export async function readJson<T = unknown>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, 'utf8')) as T;
}

/** Reads a JSON file, or returns `fallback` when the file does not exist. */
export async function readJsonOr<T>(path: string, fallback: T): Promise<unknown> {
	try {
		return await readJson(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
		throw error;
	}
}

export async function removeFile(path: string) {
	await rm(path, { force: true });
}
