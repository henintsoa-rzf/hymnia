/**
 * Source adapter registry (contracts/source-adapter.md). Adding a source means adding its
 * adapter here and its entry in import/sources.json; nothing else changes (FR-025).
 */
import type { SourceAdapter } from './types';

const adapters = new Map<string, SourceAdapter>();

export function registerAdapter(adapter: SourceAdapter) {
	adapters.set(adapter.id, adapter);
}

export function getAdapter(id: string): SourceAdapter {
	const adapter = adapters.get(id);
	if (!adapter) {
		const known = [...adapters.keys()].join(', ') || 'none';
		throw new Error(`No adapter for source "${id}" (known: ${known})`);
	}
	return adapter;
}

export function hasAdapter(id: string): boolean {
	return adapters.has(id);
}
