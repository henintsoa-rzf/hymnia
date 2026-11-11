<!--
  Add hymns to a collection `/repertoire/<id>/ajouter` (feature 003, US1; contracts/ui.md
  "Add hymns"): the search of the search screen, with an add / added toggle per hymn. The query
  is never cleared by adding, so several hymns can be added in a row.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import AddResultList from '$lib/components/AddResultList.svelte';
	import HymnalFilter from '$lib/components/HymnalFilter.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import NotFound from '$lib/components/NotFound.svelte';
	import SearchBox from '$lib/components/SearchBox.svelte';
	import { frenchSpaces } from '$lib/format';
	import { hasHymn } from '$lib/repertoire/model';
	import { hymnIdOf } from '$lib/repertoire/resolve';
	import { repertoire } from '$lib/repertoire/store';
	import { getSearchClient } from '$lib/search/session';
	import type { SearchResponse, SearchResult } from '$lib/search/types';

	let { data } = $props();

	const collection = $derived($repertoire.collections.find((c) => c.id === data.id));
	const hymnals = $derived(data.catalog.getHymnals());
	const hymnalMap = $derived(new Map(hymnals.map((h) => [h.id, h])));
	const idOf = $derived(hymnIdOf(data.catalog));
	const collectionUrl = $derived(resolve('/repertoire/[collection]', { collection: data.id }));

	const known = untrack(() => new Set(data.catalog.getHymnals().map((h) => h.id)));
	const params = page.url.searchParams;
	let query = $state(params.get('q') ?? '');
	let selected = $state<string[]>(
		(params.get('recueils') ?? '').split(',').filter((id) => known.has(id))
	);
	let input = $state<HTMLInputElement>();
	let response = $state<SearchResponse | null>(null);
	let status = $state('');
	/** Hymns added during this visit (for "Terminé (n)"). */
	let addedHere = $state<string[]>([]);

	const client = getSearchClient();

	let latest = 0;
	$effect(() => {
		const q = query;
		const filter = [...selected];
		const url = new URL(window.location.href);
		if (q) url.searchParams.set('q', q);
		else url.searchParams.delete('q');
		if (filter.length > 0) url.searchParams.set('recueils', filter.join(','));
		else url.searchParams.delete('recueils');
		if (url.href !== window.location.href) {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- same page, only the query changes
			goto(url, { replaceState: true, keepFocus: true, noScroll: true });
		}
		const id = ++latest;
		if (!q.trim()) {
			response = null;
			return;
		}
		client.search({ query: q, hymnals: filter }).then((r) => {
			if (r && id === latest) response = r;
		});
	});

	const isAdded = (result: SearchResult) =>
		collection !== undefined && hasHymn(collection, result.primaryRef, idOf);

	function ontoggle(result: SearchResult) {
		if (!collection) return;
		const outcome = repertoire.toggle(collection.id, result.primaryRef, idOf);
		if (outcome === 'added') {
			addedHere = [...addedHere, result.hymnId];
			status = frenchSpaces(`« ${result.title} » ajouté à ${collection.name}`);
		} else if (outcome === 'removed') {
			addedHere = addedHere.filter((id) => id !== result.hymnId);
			status = frenchSpaces(`« ${result.title} » retiré de ${collection.name}`);
		}
	}
</script>

<svelte:head>
	{#if collection}<title>Ajouter à {collection.name} · Hymnia</title>{/if}
</svelte:head>

{#if collection}
	<div class="page add">
		<header class="page__header page__header--back">
			<a class="hb-icon-btn" href={collectionUrl} aria-label={`Retour à ${collection.name}`}>
				<Icon name="back" />
			</a>
			<span class="page__back-label">{collection.name}</span>
			<a class="hb-btn hb-btn--primary add__done" href={collectionUrl}>
				Terminé{addedHere.length > 0 ? ` (${addedHere.length})` : ''}
			</a>
		</header>

		<h1 class="hy-screen-title">Ajouter des chants</h1>

		<div class="add__controls">
			<SearchBox bind:value={query} bind:input />
			{#if hymnals.length > 1}
				<HymnalFilter {hymnals} bind:selected />
			{/if}
		</div>

		<p class="hb-sr" aria-live="polite">{status}</p>

		{#if !query.trim()}
			<p class="hy-caption add__help">
				Cherchez par numéro («&#8239;CE&nbsp;12&#8239;»), titre ou paroles, puis touchez + pour
				ajouter un chant à «&#8239;{collection.name}&#8239;».
			</p>
		{:else if response}
			<AddResultList
				{response}
				hymnals={hymnalMap}
				filterActive={selected.length > 0}
				onclearfilter={() => (selected = [])}
				{isAdded}
				{ontoggle}
			/>
		{/if}
	</div>
{:else}
	<div class="page">
		<NotFound
			title="Collection introuvable"
			text="Cette collection n’existe pas ou a été supprimée."
			back={{ href: resolve('/repertoire'), label: 'Retour au répertoire' }}
		/>
	</div>
{/if}

<style>
	.add {
		max-width: 720px;
	}

	.add__done {
		margin-left: auto;
	}

	.add__controls {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px 0 4px;
	}

	.add__help {
		margin-top: 8px;
	}

	@media (min-width: 1024px) {
		.add {
			padding-top: 16px;
		}
	}
</style>
