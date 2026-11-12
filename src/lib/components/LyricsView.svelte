<!--
  Lyrics (T035, FR-013, FR-020, decisions §7.1): reference, title, short credits, then the
  sections in source order. Lines are shown exactly as stored (only French spaces before
  punctuation become non-breaking). A chorus is printed once, and again only where its words
  change. Size follows --lyric (reading preferences).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { PublishedHymn, Section } from '$lib/domain/schema';
	import { frenchSpaces, shortCredit } from '$lib/format';

	let {
		hymn,
		reference,
		title = hymn.title,
		children
	}: {
		hymn: PublishedHymn;
		reference: string;
		/** The title the hymnal of `reference` prints (HymnalEntry.title). */
		title?: string;
		children?: Snippet;
	} = $props();

	const blocks = $derived.by(() => {
		const out: Section[] = [];
		let lastChorus: string | undefined;
		for (const section of hymn.sections) {
			if (section.type === 'chorus') {
				const text = section.lines.join('\n');
				if (text === lastChorus) continue;
				lastChorus = text;
			}
			out.push(section);
		}
		return out;
	});

	const credit = $derived(shortCredit(hymn.credits));
	const LABELS: Partial<Record<Section['type'], string>> = { chorus: 'Refrain', bridge: 'Pont' };
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

	{#each blocks as section, i (i)}
		<p
			class="hb-stanza"
			class:hb-stanza--refrain={section.type === 'chorus'}
			class:hb-stanza--bridge={section.type === 'bridge'}
		>
			{#if LABELS[section.type]}
				<span class="hb-stanza__label">{LABELS[section.type]}</span>
			{:else if section.type === 'verse' && section.number !== null}
				<span class="hb-stanza__num"><span class="hb-sr">Strophe&nbsp;</span>{section.number}</span>
			{/if}
			{#each section.lines as line, j (j)}
				<span class="hb-stanza__line">{frenchSpaces(line)}</span>
			{/each}
		</p>
	{/each}

	{@render children?.()}
</article>

<style>
	.lyrics {
		margin: 0 auto;
	}
</style>
