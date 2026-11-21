<!-- Réglages › Recueils (feature 016, FR-006): the hymnal and part choice of feature 014. -->
<script lang="ts">
	import HymnalScope from '$lib/components/HymnalScope.svelte';
	import SettingsHeader from '$lib/components/SettingsHeader.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Recueils · Réglages · Hymnia</title></svelte:head>

<div class="page hy-settings">
	<div>
		<SettingsHeader title="Recueils" id="scope-title" />
	</div>

	<section>
		<HymnalScope hymnals={data.catalog.getHymnalsByName()} labelledby="scope-title" />
	</section>
</div>
