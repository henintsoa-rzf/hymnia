import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createBible } from '$lib/bible/bible';
import { VERSE_QUERY_FORM, copyText, verseQueryText } from '$lib/bible/query';

const bible = createBible(
	JSON.parse(readFileSync(new URL('../../content/bible/lsg1910.json', import.meta.url), 'utf8'))
);
const v = (id: string) => bible.verseText(id)!;

describe('verseQueryText (research R4)', () => {
	it('joins the texts in Bible order with one space, with no numbers', () => {
		expect(verseQueryText(['ROM.8.39', 'PSA.23.1', 'ROM.8.38'], bible, { withLabel: false })).toBe(
			`${v('PSA.23.1')} ${v('ROM.8.38')} ${v('ROM.8.39')}`
		);
	});

	it('can put the label first', () => {
		expect(verseQueryText(['JHN.3.17', 'JHN.3.16'], bible, { withLabel: true })).toBe(
			`Jean 3:16-17 — ${v('JHN.3.16')} ${v('JHN.3.17')}`
		);
	});

	it('skips unknown verses', () => {
		expect(verseQueryText(['JHN.3.99', 'JHN.3.16'], bible, { withLabel: false })).toBe(
			v('JHN.3.16')
		);
	});

	it('uses the measured form by default (labelled, tests/queries/verse-evaluation.json)', () => {
		expect(VERSE_QUERY_FORM).toBe('labelled');
		expect(verseQueryText(['JHN.3.16'], bible)).toBe(`Jean 3:16 — ${v('JHN.3.16')}`);
	});
});

describe('copyText (contracts/bible-ui.md §5)', () => {
	it('gives the text, then the reference and the translation', () => {
		expect(copyText(['JHN.3.17', 'JHN.3.16'], bible)).toBe(
			`${v('JHN.3.16')} ${v('JHN.3.17')}\n— Jean 3:16-17 (Louis Segond 1910)`
		);
	});

	it('starts a new paragraph for another chapter or a gap', () => {
		expect(copyText(['PSA.23.1', 'PSA.23.2', 'JHN.10.11'], bible)).toBe(
			`${v('PSA.23.1')} ${v('PSA.23.2')}\n\n${v('JHN.10.11')}\n— Psaume 23:1-2 ; Jean 10:11 (Louis Segond 1910)`
		);
		expect(copyText(['JHN.3.16', 'JHN.3.18'], bible)).toBe(
			`${v('JHN.3.16')}\n\n${v('JHN.3.18')}\n— Jean 3:16, 18 (Louis Segond 1910)`
		);
	});

	it('is empty for no verse', () => {
		expect(copyText([], bible)).toBe('');
	});
});
