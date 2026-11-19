<!--
  Hymns found from chosen verses `/bible/chants?versets=…` (feature 015, contracts/bible-ui.md
  §4, research R7). The verses' text is turned into one vector online (`/api/embed`, up to 2,000
  characters), then ranked against the hymn stanzas on the device, as a search by meaning: each
  hymn once, the matching stanza marked when opened (feature 013), hymnals left out in Settings
  skipped (feature 014). The URL holds the verses, so a reload or a shared link runs it again,
  from the query cache when the vector is known.
-->
<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { bookByCode, parseVerseId } from '$lib/bible/books';
	import { verseQueryText } from '$lib/bible/query';
	import { appSelection, fromUrlParam } from '$lib/bible/selection';
	import Icon from '$lib/components/Icon.svelte';
	import MeaningStatus, { type MeaningPhase } from '$lib/components/MeaningStatus.svelte';
	import ResultList from '$lib/components/ResultList.svelte';
	import { MAX_EMBED_CHARS } from '$lib/meaning/config';
	import { embedQuery } from '$lib/meaning/embed-client';
	import { browserQueryCache } from '$lib/meaning/query-cache';
	import { prefs } from '$lib/prefs/prefs';
	import { createScope } from '$lib/scope/scope';
	import { getSearchClient } from '$lib/search/session';
	import type { SearchResponse } from '$lib/search/types';

	let { data } = $props();

	const bible = untrack(() => data.bible);
	const selection = bible ? appSelection(bible) : undefined;

	// The URL is the search: it replaces the stored selection (§4).
	if (bible && selection) {
		selection.replace(fromUrlParam(page.url.searchParams.get('versets'), bible.verseCount));
	}
	const chosen = selection?.current();
	const ids = chosen?.ids ?? [];
	const label = chosen?.label ?? '';

	const hymnals = $derived(data.catalog.getHymnals());
	const hymnalMap = $derived(new Map(hymnals.map((h) => [h.id, h])));
	const scope = $derived(createScope($prefs.excluded, hymnals));

	const backHref = $derived.by(() => {
		const first = ids[0] ? parseVerseId(ids[0]) : undefined;
		if (!first) return `${resolve('/bible')}?livres`;
		const url = resolve('/bible/[livre]/[chapitre]', {
			livre: bookByCode(first.book)!.slug,
			chapitre: `${first.chapter}`
		});
		return `${url}?v=${first.verse}`;
	});

	/* ---------- the search ---------- */

	const client = getSearchClient();
	const meaningStatus = client.meaningStatus;
	let phase = $state<MeaningPhase>({ kind: 'idle' });
	let response = $state<SearchResponse | null>(null);
	let controller: AbortController | undefined;

	const shownPhase = $derived.by((): MeaningPhase => {
		const status = $meaningStatus;
		if (phase.kind === 'waiting' && status.state === 'downloading' && status.total) {
			const percent = Math.min(99, Math.floor(((status.loaded ?? 0) / status.total) * 100));
			return { kind: 'preparing', percent };
		}
		return phase;
	});

	async function run() {
		if (!bible || ids.length === 0) return;
		controller?.abort();
		const own = (controller = new AbortController());
		const stale = () => own.signal.aborted;
		response = null;
		phase = { kind: 'waiting' };

		await client.ready.catch(() => undefined);
		if (stale()) return;
		const meta = client.meaningConfig();
		if (!meta) {
			phase = { kind: 'error', reason: 'unavailable' };
			return;
		}
		const embedded = await embedQuery(verseQueryText(ids, bible), meta, {
			signal: own.signal,
			cache: browserQueryCache(meta.configId),
			maxChars: MAX_EMBED_CHARS
		});
		if (stale()) return;
		if (!embedded.ok) {
			phase =
				embedded.reason === 'cancelled'
					? { kind: 'idle' }
					: { kind: 'error', reason: embedded.reason };
			return;
		}
		// No words: the list is the meaning ranking itself (research R7).
		const answer = await client.searchMeaning(
			{ query: '', hymnals: [], excluded: untrack(() => $prefs.excluded) },
			embedded.vector,
			meta.configId
		);
		if (!answer || stale()) return;
		if ('error' in answer) {
			phase = { kind: 'error', reason: answer.error };
			return;
		}
		response = answer.response;
		phase = { kind: 'idle' };
	}

	function cancel() {
		controller?.abort();
		controller = undefined;
		phase = { kind: 'idle' };
	}

	run();
	onDestroy(() => controller?.abort());

	// Settings changed meanwhile (feature 014): rank again, from the cached vector.
	let lastExcluded = JSON.stringify(untrack(() => $prefs.excluded));
	$effect(() => {
		const key = JSON.stringify($prefs.excluded);
		if (key !== lastExcluded) {
			lastExcluded = key;
			untrack(() => run());
		}
	});

	const status = $derived.by(() => {
		if (!response) return '';
		const n = response.results.length;
		return `Résultats par le sens : ${n === 0 ? 'aucun chant' : `${n} ${n > 1 ? 'chants' : 'chant'}`}`;
	});
