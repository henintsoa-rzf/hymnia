/**
 * What this device keeps for offline use (feature 016, FR-016, FR-017, research R7). The states
 * come from what Cache Storage really holds, whatever the service worker's cache names, plus the
 * download state of the meaning data. Only `probeOffline` touches browser APIs; the rest is pure.
 */
import type { DataManifest } from '../domain/schema';
import type { MeaningState } from '../search/worker';

export type OfflineState = 'ready' | 'downloading' | 'missing';
export type OfflineItemId = 'hymns' | 'bible' | 'meaning';

export const OFFLINE_STATE_LABELS: Record<OfflineState, string> = {
	ready: 'Disponible hors ligne',
	downloading: 'Téléchargement en cours',
	missing: 'Pas encore téléchargé'
};

export type OfflineItemFiles = { id: OfflineItemId; label: string; files: string[] };
export type OfflineItem = { id: OfflineItemId; label: string; state: OfflineState };

export type OfflineStatus = {
	items: OfflineItem[];
	/** False in private mode or without Cache Storage: nothing is kept for offline use. */
	cacheAvailable: boolean;
	/** Bytes the app uses on the device, when the browser reports it. */
	usage?: number;
};

/** What the menu says about offline use, in one line. */
export type OfflineOverview =
	| { kind: 'checking' }
	| { kind: 'ready' }
	| { kind: 'unavailable' }
	| { kind: 'item'; label: string; state: OfflineState };

/** The items of this build and their data files (in `/data/`). */
export function offlineItems(manifest: DataManifest): OfflineItemFiles[] {
	const items: OfflineItemFiles[] = [
		{ id: 'hymns', label: 'Chants et recueils', files: [manifest.catalog, manifest.index] }
	];
	if (manifest.bible) items.push({ id: 'bible', label: 'Bible', files: [manifest.bible.file] });
	if (manifest.meaning) {
		items.push({
			id: 'meaning',
			label: 'Recherche par le sens',
			files: [manifest.meaning.vectors, manifest.meaning.rowMap]
		});
	}
	return items;
}

/** Ready when every file is cached; meaning data being downloaded shows as such. */
export function itemStates(
	items: OfflineItemFiles[],
	cached: ReadonlySet<string>,
	meaningState: MeaningState
): OfflineItem[] {
	return items.map(({ id, label, files }) => {
		const ready = files.every((f) => cached.has(f));
		const state: OfflineState = ready
			? 'ready'
			: id === 'meaning' && meaningState === 'downloading'
				? 'downloading'
				: 'missing';
		return { id, label, state };
	});
}

export function offlineOverview(status: OfflineStatus): OfflineOverview {
	if (!status.cacheAvailable) return { kind: 'unavailable' };
	const first = status.items.find((i) => i.state !== 'ready');
	return first ? { kind: 'item', label: first.label, state: first.state } : { kind: 'ready' };
}

const MB = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatBytes(bytes: number | undefined): string | undefined {
	return bytes === undefined ? undefined : `${MB.format(bytes / 1_000_000)} Mo`;
}

/** Reads Cache Storage and the storage estimate. Never throws. */
export async function probeOffline(
	manifest: DataManifest,
	meaningState: MeaningState,
	base = ''
): Promise<OfflineStatus> {
	const items = offlineItems(manifest);
	const cached = new Set<string>();
	let cacheAvailable = false;
	try {
		if (typeof caches !== 'undefined') {
			await caches.keys(); // throws where Cache Storage is blocked
			cacheAvailable = true;
			const files = items.flatMap((i) => i.files);
			const hits = await Promise.all(
				files.map((f) => caches.match(`${base}/data/${f}`, { ignoreSearch: true }))
			);
			files.forEach((f, i) => hits[i] && cached.add(f));
		}
	} catch {
		cacheAvailable = false;
	}
	let usage: number | undefined;
	try {
		if (cacheAvailable) usage = (await navigator.storage?.estimate?.())?.usage;
	} catch {
		usage = undefined;
	}
	return { items: itemStates(items, cached, meaningState), cacheAvailable, usage };
}
