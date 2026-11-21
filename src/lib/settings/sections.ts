/**
 * The sections of Réglages (feature 016, FR-001, FR-002, research R3): their order, titles and
 * the one-line summary each menu entry shows. Pure, so the menu stays a list of links.
 */
import { OFFLINE_STATE_LABELS, type OfflineOverview } from '../offline/status';
import type { Prefs } from '../prefs/prefs';

export type SectionSlug = 'affichage' | 'lecture' | 'recueils' | 'hors-ligne';

export const SETTINGS_SECTIONS: readonly { slug: SectionSlug; title: string }[] = [
	{ slug: 'affichage', title: 'Affichage' },
	{ slug: 'lecture', title: 'Lecture' },
	{ slug: 'recueils', title: 'Recueils' },
	{ slug: 'hors-ligne', title: 'Hors ligne' }
];

export type SummaryContext = {
	prefs: Prefs;
	/** Hymnals fully or partly in use (feature 014). */
	hymnalsInUse: number;
	/** Hymnals listed in Recueils. */
	hymnalsListed: number;
	/** Absent until the device has been probed. */
	offline?: OfflineOverview;
};

const THEME_SUMMARY: Record<Prefs['theme'], string> = {
	system: 'Thème système',
	light: 'Thème clair',
	dark: 'Thème sombre'
};

export const LYRIC_FONT_LABELS: Record<Prefs['lyricFont'], string> = {
	serif: 'Avec empattement',
	sans: 'Sans empattement'
};

export function isSectionSlug(value: string): value is SectionSlug {
	return SETTINGS_SECTIONS.some((s) => s.slug === value);
}

export function summaryOf(slug: SectionSlug, ctx: SummaryContext): string {
	switch (slug) {
		case 'affichage':
			return THEME_SUMMARY[ctx.prefs.theme];
		case 'lecture':
			return `Texte ${Math.round(ctx.prefs.textScale * 100)} % · ${LYRIC_FONT_LABELS[ctx.prefs.lyricFont]}`;
		case 'recueils':
			return ctx.hymnalsInUse >= ctx.hymnalsListed
				? 'Tous les recueils'
				: `${ctx.hymnalsInUse} ${ctx.hymnalsInUse > 1 ? 'recueils' : 'recueil'} sur ${ctx.hymnalsListed}`;
		case 'hors-ligne':
			return offlineSummary(ctx.offline ?? { kind: 'checking' });
	}
}

function offlineSummary(offline: OfflineOverview): string {
	switch (offline.kind) {
		case 'checking':
			return 'Vérification…';
		case 'ready':
			return 'Prêt hors ligne';
		case 'unavailable':
			return 'Hors ligne non disponible';
		case 'item':
			return `${offline.label} : ${OFFLINE_STATE_LABELS[offline.state].toLowerCase()}`;
	}
}
