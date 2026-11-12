<!--
  One collection `/repertoire/<id>` (feature 003, US1, US2, US4; mockup `Playlist`): its hymns
  in order, "Lire dans l’ordre", "Ajouter des chants", and a menu to rename, reorder or delete.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import CollectionNameDialog from '$lib/components/CollectionNameDialog.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import NotFound from '$lib/components/NotFound.svelte';
	import { titleIn } from '$lib/domain/titles';
	import { frenchSpaces, hymnCountLabel, hymnInCollectionUrl, refLabel } from '$lib/format';
	import { hymnIdOf, resolveEntries, type ResolvedEntry } from '$lib/repertoire/resolve';
	import { repertoire } from '$lib/repertoire/store';

	let { data } = $props();

	const collection = $derived($repertoire.collections.find((c) => c.id === data.id));
	const rows = $derived(collection ? resolveEntries(data.catalog, collection) : []);
	const firstAvailable = $derived(rows.find((r) => r.available));
	const idOf = $derived(hymnIdOf(data.catalog));

	let renaming = $state(false);
	let deleting = $state(false);
	let ordering = $state(false);
	let menuOpen = $state(false);
	let status = $state('');

	const label = (row: ResolvedEntry) =>
		refLabel(row.hymnal?.abbreviations[0] ?? row.entry.hymnal.toUpperCase(), row.entry.number);
	const titleOf = (row: ResolvedEntry) =>
		row.hymn ? titleIn(row.hymn, row.entry.hymnal, row.entry.number) : 'Chant indisponible';

	function remove(row: ResolvedEntry) {
		if (!collection) return;
		repertoire.removeEntry(collection.id, row.entry, idOf);
		status = frenchSpaces(`« ${titleOf(row)} » retiré de la collection`);
	}

	async function move(row: ResolvedEntry, to: number, direction: 'up' | 'down') {
		if (!collection) return;
		repertoire.move(collection.id, row.index, to);
		status = frenchSpaces(`« ${titleOf(row)} » déplacé en position ${to + 1}`);
		await tick();
		// Keep focus on the same button of the moved row (or the other one at the ends).
		const item = document.querySelector<HTMLElement>(`[data-row="${to}"]`);
		const wanted = item?.querySelector<HTMLButtonElement>(`[data-move="${direction}"]`);
		(wanted && !wanted.disabled
			? wanted
			: item?.querySelector<HTMLButtonElement>('[data-move]:not(:disabled)')
		)?.focus();
	}

	function confirmDelete() {
		if (!collection) return;
		repertoire.remove(collection.id);
		goto(resolve('/repertoire'));
	}
</script>

