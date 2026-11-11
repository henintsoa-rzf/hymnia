/**
 * Text size steps (design/decisions.md §7.4): 85, 100, 115, 130, 150, 175 and 200 %.
 * Stored as `prefs.textScale`; any stored value snaps to the nearest step.
 */
export const TEXT_SCALE_STEPS = [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2] as const;

export function nearestStep(scale: number): number {
	let best = 0;
	for (let i = 1; i < TEXT_SCALE_STEPS.length; i++) {
		if (Math.abs(TEXT_SCALE_STEPS[i] - scale) < Math.abs(TEXT_SCALE_STEPS[best] - scale)) best = i;
	}
	return best;
}

/** The next step up (`+1`) or down (`-1`), kept within the range. */
export function stepScale(scale: number, direction: 1 | -1): number {
	const i = Math.min(TEXT_SCALE_STEPS.length - 1, Math.max(0, nearestStep(scale) + direction));
	return TEXT_SCALE_STEPS[i];
}

export function scaleLabel(scale: number): string {
	return `${Math.round(TEXT_SCALE_STEPS[nearestStep(scale)] * 100)}\u00a0%`;
}
