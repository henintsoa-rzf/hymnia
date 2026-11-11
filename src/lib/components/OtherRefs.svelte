<!-- "Aussi dans" (T054, FR-014, US4 scenario 3): the other hymnals where this hymn appears. -->
<script lang="ts">
	import type { PublishedEntry, PublishedHymnal } from '$lib/domain/schema';
	import { hymnUrl, refLabel } from '$lib/format';
	import Icon from './Icon.svelte';

	let { entries, hymnals }: { entries: PublishedEntry[]; hymnals: Map<string, PublishedHymnal> } =
		$props();
</script>

{#if entries.length > 0}
	<section class="other-refs" aria-labelledby="other-refs-title">
		<h2 id="other-refs-title" class="hy-overline">Aussi dans</h2>
		<ul class="hb-list">
			{#each entries as entry (entry.hymnal)}
				{@const hymnal = hymnals.get(entry.hymnal)}
				<li>
					<a class="hy-row other-refs__row" href={hymnUrl(entry.hymnal, entry.number)}>
						<span class="hy-ref"
							>{refLabel(hymnal?.abbreviations[0] ?? entry.hymnal, entry.number)}</span
						>
						<span class="other-refs__name">{hymnal?.name ?? entry.hymnal}</span>
						<Icon name="forward" />
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.other-refs {
		max-width: var(--measure-lyrics);
		margin: var(--space-8) auto 0;
		font-family: var(--font-sans);
	}

	.other-refs__row {
		min-height: 52px;
	}

	.other-refs__name {
		flex-grow: 1;
		font-size: 15px;
		line-height: 22px;
		color: var(--ink);
	}
</style>
