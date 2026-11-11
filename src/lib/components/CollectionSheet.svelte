<!--
  "Ajouter à une collection" (feature 003, US3; contracts/ui.md "Bookmark sheet"). A bottom
  sheet on phones, a centred dialog on larger screens. Each collection toggles the hymn at once;
  "Nouvelle collection" creates one and adds the hymn to it.
-->
<script lang="ts">
	import { frenchSpaces, hymnCountLabel } from '$lib/format';
	import { byUpdatedDesc, hasHymn, type HymnIdOf } from '$lib/repertoire/model';
	import type { EntryRef } from '$lib/repertoire/schema';
	import { repertoire } from '$lib/repertoire/store';
	import CollectionNameDialog from './CollectionNameDialog.svelte';
	import Icon from './Icon.svelte';

	let {
		open = $bindable(false),
		ref,
		title,
		hymnIdOf
	}: { open?: boolean; ref: EntryRef; title: string; hymnIdOf: HymnIdOf } = $props();

	let dialog = $state<HTMLDialogElement>();
	let creating = $state(false);
	let status = $state('');
	const uid = $props.id();
	const collections = $derived(byUpdatedDesc($repertoire.collections));

	// Keep the order stable while the sheet is open (a toggle changes `updatedAt`).
	let order = $state<string[]>([]);
	const shown = $derived(
		[...collections].sort((a, b) => {
			const ia = order.indexOf(a.id);
			const ib = order.indexOf(b.id);
			return (ia < 0 ? -1 : ia) - (ib < 0 ? -1 : ib);
		})
	);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			order = byUpdatedDesc(repertoire.current().collections).map((c) => c.id);
			status = '';
			dialog.showModal();
		} else if (!open && dialog.open) dialog.close();
	});

	function toggle(id: string, name: string) {
		const outcome = repertoire.toggle(id, ref, hymnIdOf);
		status = frenchSpaces(outcome === 'added' ? `Ajouté à « ${name} »` : `Retiré de « ${name} »`);
	}

	function create(name: string) {
		const result = repertoire.create(name);
		if (!result.ok) return result.error;
		repertoire.add(result.id, ref, hymnIdOf);
		order = [result.id, ...order];
		status = frenchSpaces(`Ajouté à « ${name.trim()} »`);
		return null;
	}
</script>

<dialog
	bind:this={dialog}
	class="hy-sheet"
	aria-labelledby="{uid}-title"
	onclose={() => (open = false)}
>
	<div class="hy-handle" aria-hidden="true"></div>
	<h2 class="hy-dialog__title" id="{uid}-title">Ajouter à une collection</h2>
	<p class="hy-caption sheet__hymn">{frenchSpaces(title)}</p>

	{#if shown.length > 0}
		<ul class="hb-list sheet__list">
			{#each shown as collection (collection.id)}
				{@const inside = hasHymn(collection, ref, hymnIdOf)}
				<li>
					<button
						type="button"
						class="sheet__row"
						aria-pressed={inside}
						onclick={() => toggle(collection.id, collection.name)}
					>
						<span class="sheet__check" class:is-on={inside}>
							{#if inside}<Icon name="check" />{/if}
						</span>
						<span class="hy-row__text">
							<span class="sheet__name">{collection.name}</span>
							<span class="hy-row__meta">{hymnCountLabel(collection.entries.length)}</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="hy-dialog__text">Vous n’avez pas encore de collection.</p>
	{/if}

	<p class="hb-sr" aria-live="polite">{status}</p>

	<div class="hy-dialog__actions sheet__actions">
		<button type="button" class="hb-btn hb-btn--quiet" onclick={() => (creating = true)}>
			<Icon name="plus" />Nouvelle collection
		</button>
		<button type="button" class="hb-btn" onclick={() => (open = false)}>Fermer</button>
	</div>
</dialog>

<CollectionNameDialog bind:open={creating} mode="create" submit={create} />

<style>
	.sheet__hymn {
		margin: -8px 0 8px;
	}

	.sheet__list {
		border-top: 1px solid var(--line);
	}

	.sheet__row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 56px;
		padding: 6px 4px;
		border: 0;
		border-bottom: 1px solid var(--line);
		background: transparent;
		text-align: left;
		color: var(--ink);
		cursor: pointer;
	}

	.sheet__check {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: 1.5px solid var(--line-strong);
		border-radius: var(--radius-sm);
		color: var(--on-rubric);
	}

	.sheet__check.is-on {
		border-color: var(--rubric);
		background: var(--rubric);
	}

	.sheet__check :global(svg) {
		width: 16px;
		height: 16px;
		stroke-width: 2;
	}

	.sheet__name {
		font-size: 16px;
		line-height: 22px;
		font-weight: 500;
	}

	.sheet__actions {
		justify-content: space-between;
	}
</style>
