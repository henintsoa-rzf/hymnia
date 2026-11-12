/**
 * Subcommands of hymnia-import (contracts/cli.md). Each one is registered here; the work is
 * done in pipeline/ and store/.
 */
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkImport } from './check';
import { addSavedPages } from './saved-pages';
import { loadContentIndex } from './pipeline/content';
import { findDuplicates } from './pipeline/match';
import { markDistinct, mergeHymns } from './pipeline/merge';
import { acceptChange, rejectChange } from './pipeline/pending';
import { listRights, setRights } from './pipeline/rights';
import { RightsDecisionSchema } from './store/state';
import { runImport } from './pipeline/run';
import { loadPending, loadState } from './store/state';

const today = () => new Date().toISOString().slice(0, 10);
import { importHooks } from './pipeline/hooks';
import { loadReport, renderMarkdown, type RunReport } from './report';
import { registerCommand, UsageError, type CommandContext } from './registry';

const str = (ctx: CommandContext, name: string) => {
	const value = ctx.values[name];
	return typeof value === 'string' ? value : undefined;
};

function summary(report: RunReport): string {
	const lines: string[] = [];
	for (const [id, s] of Object.entries(report.perSource)) {
		lines.push(`${s.status === 'ok' ? '✓' : '✗'} ${id}: ${s.status}, ${s.pages} pages, ${s.failures} failure(s)`);
		if (s.message) lines.push(`  ${s.message}`);
	}
	for (const [hymnal, h] of Object.entries(report.perHymnal)) {
		lines.push(
			`  ${hymnal}: ${h.new.length} new, ${h.changed.length} changed (pending), ` +
				`${h.unchanged.length} unchanged, ${h.autoMerged.length} merged, ` +
				`${h.possibleDuplicates.length} possible duplicates, ${h.skipped.length} skipped, ` +
				`${h.missing.length} missing, ${h.conflicts.length} conflicts`
		);
	}
	lines.push(`Report: import/reports/${report.runId}.md`);
	return lines.join('\n');
}

registerCommand('run', {
	usage: 'run --source <id> [--hymnal <id>…] [--offline] [--dry-run] [--yes]',
	summary: 'Fetch (or read the cache), extract, match and write one source.',
	options: {
		source: { type: 'string' },
		hymnal: { type: 'string', multiple: true },
		offline: { type: 'boolean', default: false },
		'dry-run': { type: 'boolean', default: false },
		yes: { type: 'boolean', default: false }
	},
	async run(ctx) {
		const source = str(ctx, 'source');
		if (!source) throw new UsageError('--source is required');
		const known = (await loadState(ctx.root)).sources.map((s) => s.id);
		if (!known.includes(source)) {
			throw new UsageError(`Unknown source "${source}" (known: ${known.join(', ')})`);
		}
		const hymnals = ctx.values.hymnal as string[] | undefined;
		const report = await runImport({
			root: ctx.root,
			source,
			hymnals: hymnals?.length ? hymnals : undefined,
			offline: ctx.values.offline === true,
			dryRun: ctx.values['dry-run'] === true,
			yes: ctx.values.yes === true,
			log: (m) => ctx.io.err(m),
			hooks: importHooks
		});
		ctx.io.out(ctx.json ? JSON.stringify(report, null, 2) : summary(report));
		return Object.values(report.perSource).every((s) => s.status === 'ok') ? 0 : 1;
	}
});

registerCommand('report', {
	usage: 'report [<runId>]',
	summary: 'Print a run report (the latest by default).',
	positionals: [0, 1],
	async run(ctx) {
		const report = await loadReport(ctx.root, ctx.positionals[0]);
		if (!report) {
			ctx.io.err(ctx.positionals[0] ? `No report "${ctx.positionals[0]}".` : 'No report yet.');
			return 1;
		}
		ctx.io.out(ctx.json ? JSON.stringify(report, null, 2) : renderMarkdown(report));
		return 0;
	}
});

