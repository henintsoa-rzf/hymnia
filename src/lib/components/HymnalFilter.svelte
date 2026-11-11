<!--
  Hymnal filter (T060, FR-010, decisions §4.1): one chip per hymnal, several can be selected,
  a selected chip shows a check mark; one tap clears all.
-->
<script lang="ts">
	import type { PublishedHymnal } from '$lib/domain/schema';
	import Icon from './Icon.svelte';

	let { hymnals, selected = $bindable([]) }: { hymnals: PublishedHymnal[]; selected?: string[] } =
		$props();

	function toggle(id: string) {
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}
</script>

<div class="filter" role="group" aria-label="Filtrer par recueil">
	{#each hymnals as hymnal (hymnal.id)}
		{@const on = selected.includes(hymnal.id)}
		<button type="button" class="hb-chip" aria-pressed={on} onclick={() => toggle(hymnal.id)}>
			{#if on}<Icon name="check" />{/if}
			{hymnal.name}
		</button>
	{/each}
	{#if selected.length > 0}
		<button type="button" class="hb-chip filter__clear" onclick={() => (selected = [])}>
			<Icon name="close" />Tous les recueils
		</button>
	{/if}
</div>

<style>
	.filter {
		display: flex;
		gap: 8px;
		margin: 0 calc(-1 * var(--gutter));
		padding: 2px var(--gutter);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.filter::-webkit-scrollbar {
		display: none;
	}

	.filter > :global(*) {
		flex: none;
	}

	.filter__clear {
		border-color: transparent;
		color: var(--rubric);
	}

	@media (min-width: 1024px) {
		.filter {
			flex-wrap: wrap;
			margin: 0;
			padding: 2px 0;
			overflow: visible;
		}
	}
</style>
