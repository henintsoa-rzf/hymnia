/**
 * Display helpers shared by the screens: French typography, labels and hymn URLs.
 * The stored text is never changed (FR-020); only spaces are made non-breaking for display.
 */
import { resolve } from '$app/paths';
import type { Credit } from './domain/schema';

const NBSP = '\u00a0';
const NNBSP = '\u202f';

/**
 * French typography for display (design/decisions.md §13): the space before ; : ! ? and inside
 * « » becomes non-breaking, so a line never starts with a punctuation mark.
 */
export function frenchSpaces(text: string): string {
	return text
		.replace(/ ([;:!?»])/g, `${NNBSP}$1`)
		.replace(/« /g, `«${NNBSP}`)
		.replace(/ (%)/g, `${NBSP}$1`);
}

/** "CE 12", with a non-breaking space. */
export function refLabel(abbreviation: string, number: string): string {
	return `${abbreviation}${NBSP}${number}`;
}

/** "1 chant", "10 chants". */
export function hymnCountLabel(count: number): string {
	return `${count}${NBSP}${count > 1 ? 'chants' : 'chant'}`;
}

/** URL of a hymn in a hymnal; the number is URL-encoded ("3 bis" → "3%20bis"). */
export function hymnUrl(hymnal: string, number: string) {
	return resolve('/recueils/[recueil]/[numero]', {
		recueil: hymnal,
		numero: encodeURIComponent(number)
	});
}

/** The same hymn, read in a collection's order (feature 003): `?collection=<id>`. */
export function hymnInCollectionUrl(hymnal: string, number: string, collection: string): string {
	return `${hymnUrl(hymnal, number)}?collection=${encodeURIComponent(collection)}`;
}

export function hymnalUrl(hymnal: string) {
	return resolve('/recueils/[recueil]', { recueil: hymnal });
}

export const ROLE_LABELS: Record<Credit['role'], string> = {
	lyrics: 'Paroles',
	music: 'Musique',
	translation: 'Traduction',
	arrangement: 'Arrangement',
	// The source names the authors without their role (feature 002).
	unspecified: 'Auteurs'
};

const ROLE_ORDER: Credit['role'][] = [
	'lyrics',
	'music',
	'unspecified',
	'translation',
	'arrangement'
];

/** Credits grouped by role, in a fixed order: [["Paroles", "Edmond Budry"], …]. */
export function creditLines(credits: Credit[]): [label: string, names: string][] {
	return ROLE_ORDER.flatMap((role) => {
		const names = credits.filter((c) => c.role === role).map((c) => c.name);
		return names.length > 0 ? [[ROLE_LABELS[role], names.join(', ')] as [string, string]] : [];
	});
}

/** One short line under the title: "Paroles : Edmond Budry · Musique : G. F. Haendel". */
export function shortCredit(credits: Credit[]): string {
	return creditLines(credits)
		.filter(([label]) => label === 'Paroles' || label === 'Musique' || label === 'Auteurs')
		.map(([label, names]) => `${label}${NNBSP}: ${names}`)
		.join(' · ');
}

/** "2026-11-11" → "11 novembre 2026". */
export function formatDate(iso: string): string {
	const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
	if (Number.isNaN(date.getTime())) return iso;
	return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}
