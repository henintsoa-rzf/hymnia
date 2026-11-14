// Feature 007: the YouTube search link uses the displayed title (contracts/ui.md, FR-003).
import { describe, expect, it } from 'vitest';
import { youtubeSearchUrl } from '$lib/youtube';

const BASE = 'https://www.youtube.com/results?search_query=';

describe('youtubeSearchUrl', () => {
	it.each([
		['À Toi la gloire', '%C3%80%20Toi%20la%20gloire'],
		["Ô Dieu, c'est toi", "%C3%94%20Dieu%2C%20c'est%20toi"],
		['Mon Rédempteur  vit ', 'Mon%20R%C3%A9dempteur%20vit'],
		['« Gloire » !', '%C2%AB%20Gloire%20%C2%BB%20!'],
		['Gloire !', 'Gloire%20!'],
		['C’est un rempart', 'C%E2%80%99est%20un%20rempart']
	])('%s', (title, query) => {
		expect(youtubeSearchUrl(title)).toBe(BASE + query);
	});

	it('returns the bare search page for a blank title', () => {
		expect(youtubeSearchUrl('')).toBe(BASE);
		expect(youtubeSearchUrl('   ')).toBe(BASE);
	});
});
