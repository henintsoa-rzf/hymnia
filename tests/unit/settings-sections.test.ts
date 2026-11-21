import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, type Prefs } from '$lib/prefs/prefs';
import { SETTINGS_SECTIONS, summaryOf, type SummaryContext } from '$lib/settings/sections';

const ctx = (prefs: Partial<Prefs> = {}, rest: Partial<SummaryContext> = {}): SummaryContext => ({
	prefs: { ...DEFAULT_PREFS, ...prefs },
	hymnalsInUse: 10,
	hymnalsListed: 10,
	...rest
});

describe('settings sections (feature 016, FR-001, FR-002)', () => {
	it('lists the four sections in order', () => {
		expect(SETTINGS_SECTIONS.map((s) => [s.slug, s.title])).toEqual([
			['affichage', 'Affichage'],
			['lecture', 'Lecture'],
			['recueils', 'Recueils'],
			['hors-ligne', 'Hors ligne']
		]);
	});

	it('sums up the theme', () => {
		expect(summaryOf('affichage', ctx())).toBe('Thème système');
		expect(summaryOf('affichage', ctx({ theme: 'light' }))).toBe('Thème clair');
		expect(summaryOf('affichage', ctx({ theme: 'dark' }))).toBe('Thème sombre');
	});

	it('sums up text size and font', () => {
		expect(summaryOf('lecture', ctx())).toBe('Texte 100 % · Avec empattement');
		expect(summaryOf('lecture', ctx({ textScale: 1.1, lyricFont: 'sans' }))).toBe(
			'Texte 110 % · Sans empattement'
		);
		expect(summaryOf('lecture', ctx({ textScale: 0.85 }))).toBe('Texte 85 % · Avec empattement');
	});

	it('sums up the hymnals in use', () => {
		expect(summaryOf('recueils', ctx())).toBe('Tous les recueils');
		expect(summaryOf('recueils', ctx({}, { hymnalsInUse: 3 }))).toBe('3 recueils sur 10');
		expect(summaryOf('recueils', ctx({}, { hymnalsInUse: 1, hymnalsListed: 2 }))).toBe(
			'1 recueil sur 2'
		);
	});

	it('sums up the offline state', () => {
		expect(summaryOf('hors-ligne', ctx())).toBe('Vérification…');
		expect(summaryOf('hors-ligne', ctx({}, { offline: { kind: 'checking' } }))).toBe(
			'Vérification…'
		);
		expect(summaryOf('hors-ligne', ctx({}, { offline: { kind: 'ready' } }))).toBe(
			'Prêt hors ligne'
		);
		expect(summaryOf('hors-ligne', ctx({}, { offline: { kind: 'unavailable' } }))).toBe(
			'Hors ligne non disponible'
		);
		expect(
			summaryOf(
				'hors-ligne',
				ctx({}, { offline: { kind: 'item', label: 'Bible', state: 'downloading' } })
			)
		).toBe('Bible : téléchargement en cours');
		expect(
			summaryOf(
				'hors-ligne',
				ctx({}, { offline: { kind: 'item', label: 'Recherche par le sens', state: 'missing' } })
			)
		).toBe('Recherche par le sens : pas encore téléchargé');
	});
});
