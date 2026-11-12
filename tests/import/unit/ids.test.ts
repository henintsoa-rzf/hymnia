// Stable hymn ids (data-model "Derived values", tasks T012/T016).
import { describe, expect, it } from 'vitest';
import { newHymnId, slug } from '../../../scripts/import/pipeline/ids';

describe('slug', () => {
	it('makes a lowercase slug with no accents or punctuation', () => {
		expect(slug('À toi la gloire')).toBe('a-toi-la-gloire');
		expect(slug('Cœur  d’enfant !')).toBe('coeur-d-enfant');
		expect(slug('  123 bis ')).toBe('123-bis');
	});

	it('falls back to "chant" for a title with no letters or digits', () => {
		expect(slug('« … »')).toBe('chant');
	});
});

describe('newHymnId', () => {
	it('uses the title slug when it is free', () => {
		expect(newHymnId('À toi la gloire', 'jem', '245', new Set())).toBe('a-toi-la-gloire');
	});

	it('falls back to <slug>-<hymnal>-<number> when the slug is taken', () => {
		const taken = new Set(['a-toi-la-gloire']);
		expect(newHymnId('À toi la gloire', 'jem', '245', taken)).toBe('a-toi-la-gloire-jem-245');
		expect(newHymnId('À toi la gloire', 'he', '3 bis', taken)).toBe('a-toi-la-gloire-he-3-bis');
	});

	it('adds a counter when both are taken, and never returns a taken id', () => {
		const taken = new Set(['a-toi-la-gloire', 'a-toi-la-gloire-jem-245']);
		expect(newHymnId('À toi la gloire', 'jem', '245', taken)).toBe('a-toi-la-gloire-jem-245-2');
	});

	it('never changes the ids it is given', () => {
		const taken = new Set(['x']);
		newHymnId('X', 'jem', '1', taken);
		expect([...taken]).toEqual(['x']);
	});
});
