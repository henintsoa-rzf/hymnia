import { describe, expect, it } from 'vitest';
import type { Section } from '$lib/domain/schema';
import { layoutSections, type Block } from '$lib/lyrics/layout';

// Feature 016 (FR-012, research R5): chorus printed once, or after each stanza.
const verse = (n: number): Section => ({ type: 'verse', number: n, lines: [`Strophe ${n}`] });
const chorus = (text = 'Refrain'): Section => ({ type: 'chorus', number: null, lines: [text] });
const bridge: Section = { type: 'bridge', number: null, lines: ['Pont'] };

/** « v1 », « c », « c* » (repeat), « b »… with the source index. */
const shape = (blocks: Block[]) =>
	blocks.map(
		(b) =>
			`${b.section.type === 'verse' ? `v${b.section.number}` : b.section.type[0]}${b.repeat ? '*' : ''}@${b.index}`
	);

describe('layoutSections, once (current layout)', () => {
	it('prints an identical chorus only once', () => {
		const s = [verse(1), chorus(), verse(2), chorus(), verse(3)];
		expect(shape(layoutSections(s, { chorus: 'once' }))).toEqual(['v1@0', 'c@1', 'v2@2', 'v3@4']);
	});

	it('prints a chorus again where its words change', () => {
		const s = [verse(1), chorus('A'), verse(2), chorus('B'), verse(3), chorus('B')];
		expect(shape(layoutSections(s, { chorus: 'once' }))).toEqual([
			'v1@0',
			'c@1',
			'v2@2',
			'c@3',
			'v3@4'
		]);
	});

	it('never marks a block as a repeat', () => {
		const s = [verse(1), chorus(), verse(2)];
		expect(layoutSections(s, { chorus: 'once' }).some((b) => b.repeat)).toBe(false);
	});
});

describe('layoutSections, each', () => {
	it('repeats the chorus after every later stanza', () => {
		const s = [verse(1), chorus(), verse(2), verse(3)];
		expect(shape(layoutSections(s, { chorus: 'each' }))).toEqual([
			'v1@0',
			'c@1',
			'v2@2',
			'c*@1',
			'v3@3',
			'c*@1'
		]);
	});

	it('repeats a chorus that comes first', () => {
		const s = [chorus(), verse(1), verse(2)];
		expect(shape(layoutSections(s, { chorus: 'each' }))).toEqual([
			'c@0',
			'v1@1',
			'c*@0',
			'v2@2',
			'c*@0'
		]);
	});

	it('leaves a hymn with no chorus unchanged', () => {
		const s = [verse(1), verse(2), bridge];
		expect(shape(layoutSections(s, { chorus: 'each' }))).toEqual(['v1@0', 'v2@1', 'b@2']);
	});

	it('repeats the last chorus printed before each stanza', () => {
		const s = [verse(1), chorus('A'), verse(2), verse(3), chorus('B'), verse(4)];
		const blocks = layoutSections(s, { chorus: 'each' });
		expect(shape(blocks)).toEqual(['v1@0', 'c@1', 'v2@2', 'c*@1', 'v3@3', 'c@4', 'v4@5', 'c*@4']);
	});

	it('adds nothing after a stanza already followed by a chorus, and keeps every source section', () => {
		const s = [verse(1), chorus(), verse(2), chorus(), verse(3)];
		expect(shape(layoutSections(s, { chorus: 'each' }))).toEqual([
			'v1@0',
			'c@1',
			'v2@2',
			'c@3',
			'v3@4',
			'c*@3'
		]);
	});

	it('repeats nothing after a bridge or other section', () => {
		const other: Section = { type: 'other', number: null, lines: ['Fin'] };
		const s = [verse(1), chorus(), bridge, other];
		expect(shape(layoutSections(s, { chorus: 'each' }))).toEqual(['v1@0', 'c@1', 'b@2', 'o@3']);
	});

	it('gives every block a unique key', () => {
		const s = [chorus(), verse(1), verse(2), verse(3)];
		const keys = layoutSections(s, { chorus: 'each' }).map((b) => b.key);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
