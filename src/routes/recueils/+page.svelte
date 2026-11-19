<!--
  Hymnals `/recueils` (T048, FR-011, decisions §5). Feature 009: in alphabetical order of name.
  Feature 014: hymnals left out in Settings are not listed; a hymnal partly in use shows the count
  of its hymns in use.
-->
<script lang="ts">
	import HymnalList from '$lib/components/HymnalList.svelte';
	import { prefs } from '$lib/prefs/prefs';
	import { createScope } from '$lib/scope/scope';

	let { data } = $props();

	const scope = $derived(createScope($prefs.excluded, data.catalog.getHymnals()));
	const hymnals = $derived(
		data.catalog.getHymnalsByName().filter((h) => scope.hymnalState(h.id) !== 'none')
	);
	const counts = $derived(
		new Map(
			hymnals
				.filter((h) => scope.hymnalState(h.id) === 'some')
				.map((h) => [
					h.id,
					data.catalog.listEntries(h.id).filter((r) => scope.includesEntry(r.entry)).length
				])
		)
	);
</script>

<svelte:head><title>Recueils · Hymnia</title></svelte:head>

<div class="page hymnals">
	<header class="page__header">
		<h1 class="hy-screen-title" id="hymnals-title">Recueils</h1>
	</header>
	<HymnalList {hymnals} {counts} labelledby="hymnals-title" />
</div>

<style>
	.hymnals {
		max-width: 720px;
	}

	.hymnals :global(.hymnal-list) {
		margin-top: 16px;
	}

	@media (min-width: 1024px) {
		.hymnals {
			padding-top: 32px;
		}
	}
</style>
