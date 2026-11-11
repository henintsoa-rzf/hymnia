<!--
  Répertoire `/repertoire` (design/decisions.md, D1): hymns bookmarked on this device.
  Favourites and lists are a later feature; until then this is a simple list.
-->
<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import HymnRef from '$lib/components/HymnRef.svelte';
	import { frenchSpaces, hymnUrl } from '$lib/format';
	import { repertoire } from '$lib/repertoire';

	let { data } = $props();

	const items = $derived(
		$repertoire.flatMap((item) => {
			const found = data.catalog.getEntry(item.hymnal, item.number);
			const hymnal = data.catalog.getHymnal(item.hymnal);
			return found && hymnal ? [{ ...found, hymnal }] : [];
		})
	);
</script>

<svelte:head><title>Répertoire · Hymnia</title></svelte:head>

<div class="page repertoire">
	<header class="page__header">
		<h1 class="hy-screen-title" id="repertoire-title">Répertoire</h1>
	</header>

	{#if items.length === 0}
		<EmptyState
			title="Aucun chant dans votre répertoire."
			text="Touchez le signet d’un chant pour l’ajouter ici."
			role={null}
		/>
	{:else}
		<ul class="hb-list" aria-labelledby="repertoire-title">
			{#each items as { hymn, entry, hymnal } (`${entry.hymnal} ${entry.number}`)}
				<li>
					<a class="hy-result" href={hymnUrl(entry.hymnal, entry.number)}>
						<span class="hy-result__head">
							<span class="hy-result__title">{frenchSpaces(hymn.title)}</span>
							<span class="hy-result__refs">
								<HymnRef abbreviation={hymnal.abbreviations[0]} number={entry.number} />
							</span>
						</span>
						<span class="hy-result__meta">{hymnal.name}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.repertoire {
		max-width: 720px;
	}

	@media (min-width: 1024px) {
		.repertoire {
			padding-top: 32px;
		}
	}
</style>