</script>

<svelte:head
	><title>{label ? `Chants pour ${label}` : 'Chants pour des versets'} · Hymnia</title></svelte:head
>

<div class="page verse-hymns">
	<header class="page__header page__header--back">
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus ?v= -->
		<a class="hb-icon-btn" href={backHref} aria-label="Retour aux versets"><Icon name="back" /></a>
		<span class="page__back-label">Retour aux versets</span>
	</header>

	{#if !bible}
		<div class="hy-message" role="status">
			<p class="hy-message__title">La Bible n’est pas disponible dans cette version</p>
		</div>
	{:else if ids.length === 0}
		<div class="hy-message" role="status">
			<p class="hy-message__title">Aucun verset choisi</p>
			<p class="hy-message__text">Ouvrez un chapitre et touchez les versets pour les choisir.</p>
			<div class="hy-message__actions">
				<a class="hb-btn hb-btn--primary" href={resolve('/bible')}>Ouvrir la Bible</a>
			</div>
		</div>
	{:else}
		<h1 class="hy-screen-title verse-hymns__title">
			<span class="verse-hymns__overline">Chants pour</span>
			{label}
		</h1>
		<details class="verse-hymns__text">
			<summary>Voir le texte</summary>
			<p>{verseQueryText(ids, bible, { withLabel: false })}</p>
			<p class="hy-caption">{bible.name}</p>
		</details>

		<MeaningStatus phase={shownPhase} oncancel={cancel} />
		{#if phase.kind === 'error' && phase.reason !== 'config'}
			<button type="button" class="hb-btn verse-hymns__retry" onclick={run}>Réessayer</button>
		{/if}
		<p class="hb-sr" aria-live="polite">{status}</p>

		{#if response}
			<ResultList {response} hymnals={hymnalMap} {scope} />
		{/if}
	{/if}
</div>

<style>
	.verse-hymns {
		max-width: 760px;
	}

	.verse-hymns__title {
		margin-top: var(--space-2);
	}

	.verse-hymns__overline {
		display: block;
		font-size: 13px;
		line-height: 20px;
		font-weight: 600;
		color: var(--ink-muted);
	}

	.verse-hymns__text {
		margin: var(--space-3) 0 var(--space-2);
		font-size: 15px;
		line-height: 22px;
		color: var(--ink-muted);
	}

	.verse-hymns__text summary {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap-target);
		font-weight: 500;
		color: var(--rubric);
		cursor: pointer;
	}

	.verse-hymns__text p {
		margin: 0 0 var(--space-2);
		font-family: var(--font-serif);
		font-style: italic;
	}

	.verse-hymns__text p.hy-caption {
		font-family: var(--font-sans);
		font-style: normal;
	}

	.verse-hymns__retry {
		margin-bottom: var(--space-3);
	}

	@media (min-width: 1024px) {
		.verse-hymns {
			padding-top: 16px;
		}
	}
</style>
