<!--
  Hymnal `/recueils/<id>` (T049, FR-012, decisions §6): hymns in number order and a
  "go to number" field that scrolls to that hymn and highlights it. A hymnal with parts (JEM
  volumes, albums, programmes) shows one headed group per part, with links to jump to each.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import NotFound from '$lib/components/NotFound.svelte';
	import { normalizeNumber } from '$lib/domain/numbering';
	import { groupByPart } from '$lib/domain/parts';
	import { frenchSpaces, hymnCountLabel, hymnUrl } from '$lib/format';
	import { tick } from 'svelte';

	let { data } = $props();

	let goValue = $state('');
	let target = $state<string>();
	let goMessage = $state('');

	const domId = (number: string) => `n-${normalizeNumber(number)}`;

	const groups = $derived(
		groupByPart(data.entries, data.hymnal?.parts, ({ entry }) => entry.sortKey)
	);
	const hasParts = $derived(groups.some((g) => g.part));

	async function go(event: SubmitEvent) {
		event.preventDefault();
		const hymnal = data.hymnal;
		const typed = goValue.trim().replace(/^(n°|no|#)\s*/i, '');
		if (!hymnal || !typed) return;
		const found = data.catalog.getEntry(hymnal.id, typed);
		if (!found) {
			target = undefined;
			goMessage = `Pas de n°\u00a0${typed} dans ce recueil.`;
			return;
		}
		goMessage = '';
		target = normalizeNumber(found.entry.number);
		await tick();
		const item = document.getElementById(domId(found.entry.number));
		item?.scrollIntoView({ block: 'center' });
		item?.querySelector('a')?.focus({ preventScroll: true });
	}
</script>

<svelte:head>
	{#if data.hymnal}<title>{data.hymnal.name} · Hymnia</title>{/if}
</svelte:head>

{#if data.hymnal}
	{@const hymnal = data.hymnal}

	<div class="page hymnal">
		<header class="page__header page__header--back">
			<a class="hb-icon-btn" href={resolve('/recueils')} aria-label="Retour aux recueils">
				<Icon name="back" />
			</a>
			<span class="page__back-label">Recueils</span>
		</header>

		<div class="hymnal__head">
			<div>
				<h1 class="hy-screen-title">{hymnal.name}</h1>
				<p class="hy-caption hymnal__count">
					{hymnal.abbreviations[0]} · {hymnCountLabel(hymnal.hymnCount)}
				</p>
			</div>
			<form class="hymnal__go" onsubmit={go}>
				<label class="hymnal__go-label">
					<span>Aller au numéro</span>
					<span class="hb-search">
						<input
							type="text"
							bind:value={goValue}
							autocomplete="off"
							enterkeyhint="go"
							placeholder="Par exemple 12a"
						/>
					</span>
				</label>
				<button type="submit" class="hb-btn">Aller</button>
			</form>
			{#if goMessage}<p class="hymnal__go-message" role="status">{goMessage}</p>{/if}
		</div>

		{#snippet entryList(entries: typeof data.entries, label: string)}
			<ol class="hb-list hymnal__list" aria-label={label}>
				{#each entries as { hymn, entry } (entry.number)}
					<li
						class="hb-item"
						class:is-target={target === normalizeNumber(entry.number)}
						id={domId(entry.number)}
					>
						<a class="hb-item__link" href={hymnUrl(hymnal.id, entry.number)}>
							<span class="hb-item__num">{entry.number}</span>
							<span class="hb-item__title">{frenchSpaces(entry.title ?? hymn.title)}</span>
						</a>
					</li>
				{/each}
			</ol>
		{/snippet}

		{#if hasParts}
			<nav class="hymnal__parts" aria-label="Parties du recueil">
				{#each groups as group, i (i)}
					{#if group.part}
						<a class="hb-chip" href={`#partie-${i}`}>{group.part.name}</a>
					{/if}
				{/each}
			</nav>
			{#each groups as group, i (i)}
				{@const first = group.items[0].entry.number}
				{@const last = group.items[group.items.length - 1].entry.number}
				{@const name = group.part?.name ?? 'Autres chants'}
				<section class="hymnal__part" id={`partie-${i}`} aria-labelledby={`partie-${i}-titre`}>
					<header class="hymnal__part-head">
						<h2 class="hymnal__part-name" id={`partie-${i}-titre`}>{frenchSpaces(name)}</h2>
						<p class="hy-caption">
							{first === last ? `n°\u00a0${first}` : `n°\u00a0${first}\u202f–\u202f${last}`}
							· {hymnCountLabel(group.items.length)}
						</p>
					</header>
					{@render entryList(group.items, `${name}, par numéro`)}
				</section>
			{/each}
		{:else}
			{@render entryList(data.entries, 'Chants du recueil, par numéro')}
		{/if}
	</div>
{:else}
	<div class="page">
		<NotFound
			title="Recueil introuvable"
			text={`Aucun recueil « ${data.requested} » dans Hymnia. Les recueils disponibles sont listés dans l’onglet Recueils.`}
		/>
	</div>
{/if}

<style>
	.hymnal {
		max-width: 720px;
	}

	.hymnal__head {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 4px 0 8px;
	}

	.hymnal__count {
		margin-top: 4px;
	}

	.hymnal__go {
		display: flex;
		align-items: flex-end;
		gap: 8px;
	}

	.hymnal__go-label {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 14px;
		line-height: 20px;
		font-weight: 500;
	}

	.hymnal__go-message {
		margin: 0;
		font-size: 14px;
		line-height: 20px;
		color: var(--ink-muted);
	}

	.hymnal__list {
		border-top: 1px solid var(--line);
	}

	.hymnal__parts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 4px 0 8px;
	}

	.hymnal__parts .hb-chip {
		text-decoration: none;
	}

	.hymnal__part {
		scroll-margin-top: 8px;
	}

	.hymnal__part + .hymnal__part,
	.hymnal__parts + .hymnal__part {
		margin-top: 24px;
	}

	/* The part name stays at the top while its hymns scroll under it. */
	.hymnal__part-head {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 0 8px;
		background: var(--paper);
		border-bottom: 2px solid var(--rubric);
	}

	.hymnal__part-name {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 20px;
		line-height: 26px;
		font-weight: 500;
		color: var(--rubric);
	}

	.hymnal__part-head .hy-caption {
		flex: none;
		font-variant-numeric: tabular-nums;
	}

	.hymnal__part .hymnal__list {
		border-top: none;
	}

	.hymnal__list > li {
		content-visibility: auto;
		contain-intrinsic-size: auto 49px;
	}

	@media (min-width: 1024px) {
		.hymnal {
			padding-top: 16px;
		}

		.hymnal__go {
			max-width: 360px;
		}
	}
</style>
