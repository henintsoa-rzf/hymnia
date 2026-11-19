import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createBible } from '$lib/bible/bible';
import { formatLabel, parseReference } from '$lib/bible/reference';

const bible = createBible(
	JSON.parse(readFileSync(new URL('../../content/bible/lsg1910.json', import.meta.url), 'utf8'))
);
const parse = (text: string) => parseReference(text, bible.verseCount);

describe('parseReference (SC-007)', () => {
	const cases: [string, string, number, number?][] = [
		['Jean 3:16', 'JHN', 3, 16],
		['jn 3:16', 'JHN', 3, 16],
		['Jean 3,16', 'JHN', 3, 16],
		['jean 3.16', 'JHN', 3, 16],
		['JEAN 3', 'JHN', 3],
		['  Jean   3 : 16 ', 'JHN', 3, 16],
		['ps 23', 'PSA', 23],
		['Ps23', 'PSA', 23],
		['Psaume 23', 'PSA', 23],
		['psaumes 23:1-4', 'PSA', 23, 1],
		['Psaume 23:1–4', 'PSA', 23, 1],
		['1co13', '1CO', 13],
		['1 Co 13:4', '1CO', 13, 4],
		['1 Cor. 13', '1CO', 13],
		['I Co 13', '1CO', 13],
		['II Co 5:17', '2CO', 5, 17],
		['1 Corinthiens 13', '1CO', 13],
		['1 jean 4:8', '1JN', 4, 8],
		['1jn 4', '1JN', 4],
		['deut 6:4', 'DEU', 6, 4],
		['Dt 6', 'DEU', 6],
		['Ésaïe 40:31', 'ISA', 40, 31],
		['esaie 40', 'ISA', 40],
		['Is 53', 'ISA', 53],
		['apocalypse 22', 'REV', 22],
		['ap 22:20', 'REV', 22, 20],
		['Abdias', 'OBA', 1],
		['Jude 24', 'JUD', 1, 24],
		['cantique 2', 'SNG', 2],
		['ct 2', 'SNG', 2],
		['Cantique des cantiques 2:4', 'SNG', 2, 4],
		['Rm 8:38', 'ROM', 8, 38],
		['Romains 8', 'ROM', 8],
		['Mt 5', 'MAT', 5],
		['Matthieu 5:3', 'MAT', 5, 3],
		['lc 2:10', 'LUK', 2, 10],
		['Ac 2', 'ACT', 2],
		['Hé 11:1', 'HEB', 11, 1],
		['hebreux 12', 'HEB', 12],
		['Phm 1', 'PHM', 1],
		['Ph 4:13', 'PHP', 4, 13],
		['Lam 3:22', 'LAM', 3, 22],
		['Genèse', 'GEN', 1]
	];
	it.each(cases)('%s', (text, book, chapter, verse) => {
		const ref = parse(text);
		expect(ref).toMatchObject({ book, chapter, adjusted: false });
		expect(ref?.verse).toBe(verse);
	});

	it('clamps a chapter or verse out of range to the nearest one', () => {
		expect(parse('ps 151')).toEqual({ book: 'PSA', chapter: 150, adjusted: true });
		expect(parse('jean 3:99')).toEqual({ book: 'JHN', chapter: 3, verse: 36, adjusted: true });
		expect(parse('jean 0')).toEqual({ book: 'JHN', chapter: 1, adjusted: true });
	});

	it('gives null for unknown or ambiguous books and empty text', () => {
		for (const text of ['jo 3', 'xyz 1', '', '   ', '3:16', 'j']) expect(parse(text)).toBeNull();
	});
});

describe('formatLabel', () => {
	it('groups runs of consecutive verses', () => {
		expect(formatLabel(['PSA.23.1', 'PSA.23.2', 'PSA.23.3', 'PSA.23.4'])).toBe('Psaume 23:1-4');
		expect(formatLabel(['JHN.3.16', 'JHN.3.17', 'JHN.3.21'])).toBe('Jean 3:16-17, 21');
		expect(formatLabel(['JHN.3.16'])).toBe('Jean 3:16');
	});

	it('sorts in Bible order and separates chapters and books with « ; »', () => {
		expect(formatLabel(['ROM.8.39', 'PSA.23.1', 'ROM.8.38'])).toBe('Psaume 23:1 ; Romains 8:38-39');
		expect(formatLabel(['GEN.1.1', 'REV.22.21'])).toBe('Genèse 1:1 ; Apocalypse 22:21');
		expect(formatLabel(['JHN.3.36', 'JHN.4.1'])).toBe('Jean 3:36 ; 4:1');
	});

	it('is empty for no verse and ignores bad ids', () => {
		expect(formatLabel([])).toBe('');
		expect(formatLabel(['nope', 'JHN.3.16'])).toBe('Jean 3:16');
	});
});
