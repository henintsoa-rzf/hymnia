/**
 * Feature 007 (FR-003): the YouTube search for the title shown on the hymn page.
 * `\s` also matches the non-breaking and narrow non-breaking spaces of French typography.
 */
export function youtubeSearchUrl(title: string): string {
	const text = title.replace(/\s+/g, ' ').trim();
	return `https://www.youtube.com/results?search_query=${encodeURIComponent(text)}`;
}
