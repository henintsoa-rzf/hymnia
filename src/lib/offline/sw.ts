/**
 * The service worker registration, owned here (feature 016, FR-020, research R8): the update
 * prompt reads `needRefresh`, and Réglages › Hors ligne asks for a check on demand. Nothing is
 * reloaded without the user (T062, FR-018).
 */
import { useRegisterSW } from 'virtual:pwa-register/svelte';

export type UpdateResult = 'update' | 'up-to-date' | 'offline' | 'failed' | 'unavailable';

let registration: ServiceWorkerRegistration | undefined;

export const { needRefresh, updateServiceWorker } = useRegisterSW({
	onRegisteredSW(_url, r) {
		registration = r;
	}
});

const TIMEOUT_MS = 10_000;

/** Asks the server for a newer version of the app and its hymns. */
export async function checkForUpdate(): Promise<UpdateResult> {
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
	try {
		registration ??= await navigator.serviceWorker?.getRegistration();
	} catch {
		registration = undefined;
	}
	if (!registration) return 'unavailable';
	const r = registration;
	try {
		await Promise.race([
			r.update(),
			new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))
		]);
	} catch {
		return navigator.onLine === false ? 'offline' : 'failed';
	}
	return r.installing || r.waiting ? 'update' : 'up-to-date';
}
