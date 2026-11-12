// Command-line frame (contracts/cli.md, task T022).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main, type Io } from '../../../scripts/import/cli';
import { makeWorkspace } from '../helpers/workspace';

function capture() {
	const out: string[] = [];
	const err: string[] = [];
	const io: Io = { out: (t) => out.push(t), err: (t) => err.push(t) };
	return { io, out, err };
}

describe('hymnia-import', () => {
	it('lists every subcommand with --help', async () => {
		const { io, out } = capture();
		expect(await main(['--help'], io)).toBe(0);
		const text = out.join('\n');
		for (const name of [
			'run',
			'report',
			'pending',
			'accept',
			'reject',
			'duplicates',
			'merge',
			'distinct',
			'rights set',
			'rights list',
			'check',
			'add-pages'
		]) {
			expect(text).toContain(name);
		}
	});

	it('exits with 2 on usage errors', async () => {
		const { io, err } = capture();
		expect(await main([], io)).toBe(2);
		expect(await main(['nope'], io)).toBe(2);
		expect(await main(['run', '--unknown'], io)).toBe(2);
		expect(await main(['merge', 'only-one'], io)).toBe(2);
		expect(err.join('\n')).toMatch(/Usage/);
	});

	it('prints the usage of one subcommand', async () => {
		const { io, out } = capture();
		expect(await main(['rights', 'set', '--help'], io)).toBe(0);
		expect(out.join('\n')).toMatch(/--scope/);
	});

	it('add-pages: usage errors exit 2, all refused exits 1, usable pages exit 0 with counts', async () => {
		const root = await makeWorkspace();
		const { io, out, err } = capture();
		const inbox = join(root, 'inbox');
		await mkdir(inbox);
		expect(await main(['add-pages', inbox], io, root)).toBe(2);
		expect(await main(['add-pages', '--source', 'nope', inbox], io, root)).toBe(2);
		expect(await main(['add-pages', '--source', 'cdl', join(root, 'missing')], io, root)).toBe(2);

		await writeFile(join(inbox, 'bad.html'), '<html><body>no url</body></html>');
		expect(await main(['add-pages', '--source', 'cdl', inbox], io, root)).toBe(1);
		expect(out.join('\n')).toMatch(/bad\.html: no url/);

		const url = 'https://www.conducteurdelouange.com/chants/consulter/245';
		await writeFile(
			join(inbox, 'good.html'),
			`<!-- saved from url=(${String(url.length).padStart(4, '0')})${url} -->\n<html><body>x</body></html>`
		);
		expect(await main(['add-pages', '--source', 'cdl', inbox], io, root)).toBe(0);
		expect(out.join('\n')).toMatch(/added 1, replaced 0, unchanged 0, refused 1/);
		expect(err.join('\n')).toMatch(/Usage/);
	});

	it('pending, accept and reject work on a workspace (exit 1 when there is nothing to accept)', async () => {
		const root = await makeWorkspace();
		const { io, out, err } = capture();
		expect(await main(['pending'], io, root)).toBe(0);
		expect(out.join('\n')).toMatch(/No pending change/);
		expect(await main(['accept', 'inconnu'], io, root)).toBe(1);
		expect(err.join('\n')).toMatch(/No pending change for "inconnu"/);
	});
});
