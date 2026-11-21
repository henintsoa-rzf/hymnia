<!--
  Lyrics (T035, FR-013, FR-020, decisions §7.1): reference, title, short credits, then the
  sections in source order. Lines are shown exactly as stored (only French spaces before
  punctuation become non-breaking). Size follows --lyric (reading preferences).
  Feature 013: `marked` sections (the stanza that ranked the hymn in a search by meaning) get
  `hb-stanza--match` and, on the first one, a hidden « Passage correspondant à votre recherche ».
  Feature 016 (FR-011, FR-012, research R5): blocks come from `layoutSections` (chorus once, or
  after each stanza) and verse numbers follow the Lecture settings; a repeated chorus is never
  marked.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { PublishedHymn } from '$lib/domain/schema';
	import { frenchSpaces, shortCredit } from '$lib/format';
	import { layoutSections, type Block } from '$lib/lyrics/layout';
	import { prefs } from '$lib/prefs/prefs';
	import Stanza from './Stanza.svelte';

	let {
		hymn,
		reference,
		title = hymn.title,
		marked = [],
		children
	}: {
		hymn: PublishedHymn;
		reference: string;
		/** The title the hymnal of `reference` prints (HymnalEntry.title). */
		title?: string;
		/** Indices in `hymn.sections` to mark (feature 013); each is printed, never a repeat. */
		marked?: number[];
		children?: Snippet;
	} = $props();

	const blocks = $derived(layoutSections(hymn.sections, { chorus: $prefs.chorus }));
	const isMarked = (b: Block) => !b.repeat && marked.includes(b.index);
	const firstMarked = $derived(blocks.find(isMarked)?.key);

	const credit = $derived(shortCredit(hymn.credits));
</script>

<article class="hb-hymn lyrics" lang="fr">
	<header class="hb-header">
		<span class="hb-header__number">{reference}</span>
		<h1 class="hb-header__title">{frenchSpaces(title)}</h1>
		{#if title !== hymn.title}
			<p class="hb-header__also">Aussi : {frenchSpaces(hymn.title)}</p>
		{/if}
		{#if credit}<p class="hb-header__credit">{credit}</p>{/if}
	</header>

	{#each blocks as block (block.key)}
		<Stanza
			{block}
			numbers={$prefs.stanzaNumbers}
			marked={isMarked(block)}
			first={block.key === firstMarked}
		/>
	{/each}

	{@render children?.()}
</article>

<style>
	.lyrics {
		margin: 0 auto;
	}
</style>
