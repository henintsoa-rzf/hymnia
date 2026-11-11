<!--
  Search results (T034, T045, decisions §4.1): the exact hymn as a card, hymns with a number,
  or text results with all their references and a highlighted excerpt. Calm messages when
  nothing is found.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import type { PublishedHymnal } from '$lib/domain/schema';
	import { frenchSpaces, hymnalUrl, hymnCountLabel, hymnUrl, refLabel } from '$lib/format';
	import type { Excerpt, SearchResponse, SearchResult } from '$lib/search/types';
	import EmptyState from './EmptyState.svelte';
	import HymnRef from './HymnRef.svelte';
	import Icon from './Icon.svelte';

	let {
		response,
		hymnals,
		filterActive = false,
		onclearfilter,
		action
	}: {
		response: SearchResponse;
		hymnals: Map<string, PublishedHymnal>;
		filterActive?: boolean;
		onclearfilter?: () => void;
		/** Optional control shown beside each hymn (feature 003: add to a collection). */
		action?: Snippet<[SearchResult]>;
	} = $props();

	const abbr = (id: string) => hymnals.get(id)?.abbreviations[0] ?? id.toUpperCase();
	const nameOf = (id: string) => hymnals.get(id)?.name ?? id;

	/** Excerpt split into plain and highlighted parts (ranges point into the original text). */
	function parts(excerpt: Excerpt) {
		const text = frenchSpaces(excerpt.text); // same length: ranges still apply
		const out: { text: string; hit: boolean }[] = [];
		let at = 0;
		for (const [start, end] of [...excerpt.highlights].sort((a, b) => a[0] - b[0])) {
			if (start < at) continue;
			if (start > at) out.push({ text: text.slice(at, start), hit: false });
			out.push({ text: text.slice(start, end), hit: true });
			at = end;
		}
		if (at < text.length) out.push({ text: text.slice(at), hit: false });
		return out;
	}

	const exact = $derived(response.kind === 'hymnal-number' ? response.results[0] : undefined);
	const number = $derived(
		response.notFound?.number ??
			exact?.primaryRef.number ??
			response.results[0]?.primaryRef.number ??
			''
	);
	const countTitle = $derived(
		`${response.results.length}${response.results.length >= 50 ? '+' : ''} ${response.results.length > 1 ? 'chants' : 'chant'}`
	);
</script>

{#snippet numberRow(result: SearchResult)}
	<li class:with-action={action}>
		<a class="hy-result" href={hymnUrl(result.primaryRef.hymnal, result.primaryRef.number)}>
			<span class="hy-result__head">
				<span class="hy-result__title">{frenchSpaces(result.title)}</span>
				<span class="hy-result__refs">
					<HymnRef
						abbreviation={abbr(result.primaryRef.hymnal)}
						number={result.primaryRef.number}
					/>
				</span>
			</span>
			<span class="hy-result__meta">{nameOf(result.primaryRef.hymnal)}</span>
		</a>
		{@render action?.(result)}
	</li>
{/snippet}

{#snippet clearFilter()}
	{#if filterActive}
		<button type="button" class="hb-btn" onclick={onclearfilter}
			>Chercher dans tous les recueils</button
		>
	{/if}
{/snippet}

{#if response.kind === 'hymnal-number'}
	{#if exact}
		<div class="exact" class:with-action={action}>
			<a class="hy-exact" href={hymnUrl(exact.primaryRef.hymnal, exact.primaryRef.number)}>
				<span class="hy-exact__ref"
					>{refLabel(abbr(exact.primaryRef.hymnal), exact.primaryRef.number)}</span
				>
				<span class="hy-exact__title">{frenchSpaces(exact.title)}</span>
				<span class="hy-exact__book">{nameOf(exact.primaryRef.hymnal)}</span>
				<Icon name="forward" />
			</a>
			{@render action?.(exact)}
		</div>
		{#if response.sameNumber?.length}
			<h2 class="hb-overline">Autres chants n°&nbsp;{number}</h2>
			<ul class="hb-list">
				{#each response.sameNumber as result (result.primaryRef.hymnal)}
					{@render numberRow(result)}
				{/each}
			</ul>
		{/if}
	{:else if response.notFound}
		{@const hymnal = hymnals.get(response.notFound.hymnal)}
		<EmptyState
			title={`Aucun chant n° ${response.notFound.number} dans ${nameOf(response.notFound.hymnal)}`}
			text="Vérifiez le numéro annoncé, ou parcourez le recueil."
		>
			{#snippet actions()}
				{#if hymnal}
					<a class="hb-btn" href={hymnalUrl(hymnal.id)}>
						Voir les {hymnCountLabel(hymnal.hymnCount)} du recueil
					</a>
				{/if}
			{/snippet}
		</EmptyState>
	{/if}
{:else if response.kind === 'number'}
	{#if response.results.length > 0}
		<h2 class="hb-overline">Chants n°&nbsp;{number}</h2>
		<ul class="hb-list">
			{#each response.results as result (result.primaryRef.hymnal)}
				{@render numberRow(result)}
			{/each}
		</ul>
	{:else}
		<EmptyState
			title={`Aucun chant n° ${response.query.replace(/^\D+/, '').trim()}`}
			text="Ajoutez l’abréviation du recueil, par exemple « CE 12 »."
			actions={filterActive ? clearFilter : undefined}
		/>
	{/if}
{:else if response.kind === 'text'}
	{#if response.results.length > 0}
		<h2 class="hb-overline">{countTitle}</h2>
		<ul class="hb-list">
			{#each response.results as result (result.hymnId)}
				<li class:with-action={action}>
					<a class="hy-result" href={hymnUrl(result.primaryRef.hymnal, result.primaryRef.number)}>
						<span class="hy-result__head">
							<span class="hy-result__title">{frenchSpaces(result.title)}</span>
							<span class="hy-result__refs">
								{#each result.refs as ref (ref.hymnal)}
									<HymnRef abbreviation={ref.hymnalAbbr} number={ref.number} />
								{/each}
							</span>
						</span>
						{#if result.excerpt}
							<span class="hy-result__excerpt"
								>«&#8239;{#each parts(result.excerpt) as part, i (i)}{#if part.hit}<mark
											>{part.text}</mark
										>{:else}{part.text}{/if}{/each}&#8239;»</span
							>
						{/if}
					</a>
					{@render action?.(result)}
				</li>
			{/each}
		</ul>
	{:else if response.unknownHymnal}
		<EmptyState
			title={`Aucun recueil « ${response.unknownHymnal} » dans Hymnia`}
			text="Les recueils disponibles sont listés dans l’onglet Recueils."
		>
			{#snippet actions()}
				<a class="hb-btn" href={resolve('/recueils')}>Voir les recueils</a>
			{/snippet}
		</EmptyState>
	{:else}
		<EmptyState
			title={`Aucun chant ne contient « ${response.query.trim()} »`}
			text="Vérifiez l’orthographe ou essayez d’autres mots."
			actions={filterActive ? clearFilter : undefined}
		/>
	{/if}
{/if}

<style>
	.exact {
		margin-top: var(--space-2);
	}

	.with-action {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	li.with-action {
		border-bottom: 1px solid var(--line);
	}

	.with-action > :global(a) {
		flex: 1;
		min-width: 0;
	}

	li.with-action > :global(.hy-result) {
		border-bottom: 0;
	}
</style>