<svelte:head>
	{#if collection}<title>{collection.name} · Hymnia</title>{/if}
</svelte:head>

{#if collection}
	<div class="page collection">
		<header class="page__header page__header--back">
			<a class="hb-icon-btn" href={resolve('/repertoire')} aria-label="Retour au répertoire">
				<Icon name="back" />
			</a>
			<span class="page__back-label">Répertoire</span>
			<div
				class="menu"
				onfocusout={(event) => {
					const next = event.relatedTarget as Node | null;
					if (!next || !(event.currentTarget as HTMLElement).contains(next)) menuOpen = false;
				}}
				onkeydown={(event) => {
					if (event.key === 'Escape') menuOpen = false;
				}}
				role="presentation"
			>
				<button
					type="button"
					class="hb-icon-btn"
					aria-label="Plus d’options"
					aria-expanded={menuOpen}
					aria-controls="collection-menu"
					onclick={() => (menuOpen = !menuOpen)}
				>
					<Icon name="more" />
				</button>
				{#if menuOpen}
					<ul class="menu__list" id="collection-menu">
						<li>
							<button
								type="button"
								onclick={() => {
									menuOpen = false;
									renaming = true;
								}}>Renommer</button
							>
						</li>
						{#if collection.entries.length > 1}
							<li>
								<button
									type="button"
									onclick={() => {
										menuOpen = false;
										ordering = true;
									}}>Modifier l’ordre</button
								>
							</li>
						{/if}
						<li>
							<button
								type="button"
								onclick={() => {
									menuOpen = false;
									deleting = true;
								}}>Supprimer</button
							>
						</li>
					</ul>
				{/if}
			</div>
		</header>

		<h1 class="hy-screen-title">{collection.name}</h1>
		<p class="hy-caption collection__count">{hymnCountLabel(collection.entries.length)}</p>

		<div class="collection__actions">
			{#if ordering}
				<button type="button" class="hb-btn hb-btn--primary" onclick={() => (ordering = false)}>
					Terminé
				</button>
			{:else}
				{#if firstAvailable}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- hymnInCollectionUrl adds ?collection= to a resolved hymn URL -->
					<a
						class="hb-btn hb-btn--primary collection__read"
						href={hymnInCollectionUrl(
							firstAvailable.entry.hymnal,
							firstAvailable.entry.number,
							data.id
						)}
					>
						Lire dans l’ordre
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/if}
				<a
					class="hb-btn"
					href={resolve('/repertoire/[collection]/ajouter', { collection: collection.id })}
				>
					<Icon name="plus" />Ajouter des chants
				</a>
			{/if}
		</div>

		<p class="hb-sr" aria-live="polite">{status}</p>

		{#if rows.length === 0}
			<p class="hy-message__text collection__empty">Aucun chant pour l’instant.</p>
		{:else}
			<ol class="hb-list collection__list" aria-label="Chants de la collection, dans l’ordre">
				{#each rows as row, i (`${row.entry.hymnal} ${row.entry.number}`)}
					<li class="hb-item" data-row={i}>
						{#if row.available}
							<!-- eslint-disable svelte/no-navigation-without-resolve -- hymnInCollectionUrl adds ?collection= to a resolved hymn URL -->
							<a
								class="hb-item__link collection__link"
								href={hymnInCollectionUrl(row.entry.hymnal, row.entry.number, data.id)}
							>
								<span class="collection__ref">
									<span class="hb-item__num">{row.entry.number}</span>
									<span class="collection__abbr">{row.hymnal?.abbreviations[0]}</span>
								</span>
								<span class="hb-item__title">{frenchSpaces(titleOf(row))}</span>
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{:else}
							<span class="hb-item__link collection__link">
								<span class="collection__ref">
									<span class="hb-item__num">{row.entry.number}</span>
									<span class="collection__abbr">{row.entry.hymnal.toUpperCase()}</span>
								</span>
								<span class="hb-item__title collection__unavailable">
									Chant indisponible <span class="hy-caption">({label(row)})</span>
								</span>
							</span>
						{/if}
						{#if ordering}
							<button
								type="button"
								class="hb-icon-btn"
								data-move="up"
								disabled={i === 0}
								aria-label={frenchSpaces(`Monter « ${titleOf(row)} »`)}
								onclick={() => move(row, i - 1, 'up')}
							>
								<Icon name="up" />
							</button>
							<button
								type="button"
								class="hb-icon-btn"
								data-move="down"
								disabled={i === rows.length - 1}
								aria-label={frenchSpaces(`Descendre « ${titleOf(row)} »`)}
								onclick={() => move(row, i + 1, 'down')}
							>
								<Icon name="down" />
							</button>
						{/if}
						<button
							type="button"
							class="hb-icon-btn collection__remove"
							aria-label={frenchSpaces(`Retirer « ${titleOf(row)} »`)}
							onclick={() => remove(row)}
						>
							<Icon name="close" />
						</button>
					</li>
				{/each}
			</ol>
		{/if}
	</div>

	<CollectionNameDialog
		bind:open={renaming}
		mode="rename"
		initial={collection.name}
		submit={(name) => {
			const result = repertoire.rename(collection.id, name);
			return result.ok ? null : result.error;
		}}
	/>
	<ConfirmDialog
		bind:open={deleting}
		title={frenchSpaces(`Supprimer « ${collection.name} » ?`)}
		text="Les chants restent dans leurs recueils."
		confirmLabel="Supprimer"
		onconfirm={confirmDelete}
	/>
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
	.collection {
		max-width: 720px;
	}

	.collection__count {
		margin-top: 4px;
	}

	.collection__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 16px;
	}

	.collection__read {
		flex-grow: 1;
	}

	.collection__list {
		margin-top: 16px;
		border-top: 1px solid var(--line);
	}

	.collection__empty {
		margin-top: 24px;
	}

	.collection__ref {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	.collection__abbr {
		font-size: 11px;
		line-height: 14px;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--ink-muted);
	}

	.collection__unavailable {
		color: var(--ink-muted);
		font-style: italic;
	}

	.collection__remove {
		color: var(--ink-muted);
	}

	.hb-item .hb-icon-btn:disabled {
		color: var(--line-strong);
		cursor: default;
	}

	.menu {
		position: relative;
		margin-left: auto;
	}

	.menu__list {
		position: absolute;
		z-index: 15;
		right: 0;
		top: 100%;
		min-width: 13rem;
		margin: 4px 0 0;
		padding: 4px;
		list-style: none;
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		background: var(--paper-raised);
		box-shadow: var(--shadow-float);
	}

	.menu__list button {
		display: block;
		width: 100%;
		min-height: 44px;
		padding: 0 12px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		text-align: left;
		font-size: 15px;
		color: var(--ink);
		cursor: pointer;
	}

	.menu__list button:hover {
		background: var(--paper-sunken);
	}

	@media (min-width: 1024px) {
		.collection {
			padding-top: 16px;
		}
	}
</style>
