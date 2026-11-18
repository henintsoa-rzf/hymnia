<!--
  Search screen `/` (T036, T050, T061; contracts/routes.md; decisions §4.1).
  The field is focused on load; results come while typing. The query and the hymnal filter are
  kept in the URL (?q=…&recueils=…), so a search can be shared and the back button returns to it.
  Feature 006: with an empty field, the screen offers the hymns recently opened, recent
  collections and, on a first visit, example searches, in place of the hymnal list
  (specs/006-search-start-panel/contracts/ui.md).
  Feature 011: search by meaning turns the query into a vector online, then ranks on the device
  and shows one blended list (specs/011-semantic-search/contracts/meaning-search.md).
  Feature 012: search by meaning is a mode of the field, kept in the URL (?sens=1). Enter runs it;
  editing the text shows the word results again until the next Enter
  (specs/012-meaning-search-mode/contracts/search-mode.md).
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { get } from 'svelte/store';
	import HymnalFilter from '$lib/components/HymnalFilter.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import MeaningStatus, { type MeaningPhase } from '$lib/components/MeaningStatus.svelte';
	import RecentCollections from '$lib/components/RecentCollections.svelte';
	import RecentHymns from '$lib/components/RecentHymns.svelte';
	import ResultList from '$lib/components/ResultList.svelte';
	import SearchBox from '$lib/components/SearchBox.svelte';
	import SearchExamples from '$lib/components/SearchExamples.svelte';
	import { hymnUrl, refLabel } from '$lib/format';
	import { embedQuery } from '$lib/meaning/embed-client';
	import { decideSubmit, type SearchMode } from '$lib/meaning/mode';
	import { browserQueryCache } from '$lib/meaning/query-cache';
	import { recentHymns } from '$lib/history/resolve';
	import { hymnHistory } from '$lib/history/store';
	import { prefs } from '$lib/prefs/prefs';
	import { byUpdatedDesc } from '$lib/repertoire/model';
	import { repertoire } from '$lib/repertoire/store';
	import { pickExamples } from '$lib/search/examples';
	import { compactKey } from '$lib/search/normalize';
	import { parseQuery } from '$lib/search/query-parser';
	import { getSearchClient } from '$lib/search/session';
	import type { SearchResponse } from '$lib/search/types';

	let { data } = $props();

	const hymnals = $derived(data.catalog.getHymnals());
	/** Filter chips in alphabetical order of name, like the Recueils screen (feature 009). */
	const filterHymnals = $derived(data.catalog.getHymnalsByName());
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

	let input = $state<HTMLTextAreaElement>();
	let response = $state<SearchResponse | null>(null);
	let unavailable = $state(false);

	const client = getSearchClient();
	const meaningStatus = client.meaningStatus;
	let ready = $state(false);
	client.ready.then(
		() => {
			ready = true;
			// A shared or reloaded link with ?sens=1 shows the search by meaning again.
			if (mode === 'meaning' && offersMeaning(query)) void runMeaning();
		},
		() => (unavailable = true)
	);

	/* ---------- search by meaning (features 011, 012) ---------- */

	const meaningAvailable = untrack(() => data.catalog.meaningAvailable);
	/** The field's mode, kept in the URL as ?sens=1 (feature 012, research R7). */
	let mode = $state<SearchMode>(
		meaningAvailable && params.get('sens') === '1' ? 'meaning' : 'word'
	);
	/** The query and filter whose meaning results are shown; null in word mode. */
	let meaningFor = $state<{ query: string; filter: string } | null>(null);
	let meaningResponse = $state<SearchResponse | null>(null);
	let meaningPhase = $state<MeaningPhase>({ kind: 'idle' });
	/** The query the status line is about: editing it clears the line. */
	let phaseQuery = $state('');
	let truncated = $state(false);
	let meaningController: AbortController | undefined;

	const filterKey = (ids: string[]) => [...ids].sort().join(',');
	/** Results by meaning are shown: meaning mode, for this very text. */
	const meaningActive = $derived(
		mode === 'meaning' && meaningFor !== null && meaningFor.query === query
	);

	// The same reading of the query as the search engine (engine.ts), but synchronous, so what
	// Enter does never waits on the worker (research R6).
	const hymnalKeys = $derived(
		new Map(
			data.catalog
				.getHymnals()
				.flatMap((h) => [...h.abbreviations, h.name].map((label) => [compactKey(label), h.id]))
		)
	);
	const queryKind = (q: string) => parseQuery(q, (label) => hymnalKeys.get(compactKey(label))).kind;
	/** A text to search by meaning: not empty, not a hymn number. */
	const offersMeaning = (q: string) => ['short', 'text'].includes(queryKind(q));
	const shownPhase = $derived.by((): MeaningPhase => {
		if (phaseQuery !== query) return { kind: 'idle' };
		const status = $meaningStatus;
		if (meaningPhase.kind === 'waiting' && status.state === 'downloading' && status.total) {
			const percent = Math.min(99, Math.floor(((status.loaded ?? 0) / status.total) * 100));
			return { kind: 'preparing', percent };
		}
		return meaningPhase;
	});

	function cancelMeaning() {
		meaningController?.abort();
		meaningController = undefined;
		meaningFor = null;
		meaningPhase = { kind: 'idle' };
		truncated = false;
	}

	async function runMeaning() {
		const q = query;
		if (!q.trim()) return;
		meaningController?.abort();
		const controller = (meaningController = new AbortController());
		const filter = [...selected];
		const stale = () => controller.signal.aborted || query !== q || mode !== 'meaning';

		phaseQuery = q;
		meaningPhase = { kind: 'waiting' };
		// The button shows from the first paint (manifest); the worker may still be loading.
		if (!ready) await client.ready.catch(() => undefined);
		if (stale()) return;
		const meta = client.meaningConfig();
		if (!meta) {
			meaningPhase = { kind: 'error', reason: 'unavailable' };
			return;
		}
		const embedded = await embedQuery(q, meta, {
			signal: controller.signal,
			cache: browserQueryCache(meta.configId)
		});
		if (stale()) return;
		truncated = embedded.truncated;
		if (!embedded.ok) {
			meaningFor = null;
			meaningPhase =
				embedded.reason === 'cancelled'
					? { kind: 'idle' }
					: { kind: 'error', reason: embedded.reason };
			return;
		}

		const answer = await client.searchMeaning(
			{ query: q, hymnals: filter },
			embedded.vector,
			meta.configId
		);
		if (!answer || stale()) return;
		if ('error' in answer) {
			meaningFor = null;
			meaningPhase = { kind: 'error', reason: answer.error };
			return;
		}
		meaningResponse = answer.response;
		meaningFor = { query: q, filter: filterKey(filter) };
		meaningPhase = { kind: 'idle' };
	}

	// Editing the query cancels a search by meaning in progress (US1 scenario 7) and drops its
	// results: typing the same text again shows word results until Enter (feature 012).
	$effect(() => {
		if (query !== untrack(() => phaseQuery) && meaningController) {
			meaningController.abort();
			meaningController = undefined;
		}
		const shownFor = untrack(() => meaningFor);
		if (shownFor && shownFor.query !== query) meaningFor = null;
	});

	// The hymnal filter applies to the meaning list too (FR-006): search again when it changes.
	$effect(() => {
		const key = filterKey(selected);
		const current = untrack(() => meaningFor);
		if (current && current.query === untrack(() => query) && current.filter !== key) {
			void runMeaning();
		}
	});

	let latest = 0;
	$effect(() => {
		const q = query;
		const filter = [...selected];
		const sens = mode === 'meaning';

		const url = new URL(window.location.href);
		if (q) url.searchParams.set('q', q);
		else url.searchParams.delete('q');
		if (filter.length > 0) url.searchParams.set('recueils', filter.join(','));
		else url.searchParams.delete('recueils');
		if (sens) url.searchParams.set('sens', '1');
		else url.searchParams.delete('sens');
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

	/** The list on screen: the blended meaning list, or the word results. */
	const shown = $derived(meaningActive && meaningResponse ? meaningResponse : response);
	const first = $derived(shown?.results[0]);

	// Feature 006: what the screen offers while the field is empty (contracts/ui.md).
	const idle = $derived(!query.trim());
	const recent = $derived(recentHymns(data.catalog, $hymnHistory));
	const collections = $derived(byUpdatedDesc($repertoire.collections).slice(0, 3));
	const examples = $derived(pickExamples(data.catalog));
	/** Only for a first visit: nothing of the user's own to show yet. */
	const showExamples = $derived(recent.length === 0 && $repertoire.collections.length === 0);
	/** « CE 1 » in the help sentence, from the loaded hymnals; no example when there is none. */
	const numberExample = $derived(
		examples.find((e) => e.kind === 'number')?.query.replace(' ', '\u00a0')
	);
	let announcement = $state('');

	function pickExample(text: string) {
		query = text;
		input?.focus();
	}

	function clearRecent() {
		hymnHistory.clear();
		announcement = 'Historique effacé';
		input?.focus();
	}

	/** Short summary for screen readers (aria-live). */
	const status = $derived.by(() => {
		if (!shown || !query.trim()) return '';
		if (shown.kind === 'hymnal-number' && first) {
			const h = hymnalMap.get(first.primaryRef.hymnal);
			return `${refLabel(h?.abbreviations[0] ?? '', first.primaryRef.number)}, ${first.title}`;
		}
		const n = shown.results.length;
		const label = n === 0 ? 'Aucun résultat' : `${n} ${n > 1 ? 'chants' : 'chant'}`;
		return shown.kind === 'meaning' ? `Résultats par le sens : ${label}` : label;
	});

	function openFirst() {
		if (first) goto(hymnUrl(first.primaryRef.hymnal, first.primaryRef.number));
	}

	/** Enter (feature 012, research R6). */
	function submit() {
		const action = decideSubmit({
			mode,
			queryKind: queryKind(query),
			meaningCurrent: meaningActive
		});
		if (action === 'open-first') openFirst();
		else if (action === 'run-meaning') void runMeaning();
	}

	function changeMode(next: SearchMode) {
		if (next === 'meaning') {
			// One press runs it on a text already typed, as before feature 012.
			if (offersMeaning(query)) void runMeaning();
		} else {
			cancelMeaning();
		}
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
			<SearchBox
				bind:value={query}
				bind:input
				bind:mode
				{meaningAvailable}
				onsubmit={submit}
				onmodechange={changeMode}
			/>
			{#if hymnals.length > 1}
				<HymnalFilter hymnals={filterHymnals} bind:selected />
			{/if}
		</div>

		<MeaningStatus
			phase={shownPhase}
			truncated={truncated && phaseQuery === query}
			oncancel={cancelMeaning}
		/>

		<p class="hb-sr" aria-live="polite">{status}</p>
		<p class="hb-sr" aria-live="polite">{announcement}</p>

		<div class="search__results">
			{#if idle}
				<p class="hy-caption search__help">
					{#if numberExample}
						Tapez un numéro («&#8239;{numberExample}&#8239;»), un titre ou quelques mots des
						paroles.
					{:else}
						Tapez un numéro, un titre ou quelques mots des paroles.
					{/if}
				</p>
				{#if showExamples}
					<SearchExamples {examples} onpick={pickExample} />
				{/if}
				<div class="mobile-only">
					<RecentHymns rows={recent} onclear={clearRecent} />
					<RecentCollections {collections} />
				</div>
			{:else if unavailable}
				<div class="hy-message" role="status">
					<p class="hy-message__title">La recherche n’a pas pu démarrer</p>
					<p class="hy-message__text">Rechargez la page. Les recueils restent consultables.</p>
				</div>
			{:else if shown}
				<ResultList
					response={shown}
					hymnals={hymnalMap}
					filterActive={selected.length > 0}
					onclearfilter={() => (selected = [])}
				/>
			{/if}
		</div>
	</div>

	<aside class="search__aside desktop-only" aria-label="Raccourcis">
		{#if idle}
			<RecentHymns rows={recent} onclear={clearRecent} />
			<RecentCollections {collections} />
		{/if}
		<p class="hy-caption search__keys">
			Au clavier&#8239;: <kbd>/</kbd> place le curseur dans la recherche, <kbd>Entrée</kbd> ouvre le
			premier résultat.
			{#if meaningAvailable}
				En mode «&#8239;par le sens&#8239;», <kbd>Entrée</kbd> lance la recherche.
			{/if}
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
		/* Lines the list up with the search field: header (8 + 52) + controls (12). */
		padding-top: 72px;
	}

	.search__aside :global(section:first-child .hb-overline) {
		margin-top: 0;
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
		line-height: 24px;
	}

	kbd {
		display: inline-block;
		min-width: 20px;
		padding: 0 6px;
		border: 1px solid var(--line-strong);
		border-bottom-width: 2px;
		border-radius: 4px;
		background: var(--paper-raised);
		font-family: var(--font-sans);
		font-size: 12px;
		line-height: 16px;
		text-align: center;
		white-space: nowrap;
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
