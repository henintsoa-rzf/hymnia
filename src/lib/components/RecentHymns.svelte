<!--
  « Récemment consultés » on the search screen (feature 006, US1; contracts/ui.md): the hymns
  opened on this device, newest first, each opening at the reference it was opened under.
-->
<script lang="ts">
	import { titleIn } from '$lib/domain/titles';
	import { frenchSpaces, hymnUrl, refLabel } from '$lib/format';
	import type { RecentHymn } from '$lib/history/resolve';
	import Icon from './Icon.svelte';

	let { rows, onclear }: { rows: RecentHymn[]; onclear: () => void } = $props();

	const uid = $props.id();

	/** « CE 12a · Cantiques d’exemple ». */
	const meta = (row: RecentHymn) => {
		const ref = refLabel(row.hymnalInfo?.abbreviations[0] ?? row.hymnal, row.number);
		return row.hymnalInfo ? `${ref} · ${row.hymnalInfo.name}` : ref;
	};
</script>

{#if rows.length > 0}
	<section class="recent" aria-labelledby="{uid}-title">
		<div class="recent__head">
			<h2 class="hb-overline" id="{uid}-title">Récemment consultés</h2>
			<button
				type="button"
				class="hb-btn hb-btn--quiet recent__clear"
				aria-label="Effacer les chants récents"
				onclick={onclear}>Effacer</button
			>
		</div>
		<ul class="hb-list recent__list" aria-labelledby="{uid}-title">
			{#each rows as row (row.hymn.id)}
				<li>
					<a class="hy-row" href={hymnUrl(row.hymnal, row.number)}>
						<span class="hy-row__text">
							<span class="hy-row__title"
								>{frenchSpaces(titleIn(row.hymn, row.hymnal, row.number))}</span
							>
							<span class="hy-row__meta">{meta(row)}</span>
						</span>
						<Icon name="forward" />
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.recent__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.recent__head .hb-overline {
		margin-bottom: var(--space-1);
	}

	.recent__clear {
		margin-right: calc(-1 * var(--space-4));
		font-size: 13px;
	}

	.recent__list {
		border-top: 1px solid var(--line);
	}
</style>
