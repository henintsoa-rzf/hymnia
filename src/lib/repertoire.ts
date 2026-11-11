/**
 * Répertoire: hymns bookmarked on this device (design/decisions.md, D1). Minimal on purpose:
 * favourites and lists are a later feature; this keeps the tab and the bookmark working.
 */
import { writable } from 'svelte/store';

export type RepertoireItem = { hymnal: string; number: string };

const STORAGE_KEY = 'hymnia.repertoire';

function storage(): Storage | undefined {
	try {
		return typeof localStorage === 'undefined' ? undefined : localStorage;
	} catch {
		return undefined;
	}
}

function read(): RepertoireItem[] {
	try {
		const value: unknown = JSON.parse(storage()?.getItem(STORAGE_KEY) ?? '[]');
		return Array.isArray(value)
			? value.filter(
					(x): x is RepertoireItem => typeof x?.hymnal === 'string' && typeof x?.number === 'string'
				)
			: [];
	} catch {
		return [];
	}
}

export const repertoire = writable<RepertoireItem[]>(read());

repertoire.subscribe((items) => {
	try {
		storage()?.setItem(STORAGE_KEY, JSON.stringify(items));
	} catch {
		// Storage blocked: the répertoire only lasts for this visit.
	}
});

const same = (a: RepertoireItem, b: RepertoireItem) =>
	a.hymnal === b.hymnal && a.number === b.number;

export function toggleRepertoire(item: RepertoireItem) {
	repertoire.update((items) =>
		items.some((x) => same(x, item)) ? items.filter((x) => !same(x, item)) : [...items, item]
	);
}

export function inRepertoire(items: RepertoireItem[], item: RepertoireItem): boolean {
	return items.some((x) => same(x, item));
}
