<!-- Hymnals `/recueils` (T048, FR-011, decisions §5). -->
<script lang="ts">
	import HymnalList from '$lib/components/HymnalList.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Recueils · Hymnia</title></svelte:head>

<div class="page hymnals">
	<header class="page__header">
		<h1 class="hy-screen-title" id="hymnals-title">Recueils</h1>
	</header>
	<HymnalList hymnals={data.catalog.getHymnals()} labelledby="hymnals-title" />
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
