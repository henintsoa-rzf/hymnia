<!--
  Search screen `/` (T036, T050, T061; contracts/routes.md; decisions §4.1).
  The field is focused on load; results come while typing. The query and the hymnal filter are
  kept in the URL (?q=…&recueils=…), so a search can be shared and the back button returns to it.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { get } from 'svelte/store';
	import HymnalFilter from '$lib/components/HymnalFilter.svelte';
	import HymnalList from '$lib/components/HymnalList.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ResultList from '$lib/components/ResultList.svelte';
	import SearchBox from '$lib/components/SearchBox.svelte';
	import { hymnUrl, refLabel } from '$lib/format';
	import { prefs } from '$lib/prefs/prefs';
	import { getSearchClient } from '$lib/search/session';
	import type { SearchResponse } from '$lib/search/types';

	let { data } = $props();

	const hymnals = $derived(data.catalog.getHymnals());
	const hymnalMap = $derived(new Map(hymnals.map((h) => [h.id, h])));

	// Initial state: the URL first (shared link, back button), then the saved filter.
	const known = untrack(() => new Set(data.catalog.getHymnals().map((h) => h.id)));
	const params = page.url.searchParams;
	let query = $state(params.get('q') ?? '');
	let selected = $state<string[]>(
		(params.has('recueils')
			? (params.get('recueils') ?? '').split(',')
			: get(prefs).hymnalFilter
		).filter((id) => known.has(id))
	);

	let input = $state<HTMLInputElement>();
	let response = $state<SearchResponse | null>(null);
	let unavailable = $state(false);

	const client = getSearchClient();
	client.ready.catch(() => (unavailable = true));

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
			// A real (not shallow) URL change, so the back button comes back to this search.
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- same page, only the query changes
			goto(url, { replaceState: true, keepFocus: true, noScroll: true });
		}
		prefs.update((p) => ({ ...p, hymnalFilter: filter }));

		const id = ++latest;
		if (!q.trim()) {
			response = null;
			return;
		}
		client.search({ query: q, hymnals: filter }).then((r) => {
			if (r && id === latest) response = r;
		});
	});

	const first = $derived(response?.results[0]);

	/** Short summary for screen readers (aria-live). */
	const status = $derived.by(() => {
		if (!response || !query.trim()) return '';
		if (response.kind === 'hymnal-number' && first) {
			const h = hymnalMap.get(first.primaryRef.hymnal);
			return `${refLabel(h?.abbreviations[0] ?? '', first.primaryRef.number)}, ${first.title}`;
		}
		const n = response.results.length;
		return n === 0 ? 'Aucun résultat' : `${n} ${n > 1 ? 'chants' : 'chant'}`;
	});

	function openFirst() {
		if (first) goto(hymnUrl(first.primaryRef.hymnal, first.primaryRef.number));
	}

	function onkeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		const typing = target?.closest('input, textarea, select, [contenteditable]');
		if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
			event.preventDefault();
			input?.focus();
			input?.select();
		}
	}
</script>

<svelte:window {onkeydown} />
<svelte:head><title>Hymnia · Recherche</title></svelte:head>

<div class="page search">
	<div class="search__main">
		<header class="page__header search__header">
			<h1 class="hy-screen-title search__title">Recherche</h1>
			<a class="hb-icon-btn mobile-only" href={resolve('/reglages')} aria-label="Réglages">
				<Icon name="settings" />
			</a>
		</header>

		<div class="search__controls">
			<SearchBox bind:value={query} bind:input onsubmit={openFirst} />
			{#if hymnals.length > 1}
				<HymnalFilter {hymnals} bind:selected />
			{/if}
		</div>

		<p class="hb-sr" aria-live="polite">{status}</p>

		<div class="search__results">
			{#if !query.trim()}
				<p class="hy-caption search__help">
					Tapez un numéro («&#8239;CE&nbsp;12&#8239;»), un titre ou quelques mots des paroles.
				</p>
				<div class="mobile-only">
					<h2 class="hb-overline" id="hymnals-title">Recueils</h2>
					<HymnalList {hymnals} labelledby="hymnals-title" />
				</div>
			{:else if unavailable}
				<div class="hy-message" role="status">
					<p class="hy-message__title">La recherche n’a pas pu démarrer</p>
					<p class="hy-message__text">Rechargez la page. Les recueils restent consultables.</p>
				</div>
			{:else if response}
				<ResultList
					{response}
					hymnals={hymnalMap}
					filterActive={selected.length > 0}
					onclearfilter={() => (selected = [])}
				/>
			{/if}
		</div>
	</div>

	<aside class="search__aside desktop-only" aria-labelledby="aside-hymnals-title">
		<h2 class="hb-overline" id="aside-hymnals-title">Recueils</h2>
		<HymnalList {hymnals} labelledby="aside-hymnals-title" />
		<p class="hy-caption search__keys">
			Au clavier&#8239;: <kbd>/</kbd> place le curseur dans la recherche, <kbd>Entrée</kbd> ouvre le premier
			résultat.
		</p>
	</aside>
</div>

<style>
	.search {
		display: flex;
		flex-wrap: wrap;
		gap: 0 48px;
	}

	.search__main {
		flex: 999 1 560px;
		min-width: 0;
	}

	.search__aside {
		flex: 1 1 260px;
		min-width: 0;
		padding-top: 140px;
	}

	.search__controls {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px 0 4px;
	}

	.search__title {
		flex-grow: 1;
	}

	.search__help {
		margin-top: 8px;
	}

	.search__keys {
		margin-top: 24px;
	}

	kbd {
		padding: 1px 6px;
		border: 1px solid var(--line-strong);
		border-radius: 4px;
		font-family: var(--font-sans);
		color: var(--ink);
	}

	@media (min-width: 1024px) {
		.search {
			padding-top: 32px;
		}

		.search__title {
			font-size: 28px;
			line-height: 36px;
		}
	}
</style>
