/** Theme descriptions for every hymn of a catalog, current with its lyrics (tests only). */
import { lyricsHash, type ThemesFile } from '../../scripts/semantic/build';
import type { Catalog } from '../../src/lib/domain/schema';

export const themesFor = (catalog: Catalog): ThemesFile =>
	Object.fromEntries(
		catalog.hymns.map((h) => [
			h.id,
			{ text: `Thèmes de ${h.title}.`, lyricsHash: lyricsHash(h), model: 'test', generatedAt: '' }
		])
	);
