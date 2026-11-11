<!--
  Répertoire `/repertoire` (feature 003, US1–US2; mockup `Lists`): the user's collections,
  most recently changed first, and "Nouvelle collection".
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CollectionNameDialog from '$lib/components/CollectionNameDialog.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { hymnCountLabel } from '$lib/format';
	import { byUpdatedDesc } from '$lib/repertoire/model';
	import { repertoire } from '$lib/repertoire/store';

	let creating = $state(false);
	const collections = $derived(byUpdatedDesc($repertoire.collections));

	function create(name: string) {
		const result = repertoire.create(name);
		if (!result.ok) return result.error;
		goto(resolve('/repertoire/[collection]/ajouter', { collection: result.id }));
		return null;
	}
</script>

<svelte:head><title>Répertoire · Hymnia</title></svelte:head>

<div class="page repertoire">
	<header class="page__header repertoire__header">
		<h1 class="hy-screen-title" id="repertoire-title">Répertoire</h1>
		<button type="button" class="hb-btn hb-btn--quiet" onclick={() => (creating = true)}>
			<Icon name="plus" />Nouvelle collection
		</button>
	</header>

	{#if collections.length === 0}
		<div class="hy-message">
			<p class="hy-message__title">Aucune collection pour l’instant.</p>
			<p class="hy-message__text">
				Une collection rassemble des chants pour un culte, une répétition ou une occasion.
			</p>
			<div class="hy-message__actions">
				<button type="button" class="hb-btn hb-btn--primary" onclick={() => (creating = true)}>
					<Icon name="plus" />Nouvelle collection
				</button>
			</div>
		</div>
	{:else}
		<ul class="hb-list repertoire__list" aria-labelledby="repertoire-title">
			{#each collections as collection (collection.id)}
				<li>
					<a
						class="hy-row"
						href={resolve('/repertoire/[collection]', { collection: collection.id })}
					>
						<span class="repertoire__icon"><Icon name="bookmark" /></span>
						<span class="hy-row__text">
							<span class="hy-row__title">{collection.name}</span>
							<span class="hy-row__meta">{hymnCountLabel(collection.entries.length)}</span>
						</span>
						<Icon name="forward" />
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<CollectionNameDialog bind:open={creating} mode="create" submit={create} />

<style>
	.repertoire {
		max-width: 720px;
	}

	.repertoire__header {
		justify-content: space-between;
		gap: var(--space-2);
	}

	.repertoire__header .hy-screen-title {
		flex-grow: 1;
	}

	.repertoire__list {
		margin-top: var(--space-2);
		border-top: 1px solid var(--line);
	}

	.repertoire__icon {
		display: flex;
		color: var(--ink-muted);
	}

	.repertoire__icon :global(svg) {
		width: 20px;
		height: 20px;
	}

	@media (min-width: 1024px) {
		.repertoire {
			padding-top: 32px;
		}
	}
</style>
