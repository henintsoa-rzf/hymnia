/**
 * « Garder l'écran allumé » (feature 016, FR-013, research R6): the Screen Wake Lock API, held
 * while a hymn is open. The browser drops the lock when the page is hidden; it is asked again
 * when the page comes back. Any refusal (battery saver, permission) is silent: the device just
 * sleeps as usual.
 */

type Sentinel = { release(): Promise<void> };
type WakeLockApi = { request(type: 'screen'): Promise<Sentinel> };

function api(): WakeLockApi | undefined {
	return typeof navigator === 'undefined'
		? undefined
		: (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
}

export function wakeLockSupported(): boolean {
	return api() !== undefined;
}

/** Keeps the screen on until the returned function is called. */
export function keepAwake(): () => void {
	const wakeLock = api();
	if (!wakeLock) return () => {};
	let sentinel: Sentinel | undefined;
	let active = true;

	const request = async () => {
		try {
			const lock = await wakeLock.request('screen');
			if (active) sentinel = lock;
			else await lock.release();
		} catch {
			// Refused: the device keeps its usual sleep delay.
		}
	};
	const onVisible = () => {
		if (document.visibilityState === 'visible') void request();
	};

	void request();
	document.addEventListener('visibilitychange', onVisible);
	return () => {
		active = false;
		document.removeEventListener('visibilitychange', onVisible);
		sentinel?.release().catch(() => {});
		sentinel = undefined;
	};
}
