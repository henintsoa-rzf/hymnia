<!--
  One printed block of a hymn (feature 016, research R5), shared by the hymn view and the Lecture
  preview. With `numbers` off, the verse number is only read by screen readers (FR-011). A
  repeated chorus is never the matching passage of a search by meaning (feature 013).
-->
<script lang="ts">
	import type { Section } from '$lib/domain/schema';
	import { frenchSpaces } from '$lib/format';
	import type { Block } from '$lib/lyrics/layout';

	let {
		block,
		numbers = true,
		marked = false,
		first = false
	}: {
		block: Block;
		numbers?: boolean;
		/** Part of the passage that ranked the hymn (feature 013). */
		marked?: boolean;
		/** First marked block: carries the hidden « Passage correspondant » text. */
		first?: boolean;
	} = $props();

	const LABELS: Partial<Record<Section['type'], string>> = { chorus: 'Refrain', bridge: 'Pont' };
	const section = $derived(block.section);
</script>

<p
	class="hb-stanza"
	class:hb-stanza--refrain={section.type === 'chorus'}
	class:hb-stanza--bridge={section.type === 'bridge'}
	class:hb-stanza--match={marked}
>
	{#if first}
		<span class="hb-sr">Passage correspondant à votre recherche&nbsp;: </span>
	{/if}
	{#if LABELS[section.type]}
		<span class="hb-stanza__label">{LABELS[section.type]}</span>
	{:else if section.type === 'verse' && section.number !== null}
		{#if numbers}
			<span class="hb-stanza__num"><span class="hb-sr">Strophe&nbsp;</span>{section.number}</span>
		{:else}
			<span class="hb-sr">Strophe&nbsp;{section.number}</span>
		{/if}
	{/if}
	{#each section.lines as line, j (j)}
		<span class="hb-stanza__line">{frenchSpaces(line)}</span>
	{/each}
</p>
