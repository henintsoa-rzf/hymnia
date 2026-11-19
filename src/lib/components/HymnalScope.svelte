<!--
  « Recueils » subsection of Settings (specs/014-hymnal-scope-settings, contracts/scope.md §3,
  research R6): one native checkbox per hymnal, mixed when only some of its parts are in use.
  Parts are folded under a disclosure button. Every change is saved at once, in the normal form;
  the last hymnal or part in use cannot be left out.
-->
<script lang="ts">
	import type { PublishedHymnal } from '$lib/domain/schema';
	import { frenchSpaces } from '$lib/format';
	import { prefs } from '$lib/prefs/prefs';
	import { createScope, NO_EXCLUSIONS, setHymnal, setPart } from '$lib/scope/scope';
	import Icon from './Icon.svelte';

	let { hymnals, labelledby }: { hymnals: PublishedHymnal[]; labelledby?: string } = $props();

	const scope = $derived(createScope($prefs.excluded, hymnals));
	let open = $state<string[]>([]);

	const save = (excluded: typeof NO_EXCLUSIONS) => prefs.update((p) => ({ ...p, excluded }));

	function toggleHymnal(id: string) {
		// A hymnal partly or not in use is selected entirely; one fully in use is left out.
		save(setHymnal($prefs.excluded, hymnals, id, scope.hymnalState(id) !== 'all'));
	}

	function togglePart(id: string, first: number) {
		save(setPart($prefs.excluded, hymnals, id, first, !scope.includesPart(id, first)));
	}

	const toggleOpen = (id: string) =>
		(open = open.includes(id) ? open.filter((x) => x !== id) : [...open, id]);

	function partsLabel(hymnal: PublishedHymnal) {
		const total = hymnal.parts?.length ?? 0;
		const used = (hymnal.parts ?? []).filter((p) => scope.includesPart(hymnal.id, p.first)).length;
		return `${used} ${used > 1 ? 'parties' : 'partie'} sur ${total}`;
	}
</script>

<p class="hy-caption">
	Choisissez les recueils proposés dans la recherche et les listes. Vos collections et les liens
	vers un chant ne changent pas.
</p>

<p class="hb-sr" id="scope-last">Gardez au moins un recueil.</p>

<ul class="scope" aria-labelledby={labelledby}>
	{#each hymnals as hymnal (hymnal.id)}
		{@const state = scope.hymnalState(hymnal.id)}
		{@const locked = state !== 'none' && !scope.canLeaveOut({ hymnal: hymnal.id })}
		{@const expanded = open.includes(hymnal.id)}
		{@const partsId = `scope-parts-${hymnal.id}`}
		<li class="scope__hymnal">
			<div class="scope__row">
				<label class="scope__label">
					<input
						type="checkbox"
						checked={state === 'all'}
						indeterminate={state === 'some'}
						disabled={locked}
						aria-labelledby={`scope-name-${hymnal.id}`}
						aria-describedby={[
							hymnal.parts?.length ? `scope-count-${hymnal.id}` : '',
							locked ? 'scope-last' : ''
						]
							.filter(Boolean)
							.join(' ') || undefined}
						onchange={() => toggleHymnal(hymnal.id)}
					/>
					<span class="scope__text">
						<span class="scope__name" id={`scope-name-${hymnal.id}`}
							>{frenchSpaces(hymnal.name)}</span
						>
						{#if hymnal.parts?.length}
							<span class="hy-caption" id={`scope-count-${hymnal.id}`}>{partsLabel(hymnal)}</span>
						{/if}
						{#if locked}
							<span class="hy-caption" aria-hidden="true">Gardez au moins un recueil.</span>
						{/if}
					</span>
				</label>
				{#if hymnal.parts?.length}
					<button
						type="button"
						class="hb-icon-btn scope__more"
						class:is-open={expanded}
						aria-expanded={expanded}
						aria-controls={partsId}
						aria-label={frenchSpaces(
							`${expanded ? 'Masquer' : 'Afficher'} les parties de ${hymnal.name}`
						)}
						onclick={() => toggleOpen(hymnal.id)}
					>
						<Icon name="down" />
					</button>
				{/if}
			</div>
			{#if hymnal.parts?.length}
				<ul class="scope__parts" id={partsId} hidden={!expanded}>
					{#each hymnal.parts as part (part.first)}
						{@const on = scope.includesPart(hymnal.id, part.first)}
						{@const partLocked = on && !scope.canLeaveOut({ hymnal: hymnal.id, part: part.first })}
						<li>
							<label class="scope__label scope__part">
								<input
									type="checkbox"
									checked={on}
									disabled={partLocked}
									aria-describedby={partLocked ? 'scope-last' : undefined}
									onchange={() => togglePart(hymnal.id, part.first)}
								/>
								<span class="scope__name">{frenchSpaces(part.name)}</span>
							</label>
						</li>
					{/each}
				</ul>
			{/if}
		</li>
	{/each}
</ul>

{#if !scope.isEmpty}
	<button type="button" class="hb-btn scope__all" onclick={() => save(NO_EXCLUSIONS)}>
		Tout sélectionner
	</button>
{/if}

<style>
	.scope,
	.scope__parts {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.scope {
		border-top: 1px solid var(--line);
	}

	.scope__hymnal {
		border-bottom: 1px solid var(--line);
	}

	.scope__row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.scope__label {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: var(--tap-target);
		padding: 8px 0;
		cursor: pointer;
	}

	.scope__label:has(input:disabled) {
		cursor: default;
	}

	input[type='checkbox'] {
		flex: none;
		width: 20px;
		height: 20px;
		margin: 0;
		accent-color: var(--rubric);
	}

	.scope__text {
		display: flex;
		flex-direction: column;
	}

	.scope__name {
		color: var(--ink);
	}

	.scope__more :global(svg) {
		transition: transform 0.15s ease;
	}

	.scope__more.is-open :global(svg) {
		transform: rotate(180deg);
	}

	.scope__parts {
		padding: 0 0 8px 32px;
	}

	.scope__part {
		min-height: var(--tap-target);
		padding: 4px 0;
	}

	.scope__all {
		align-self: flex-start;
	}

	@media (prefers-reduced-motion: reduce) {
		.scope__more :global(svg) {
			transition: none;
		}
	}
</style>
