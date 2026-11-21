import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	CLEAR_MS,
	MIN_WAIT_MS,
	REVEAL_MS,
	ROW_STAGGER_CAP,
	ROW_STAGGER_MS,
	holdUntil,
	launchPhase,
	listView,
	type RevealPhase
} from '$lib/meaning/reveal';

describe('timings (feature 017, contracts/meaning-reveal.md)', () => {
	it('match the contract', () => {
		expect([CLEAR_MS, MIN_WAIT_MS, REVEAL_MS, ROW_STAGGER_MS, ROW_STAGGER_CAP]).toEqual([
			180, 400, 500, 30, 10
		]);
	});

	it('the slowest row starts and ends within the reveal', () => {
		expect(ROW_STAGGER_CAP * ROW_STAGGER_MS + 160).toBeLessThan(REVEAL_MS);
	});
});

describe('holdUntil: the minimum time between launch and results (research R4)', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('resolves at once when the minimum has passed', async () => {
		const done = vi.fn();
		void holdUntil(0, 400, () => 900).then(done);
		await vi.advanceTimersByTimeAsync(0);
		expect(done).toHaveBeenCalled();
	});

	it('waits for the time left otherwise', async () => {
		const done = vi.fn();
		void holdUntil(0, 400, () => 150).then(done);
		await vi.advanceTimersByTimeAsync(249);
		expect(done).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(done).toHaveBeenCalled();
	});
});

describe('launchPhase: the first step of a launch (data-model.md)', () => {
	it.each<RevealPhase>(['clearing', 'waiting'])('%s: stays, a sequence is already on', (p) => {
		expect(launchPhase(p, true)).toBe(p);
		expect(launchPhase(p, false)).toBe(p);
	});

	it.each<RevealPhase>(['none', 'revealing'])('%s with a list on screen: clears it', (p) => {
		expect(launchPhase(p, true)).toBe('clearing');
	});

	it.each<RevealPhase>(['none', 'revealing'])('%s with nothing on screen: waits', (p) => {
		expect(launchPhase(p, false)).toBe('waiting');
	});
});

describe('listView: what the list area renders', () => {
	it('clearing a list: the list, leaving', () => {
		expect(listView({ reveal: 'clearing', hasList: true })).toBe('leaving-list');
	});

	it('clearing with nothing to clear, or waiting: the placeholder', () => {
		expect(listView({ reveal: 'clearing', hasList: false })).toBe('placeholder');
		expect(listView({ reveal: 'waiting', hasList: true })).toBe('placeholder');
		expect(listView({ reveal: 'waiting', hasList: false })).toBe('placeholder');
	});

	it('revealing: the list, coming in', () => {
		expect(listView({ reveal: 'revealing', hasList: true })).toBe('revealing-list');
	});

	it('no sequence: the list as it is', () => {
		expect(listView({ reveal: 'none', hasList: true })).toBe('list');
		expect(listView({ reveal: 'none', hasList: false })).toBe('none');
		expect(listView({ reveal: 'revealing', hasList: false })).toBe('none');
	});
});
