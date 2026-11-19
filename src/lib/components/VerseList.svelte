<!--
  The verses of a Bible chapter (feature 015, contracts/bible-ui.md §2.3 and §3): one block per
  verse, its number before the text, in the lyrics typography and size. With `ontoggle`, each verse
  is a toggle button (selection for the search from verses); a selected verse gets a tint and a
  bar on its left edge, as the stanza marked by a search by meaning (feature 013), so the state
  never relies on colour alone. `focus` brings a verse into view and marks it
  briefly.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { verseId, type BookCode, type VerseId } from '$lib/bible/books';
	import { frenchSpaces } from '$lib/format';

	let {
		book,
		chapter,
		verses,
		focus,
		selected = new Set<VerseId>(),
		ontoggle
	}: {
		book: BookCode;
		chapter: number;
		verses: string[];
		/** Verse to bring into view (`?v=`). */
		focus?: number;
		selected?: ReadonlySet<VerseId>;
		ontoggle?: (id: VerseId) => void;
	} = $props();

	let target = $state<number>();

	$effect(() => {
		const n = focus;
		if (!n || n > verses.length) return;
		target = n;
		tick().then(() =>
			document.getElementById(`v${n}`)?.scrollIntoView({ block: 'center', behavior: 'instant' })
		);
		const timer = setTimeout(() => (target = undefined), 2000);
		return () => clearTimeout(timer);
	});
</script>

<ol class="verses" lang="fr">
	{#each verses as text, i (i)}
		{@const n = i + 1}
		{@const id = verseId(book, chapter, n)}
		{@const on = selected.has(id)}
		<li id={`v${n}`} class="verse" class:verse--target={target === n}>
			{#if ontoggle}
				<button
					type="button"
					class="verse__body verse__toggle"
					class:verse--selected={on}
					aria-pressed={on}
					onclick={() => ontoggle(id)}
				>
					<span class="verse__num"><span class="hb-sr">Verset </span>{n}</span><span
						class="verse__text">{frenchSpaces(text)}</span
					>
				</button>
			{:else}
				<p class="verse__body">
					<span class="verse__num"><span class="hb-sr">Verset </span>{n}</span><span
						class="verse__text">{frenchSpaces(text)}</span
					>
				</p>
			{/if}
		</li>
	{/each}
</ol>

<style>
	.verses {
		list-style: none;
		margin: 0;
		padding: 0;
		max-width: var(--measure-lyrics);
		font-family: var(--font-serif);
		font-size: var(--lyric);
		line-height: 1.6;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.verse {
		scroll-margin: 96px 0;
		border-radius: var(--radius-sm);
	}

	.verse--target {
		background: var(--mark);
	}

	@media (prefers-reduced-motion: no-preference) {
		.verse {
			transition: background-color 0.6s ease-out;
		}
	}

	.verse__body {
		position: relative;
		display: block;
		margin: 0;
		/* Room for a 3-digit number, at any text size (it scales with --lyric). */
		padding: var(--space-1) var(--space-2) var(--space-1)
			calc(var(--space-2) + var(--space-1) + var(--lyric) * 1.6);
		border-radius: var(--radius-sm);
	}

	.verse__toggle {
		width: 100%;
		min-height: var(--tap-target);
		border: 0;
		background: transparent;
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.verse__toggle:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 0;
	}

	.verse--selected {
		background: var(--rubric-soft);
		box-shadow: inset 4px 0 0 var(--rubric);
	}

	.verse__num {
		position: absolute;
		left: var(--space-2);
		top: var(--space-1);
		font-size: calc(var(--lyric) * 0.7);
		line-height: calc(var(--lyric) * 1.6);
		font-weight: 600;
		color: var(--rubric);
	}

	.verse__text {
		display: block;
		overflow-wrap: break-word;
		-webkit-user-select: text;
		user-select: text;
	}
</style>
