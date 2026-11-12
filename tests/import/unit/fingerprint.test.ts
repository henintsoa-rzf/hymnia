// Fingerprint of extracted source text (research R6, tasks T009/T015).
import { describe, expect, it } from 'vitest';
import { fingerprint } from '../../../scripts/import/pipeline/fingerprint';
import type { Section } from '$lib/domain/schema';

const sections: Section[] = [
	{ type: 'verse', number: 1, lines: ['À toi la gloire, ô Ressuscité !', 'À toi la victoire'] },
	{ type: 'chorus', number: null, lines: ['À toi la gloire'] }
];
const base = { title: 'À toi la gloire', sections };

describe('fingerprint', () => {
	it('starts with sha256: and is stable', () => {
		expect(fingerprint(base)).toMatch(/^sha256:[0-9a-f]{64}$/);
		expect(fingerprint(base)).toBe(fingerprint(structuredClone(base)));
	});

	it('ignores whitespace differences and NFD vs NFC', () => {
		const spaced = {
			title: '  À toi   la gloire ',
			sections: [
				{ ...sections[0], lines: ['À  toi la gloire, ô Ressuscité !', ' À toi la victoire'] },
				sections[1]
			]
		};
		expect(fingerprint(spaced)).toBe(fingerprint(base));
	});

	it('changes when one word changes', () => {
		const changed = structuredClone(base);
		changed.sections[0].lines[1] = 'À toi la louange';
		expect(fingerprint(changed)).not.toBe(fingerprint(base));
	});

	it('changes when punctuation, case or an accent changes (faithful text, FR-004)', () => {
		for (const line of ['A toi la gloire', 'À toi la gloire !', 'à toi la gloire']) {
			const changed = structuredClone(base);
			changed.sections[1].lines[0] = line;
			expect(fingerprint(changed)).not.toBe(fingerprint(base));
		}
	});

	it('changes when a section type or verse number changes', () => {
		const type = structuredClone(base);
		type.sections[1].type = 'bridge';
		const number = structuredClone(base);
		number.sections[0].number = 2;
		expect(fingerprint(type)).not.toBe(fingerprint(base));
		expect(fingerprint(number)).not.toBe(fingerprint(base));
	});

	it('changes when lines move between sections', () => {
		const moved = {
			title: base.title,
			sections: [
				{ ...sections[0], lines: [sections[0].lines[0]] },
				{ ...sections[1], lines: [sections[0].lines[1], ...sections[1].lines] }
			]
		};
		expect(fingerprint(moved)).not.toBe(fingerprint(base));
	});
});
