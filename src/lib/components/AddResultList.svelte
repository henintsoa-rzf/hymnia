<!--
  Search results with an add / added toggle per hymn (feature 003, contracts/ui.md "Add hymns").
  Same results and messages as the search screen; "added" compares hymns, not references.
-->
<script lang="ts">
	import type { PublishedHymnal } from '$lib/domain/schema';
	import { frenchSpaces } from '$lib/format';
	import type { SearchResponse, SearchResult } from '$lib/search/types';
	import Icon from './Icon.svelte';
	import ResultList from './ResultList.svelte';

	let {
		response,
		hymnals,
		filterActive = false,
		onclearfilter,
		isAdded,
		ontoggle
	}: {
		response: SearchResponse;
		hymnals: Map<string, PublishedHymnal>;
		filterActive?: boolean;
		onclearfilter?: () => void;
		isAdded: (result: SearchResult) => boolean;
		ontoggle: (result: SearchResult) => void;
	} = $props();
</script>

{#snippet toggle(result: SearchResult)}
	{@const added = isAdded(result)}
	<button
		type="button"
		class="hb-icon-btn add-toggle"
		class:is-added={added}
		aria-pressed={added}
		aria-label={frenchSpaces(`${added ? 'Retirer' : 'Ajouter'} « ${result.title} »`)}
		onclick={() => ontoggle(result)}
	>
		<Icon name={added ? 'check' : 'plus'} />
	</button>
{/snippet}

<ResultList {response} {hymnals} {filterActive} {onclearfilter} action={toggle} />

<style>
	.add-toggle {
		border: 1px solid var(--line-strong);
		color: var(--rubric);
	}

	.add-toggle.is-added {
		border-color: var(--rubric);
		background: var(--rubric-soft);
	}

	.add-toggle.is-added :global(svg) {
		fill: none;
	}
</style>
