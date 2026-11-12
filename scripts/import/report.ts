/**
 * Run reports (data-model.md, "ImportRun and Report"; FR-018): import/reports/<runId>.json and
 * a readable <runId>.md in French.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readJson, writeJsonStable, writeTextAtomic } from './store/files';
import { REPORTS_DIR } from './store/state';

export type Item = { number: string; hymnId: string; title?: string };
export type SkipItem = { number: string; url: string; reason: string };
export type DuplicateItem = { a: string; b: string; similarity: number; reason: string };
export type ConflictItem = { number: string; reason: string };

export type HymnalReport = {
	new: Item[];
	changed: Item[];
	unchanged: Item[];
	skipped: SkipItem[];
	missing: Item[];
	possibleDuplicates: DuplicateItem[];
	autoMerged: Item[];
	conflicts: ConflictItem[];
	noCredits: Item[];
	rightsInherited: Item[];
	unknownCredits: { number: string; labels: string[] }[];
	strippedMarkup: Record<string, number>;
};

export type SourceStatus = 'ok' | 'aborted' | 'unreachable' | 'skipped-permission' | 'invalid';

export type SourceReport = {
	status: SourceStatus;
	pages: number;
	failures: number;
	/** Failure reason → count. */
	reasons: Record<string, number>;
	message?: string;
};

export type RunReport = {
	runId: string;
	startedAt: string;
	finishedAt: string;
	args: { source: string; hymnals: string[]; offline: boolean; dryRun: boolean };
	perSource: Record<string, SourceReport>;
	perHymnal: Record<string, HymnalReport>;
	/** Rights status per hymnal after the run: hymns published / not published. */
	rights?: Record<string, { published: number; unpublished: number }>;
};

export const emptyHymnalReport = (): HymnalReport => ({
	new: [],
	changed: [],
	unchanged: [],
	skipped: [],
	missing: [],
	possibleDuplicates: [],
	autoMerged: [],
	conflicts: [],
	noCredits: [],
	rightsInherited: [],
	unknownCredits: [],
	strippedMarkup: {}
});

export function runIdOf(date: Date): string {
	const iso = date.toISOString();
	return `${iso.slice(0, 10).replaceAll('-', '')}-${iso.slice(11, 19).replaceAll(':', '')}`;
}

const STATUS_LABELS: Record<SourceStatus, string> = {
	ok: 'terminé',
	aborted: 'interrompu (trop d’échecs, rien n’a été écrit)',
	unreachable: 'injoignable (rien n’a été écrit)',
	'skipped-permission': 'non lancé (permission)',
	invalid: 'contenu invalide (rien n’a été écrit)'
};

const SECTION_TITLES: [keyof HymnalReport, string][] = [
	['new', 'Nouveaux'],
	['changed', 'Modifiés à la source (à valider)'],
	['autoMerged', 'Rattachés à un chant existant'],
	['possibleDuplicates', 'Doublons possibles (à décider)'],
	['conflicts', 'Conflits'],
	['skipped', 'Ignorés'],
	['missing', 'Absents de la source'],
	['noCredits', 'Sans crédits'],
	['unknownCredits', 'Crédits non reconnus'],
	['rightsInherited', 'Droits hérités']
];

const cell = (text: string) => text.replaceAll('|', '\\|').replaceAll('\n', ' ');

function rows(key: keyof HymnalReport, report: HymnalReport): string[] {
	switch (key) {
		case 'skipped':
			return report.skipped.map((s) => `| ${s.number} | ${cell(s.reason)} | ${s.url} |`);
		case 'conflicts':
			return report.conflicts.map((c) => `| ${c.number} | ${cell(c.reason)} | |`);
		case 'possibleDuplicates':
			return report.possibleDuplicates.map(
				(d) => `| ${d.a} ↔ ${d.b} | ${cell(d.reason)} | ${d.similarity.toFixed(2)} |`
			);
		case 'unknownCredits':
			return report.unknownCredits.map((u) => `| ${u.number} | ${cell(u.labels.join(', '))} | |`);
		case 'strippedMarkup':
			return [];
		default:
			return (report[key] as Item[]).map(
				(i) => `| ${i.number} | ${cell(i.title ?? '')} | \`${i.hymnId}\` |`
			);
	}
}

export function renderMarkdown(report: RunReport): string {
	const out: string[] = [`# Import ${report.runId}`, ''];
	out.push(
		`- Source : \`${report.args.source}\`, recueils : ${report.args.hymnals.join(', ')}`,
		`- Début : ${report.startedAt}, fin : ${report.finishedAt}`,
		`- Mode : ${report.args.offline ? 'hors ligne (cache)' : 'en ligne'}${report.args.dryRun ? ', essai (rien n’est écrit)' : ''}`,
		''
	);
	for (const [id, s] of Object.entries(report.perSource)) {
		out.push(`## Source \`${id}\` : ${STATUS_LABELS[s.status]}`, '');
		out.push(`${s.pages} pages, ${s.failures} échec(s).`);
		if (s.message) out.push('', s.message);
		const reasons = Object.entries(s.reasons);
		if (reasons.length > 0) {
			out.push('', '| Raison | Pages |', '|---|---|');
			for (const [reason, n] of reasons.sort((a, b) => b[1] - a[1])) {
				out.push(`| ${cell(reason)} | ${n} |`);
			}
		}
		out.push('');
	}
	for (const [hymnal, h] of Object.entries(report.perHymnal)) {
		out.push(`## Recueil \`${hymnal}\``, '');
		out.push('| | Nombre |', '|---|---|');
		for (const [key, title] of SECTION_TITLES) {
			out.push(`| ${title} | ${(h[key] as unknown[]).length} |`);
		}
		out.push(`| Inchangés | ${h.unchanged.length} |`, '');
		const stripped = Object.entries(h.strippedMarkup);
		if (stripped.length > 0) {
			out.push(
				`Balisage retiré des paroles : ${stripped.map(([k, n]) => `${k} × ${n}`).join(', ')}.`,
				''
			);
		}
		for (const [key, title] of SECTION_TITLES) {
			const lines = rows(key, h);
			if (lines.length === 0) continue;
			out.push(`### ${title}`, '', '| N° | Détail | |', '|---|---|---|', ...lines, '');
		}
	}
	if (report.rights) {
		out.push('## Droits après l’import', '', '| Recueil | Publiés | Non publiés |', '|---|---|---|');
		for (const [hymnal, r] of Object.entries(report.rights)) {
			out.push(`| ${hymnal} | ${r.published} | ${r.unpublished} |`);
		}
		out.push('');
	}
	return out.join('\n').replace(/\n+$/, '\n');
}

export async function writeReport(root: string, report: RunReport) {
	const dir = join(root, REPORTS_DIR);
	await writeJsonStable(join(dir, `${report.runId}.json`), report);
	await writeTextAtomic(join(dir, `${report.runId}.md`), renderMarkdown(report));
}

export async function loadReport(root: string, runId?: string): Promise<RunReport | undefined> {
	const dir = join(root, REPORTS_DIR);
	let id = runId;
	if (!id) {
		const names = await readdir(dir).catch(() => [] as string[]);
		id = names
			.filter((n) => n.endsWith('.json'))
			.sort()
			.at(-1)
			?.replace(/\.json$/, '');
	}
	if (!id) return undefined;
	return readJson<RunReport>(join(dir, `${id}.json`)).catch(() => undefined);
}