registerCommand('pending', {
	usage: 'pending',
	summary: 'List pending changes with their diffs.',
	async run(ctx) {
		const pending = await loadPending(ctx.root);
		if (ctx.json) {
			ctx.io.out(JSON.stringify(pending, null, 2));
			return 0;
		}
		if (pending.length === 0) {
			ctx.io.out('No pending change.');
			return 0;
		}
		const color = process.stdout.isTTY === true;
		const paint = (line: string) =>
			!color
				? line
				: line.startsWith('+') && !line.startsWith('+++')
					? `\x1b[32m${line}\x1b[0m`
					: line.startsWith('-') && !line.startsWith('---')
						? `\x1b[31m${line}\x1b[0m`
						: line;
		for (const p of pending) {
			ctx.io.out(`\n${p.hymnId} — ${p.source} ${p.hymnal} ${p.number}, detected ${p.detectedAt}`);
			ctx.io.out(p.diff.split('\n').map(paint).join('\n'));
		}
		ctx.io.out(`\n${pending.length} pending change(s). Use accept <hymnId> or reject <hymnId>.`);
		return 0;
	}
});

for (const name of ['accept', 'reject'] as const) {
	registerCommand(name, {
		usage: `${name} <hymnId> [--source <id>]`,
		summary: name === 'accept' ? 'Apply a pending change.' : 'Dismiss a pending change.',
		options: { source: { type: 'string' } },
		positionals: [1, 1],
		async run(ctx) {
			const [hymnId] = ctx.positionals;
			const source = str(ctx, 'source');
			if (name === 'accept') {
				const { hymn } = await acceptChange(ctx.root, hymnId, source);
				ctx.io.out(`✓ ${hymnId}: source text accepted (${hymn.title}).`);
			} else {
				await rejectChange(ctx.root, hymnId, source);
				ctx.io.out(`✓ ${hymnId}: change dismissed; the stored text is kept.`);
			}
			return 0;
		}
	});
}

registerCommand('duplicates', {
	usage: 'duplicates',
	summary: 'List possible duplicates not yet decided.',
	async run(ctx) {
		const content = await loadContentIndex(ctx.root);
		const state = await loadState(ctx.root);
		const pairs = findDuplicates(content, state.merges);
		if (ctx.json) {
			ctx.io.out(JSON.stringify(pairs, null, 2));
			return 0;
		}
		if (pairs.length === 0) {
			ctx.io.out('No undecided possible duplicate.');
			return 0;
		}
		const label = (id: string) => {
			const h = content.hymns.get(id)!;
			return `${id} — ${h.title} (${h.entries.map((e) => `${e.hymnal} ${e.number}`).join(', ')})`;
		};
		for (const p of pairs) {
			ctx.io.out(`\n${p.reason}, lyrics similarity ${p.similarity.toFixed(2)}`);
			ctx.io.out(`  a: ${label(p.a)}\n  b: ${label(p.b)}`);
		}
		ctx.io.out(`\n${pairs.length} pair(s). Use merge <a> <b> or distinct <a> <b>.`);
		return 0;
	}
});

for (const name of ['merge', 'distinct'] as const) {
	registerCommand(name, {
		usage: `${name} <hymnIdA> <hymnIdB>`,
		summary:
			name === 'merge'
				? 'Merge hymn B into hymn A (content is rewritten now).'
				: 'Record that two hymns are distinct.',
		positionals: [2, 2],
		async run(ctx) {
			const [a, b] = ctx.positionals;
			if (name === 'merge') {
				const merged = await mergeHymns(ctx.root, a, b, today());
				ctx.io.out(`✓ ${b} merged into ${a}: ${merged.entries.map((e) => `${e.hymnal} ${e.number}`).join(', ')}.`);
			} else {
				await markDistinct(ctx.root, a, b, today());
				ctx.io.out(`✓ ${a} and ${b} recorded as distinct hymns.`);
			}
			return 0;
		}
	});
}

