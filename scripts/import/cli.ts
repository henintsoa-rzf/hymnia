/**
 * hymnia-import: command line of the hymnal importer (specs/002-hymnal-import/contracts/cli.md).
 *
 *   npm run import -- <subcommand> [options]
 *
 * Exit codes: 0 success, 1 validation or run failure, 2 usage error. Human output on stdout,
 * errors on stderr; --json prints a machine-readable summary instead.
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import './commands';
import { loadEnv } from './env';
import { getCommands, UsageError, type Io } from './registry';

export type { Io } from './registry';

const commands = getCommands();

function usage(): string {
	const lines = ['Usage: npm run import -- <subcommand> [options]', '', 'Subcommands:'];
	for (const [, c] of [...commands].sort(([a], [b]) => a.localeCompare(b))) {
		lines.push(`  ${c.usage}`, `      ${c.summary}`);
	}
	lines.push('', 'Options for every subcommand: --json (machine-readable output), --help');
	return lines.join('\n');
}

export async function main(
	argv: string[],
	io: Io = { out: (t) => console.log(t), err: (t) => console.error(t) },
	root = process.cwd()
): Promise<number> {
	const [name, ...rest] = argv;
	if (!name || name === '--help' || name === '-h' || name === 'help') {
		io.out(usage());
		return name ? 0 : 2;
	}
	// "rights set" / "rights list" are two-word subcommands.
	const twoWord = rest[0] && commands.has(`${name} ${rest[0]}`) ? `${name} ${rest[0]}` : null;
	const command = commands.get(twoWord ?? name);
	if (!command) {
		io.err(`Unknown subcommand "${name}".\n\n${usage()}`);
		return 2;
	}
	const args = twoWord ? rest.slice(1) : rest;
	if (args.includes('--help') || args.includes('-h')) {
		io.out(`Usage: npm run import -- ${command.usage}\n\n${command.summary}`);
		return 0;
	}

	let parsed: ReturnType<typeof parseArgs>;
	try {
		parsed = parseArgs({
			args,
			allowPositionals: true,
			strict: true,
			options: { ...command.options, json: { type: 'boolean', default: false } }
		});
	} catch (error) {
		io.err(`${(error as Error).message}\nUsage: npm run import -- ${command.usage}`);
		return 2;
	}
	const [min, max] = command.positionals ?? [0, 0];
	if (parsed.positionals.length < min || parsed.positionals.length > max) {
		io.err(`Wrong number of arguments.\nUsage: npm run import -- ${command.usage}`);
		return 2;
	}

	try {
		return await command.run({
			root,
			positionals: parsed.positionals,
			values: parsed.values,
			json: parsed.values.json === true,
			io
		});
	} catch (error) {
		if (error instanceof UsageError) {
			io.err(`${error.message}\nUsage: npm run import -- ${command.usage}`);
			return 2;
		}
		io.err(`✗ ${(error as Error).message}`);
		return 1;
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	loadEnv();
	process.exitCode = await main(process.argv.slice(2));
}
