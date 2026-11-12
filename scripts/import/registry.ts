/**
 * Subcommand registry of hymnia-import (contracts/cli.md). Kept apart from cli.ts so that the
 * subcommands (commands.ts) and the entry point import it without a cycle.
 */
import type { ParseArgsConfig } from 'node:util';

export type Io = { out: (text: string) => void; err: (text: string) => void };

export type CommandContext = {
	/** Repository root (holds content/ and import/). */
	root: string;
	positionals: string[];
	values: Record<string, string | boolean | (string | boolean)[] | undefined>;
	json: boolean;
	io: Io;
};

export type Command = {
	usage: string;
	summary: string;
	options?: ParseArgsConfig['options'];
	/** Number of positional arguments: [min, max]. */
	positionals?: [number, number];
	run(ctx: CommandContext): Promise<number>;
};

export class UsageError extends Error {}

const commands = new Map<string, Command>();

export function registerCommand(name: string, command: Command) {
	commands.set(name, command);
}

export function getCommands(): ReadonlyMap<string, Command> {
	return commands;
}