registerCommand('rights set', {
	usage:
		'rights set --scope <source|hymnal|hymn> --target <id> --basis <permission|licence|public-domain|refused> [--date YYYY-MM-DD] --note "<text>"',
	summary: 'Record a rights decision and update the rights of the hymns it covers.',
	options: {
		scope: { type: 'string' },
		target: { type: 'string' },
		basis: { type: 'string' },
		date: { type: 'string' },
		note: { type: 'string' }
	},
	async run(ctx) {
		for (const name of ['scope', 'target', 'basis', 'note']) {
			if (str(ctx, name) === undefined) throw new UsageError(`--${name} is required`);
		}
		const parsed = RightsDecisionSchema.safeParse({
			scope: str(ctx, 'scope'),
			target: str(ctx, 'target'),
			basis: str(ctx, 'basis'),
			date: str(ctx, 'date') ?? today(),
			note: str(ctx, 'note')
		});
		if (!parsed.success) {
			const issue = parsed.error.issues[0];
			throw new UsageError(`--${String(issue.path[0])}: ${issue.message}`);
		}
		const changed = await setRights(ctx.root, parsed.data);
		const d = parsed.data;
		ctx.io.out(
			`✓ ${d.scope} ${d.target}: ${d.basis} (${d.date}). ${changed.length} hymn(s) changed: ` +
				`${changed.filter((h) => h.rights !== 'unconfirmed').length} now published, ` +
				`${changed.filter((h) => h.rights === 'unconfirmed').length} now unpublished.`
		);
		return 0;
	}
});

registerCommand('rights list', {
	usage: 'rights list',
	summary: 'List rights decisions and how many hymns each one covers.',
	async run(ctx) {
		const decisions = await listRights(ctx.root);
		if (ctx.json) {
			ctx.io.out(JSON.stringify(decisions, null, 2));
			return 0;
		}
		if (decisions.length === 0) {
			ctx.io.out('No rights decision yet: nothing imported is published.');
			return 0;
		}
		for (const d of decisions) {
			ctx.io.out(`${d.scope} ${d.target}: ${d.basis} (${d.date}), ${d.hymns} hymns${d.note ? ` — ${d.note}` : ''}`);
		}
		return 0;
	}
});

registerCommand('check', {
	usage: 'check',
	summary: 'Validate import/ and content/ with no network: schemas, links, decisions, text.',
	async run(ctx) {
		const { errors, warnings, checkedTexts } = await checkImport(ctx.root);
		if (ctx.json) {
			ctx.io.out(JSON.stringify({ errors, warnings, checkedTexts }, null, 2));
		} else {
			for (const w of warnings) ctx.io.out(`⚠ ${w}`);
			for (const e of errors) ctx.io.err(`✗ ${e}`);
			ctx.io.out(
				errors.length === 0
					? `✓ import/ and content/ are valid; ${checkedTexts} imported text(s) match their source.`
					: `✗ ${errors.length} error(s).`
			);
		}
		return errors.length === 0 ? 0 : 1;
	}
});

registerCommand('add-pages', {
	usage: 'add-pages --source <id> <folder> [--dry-run]',
	summary: 'Load pages saved from a browser into the cache of a source (no network).',
	options: {
		source: { type: 'string' },
		'dry-run': { type: 'boolean', default: false }
	},
	positionals: [1, 1],
	async run(ctx) {
		const id = str(ctx, 'source');
		if (!id) throw new UsageError('--source is required');
		const source = (await loadState(ctx.root)).sources.find((s) => s.id === id);
		if (!source) throw new UsageError(`Unknown source "${id}" (see import/sources.json)`);
		const folder = resolve(ctx.root, ctx.positionals[0]);
		if (!(await stat(folder).catch(() => null))?.isDirectory()) {
			throw new UsageError(`No folder ${folder}`);
		}
		const dryRun = ctx.values['dry-run'] === true;
		const { files, counts } = await addSavedPages({ root: ctx.root, source, folder, dryRun });
		if (ctx.json) {
			ctx.io.out(JSON.stringify({ dryRun, files, counts }, null, 2));
		} else {
			for (const f of files.filter((f) => f.outcome === 'refused')) {
				ctx.io.out(`✗ ${f.file}: ${f.reason}${f.url ? ` (${f.url})` : ''}`);
			}
			ctx.io.out(
				`${dryRun ? '(dry run) ' : ''}${source.id}: added ${counts.added}, replaced ${counts.replaced}, ` +
					`unchanged ${counts.unchanged}, refused ${counts.refused}`
			);
		}
		// An empty folder or one where every file was refused loaded nothing.
		return counts.refused === files.length ? 1 : 0;
	}
});
