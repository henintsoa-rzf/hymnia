/**
 * Synthetic collection for the performance test: 10 hymnals, ~6,000 hymns, ~1 KB of lyrics each
 * (research.md §3). Deterministic, so timings are comparable between runs.
 */
import type { Hymn, Hymnal } from '../../src/lib/domain/schema';

function prng(seed: number) {
	return () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296;
		return seed / 4294967296;
	};
}

const BASE_WORDS = (
	'gloire seigneur éternel jésus christ dieu père esprit saint amour grâce paix joie louange ' +
	'cœur âme vie croix sang agneau roi royaume ciel terre lumière chemin vérité force refuge ' +
	'rocher berger brebis fidèle tendre victoire salut sauveur pardon espérance foi prière ' +
	'chantons célébrons adorons bénissons louons élevons venez marchons gardons suivons'
).split(' ');
const SYLLABLES = 'ra me lo ti su na ve ri ho da ce pi mo ga lu se bo fi ne ta ju ro vi ze'.split(
	' '
);

export function generateCorpus(hymnCount = 6000, seed = 42): { hymnals: Hymnal[]; hymns: Hymn[] } {
	const rand = prng(seed);
	const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];

	// ~20,000 distinct words, like a real collection.
	const vocabulary = [...BASE_WORDS];
	while (vocabulary.length < 20000) {
		const n = 2 + Math.floor(rand() * 3);
		vocabulary.push(Array.from({ length: n }, () => pick(SYLLABLES)).join(''));
	}
	const word = () => (rand() < 0.3 ? pick(BASE_WORDS) : pick(vocabulary));
	const line = () => Array.from({ length: 5 + Math.floor(rand() * 3) }, word).join(' ');

	const hymnals: Hymnal[] = Array.from({ length: 10 }, (_, i) => ({
		id: `r${i}`,
		name: `Recueil ${i}`,
		abbreviations: [`R${i}`],
		sortOrder: i
	}));
	const next = new Array(10).fill(1);

	const hymns: Hymn[] = Array.from({ length: hymnCount }, (_, i) => {
		const home = i % 10;
		const entries = [{ hymnal: `r${home}`, number: String(next[home]++) }];
		if (rand() < 0.15) {
			const other = (home + 1 + Math.floor(rand() * 9)) % 10;
			entries.push({ hymnal: `r${other}`, number: String(next[other]++) });
		}
		return {
			id: `chant-${i}`,
			title: Array.from({ length: 3 + Math.floor(rand() * 3) }, word).join(' '),
			entries,
			sections: Array.from({ length: 4 }, (_, s) => ({
				type: s === 1 ? ('chorus' as const) : ('verse' as const),
				number: s === 1 ? null : s + 1,
				lines: Array.from({ length: 6 }, line)
			})),
			credits: [],
			source: { name: 'Synthétique', url: null, retrievedAt: '2026-11-11' },
			rights: 'confirmed' as const,
			corrections: []
		};
	});
	return { hymnals, hymns };
}
