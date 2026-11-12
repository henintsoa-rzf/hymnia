// Shared text cleanup for adapters (contracts/source-adapter.md rules 2 and 4, task T021).
import { describe, expect, it } from 'vitest';
import { cleanLine, mapCreditRole, stripChords } from '../../../scripts/import/sources/clean';

describe('cleanLine', () => {
	it('trims, collapses whitespace, turns non-breaking spaces into spaces and converts to NFC', () => {
		expect(cleanLine('  À toi  la   gloire,\tô Ressuscité ! ')).toBe(
			'À toi la gloire, ô Ressuscité !'
		);
	});

	it('never rewords: punctuation, case and apostrophes are kept', () => {
		expect(cleanLine('Qu’il est doux, SEIGNEUR, d’être à toi !')).toBe(
			'Qu’il est doux, SEIGNEUR, d’être à toi !'
		);
	});
});

describe('stripChords', () => {
	it('removes bracketed chords inside lyrics and counts them', () => {
		const result = stripChords(['[G]À toi la [D/F#]gloire, ô [Em7]Ressus[C]cité !']);
		expect(result.lines).toEqual(['À toi la gloire, ô Ressuscité !']);
		expect(result.counts).toEqual({ 'inline-chord': 4 });
	});

	it('removes lines made only of chords, in English or French notation', () => {
		const result = stripChords([
			'G    D/F#   Em   C',
			'À toi la gloire',
			'Do   Sol/Si  Lam7  Fa',
			'Ré m   Mi'
		]);
		expect(result.lines).toEqual(['À toi la gloire']);
		expect(result.counts).toEqual({ 'chord-line': 3 });
	});

	it('keeps lyric lines that only look a little like chords', () => {
		const lines = ['La la la', 'Do-ré-mi', 'A toi', 'Si tu savais', 'Amen', 'Ah !'];
		expect(stripChords(lines)).toEqual({ lines, counts: {} });
	});

	it('keeps a bracketed word that is not a chord', () => {
		const lines = ['[Refrain]', '[bis]'];
		expect(stripChords(lines).lines).toEqual(lines);
	});
});

describe('mapCreditRole', () => {
	it.each([
		['Paroles', 'lyrics'],
		['Texte', 'lyrics'],
		['Auteur', 'lyrics'],
		['Paroles et musique', 'lyrics'],
		['Musique', 'music'],
		['Compositeur', 'music'],
		['Mélodie', 'music'],
		['Traduction', 'translation'],
		['Adaptation française', 'translation'],
		['Arrangement', 'arrangement'],
		['Harmonisation', 'arrangement'],
		['Éditeur', null],
		['Copyright', null]
	])('%s → %s', (label, role) => {
		expect(mapCreditRole(label)).toBe(role);
	});
});
