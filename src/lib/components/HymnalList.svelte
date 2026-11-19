<!--
  Hymnals with their name and hymn count (T047, FR-011, decisions §5). Feature 014: `counts`
  replaces the count of a hymnal partly in use (hymns in use only).
-->
<script lang="ts">
	import type { PublishedHymnal } from '$lib/domain/schema';
	import { hymnalUrl, hymnCountLabel } from '$lib/format';
	import Icon from './Icon.svelte';

	let {
		hymnals,
		labelledby,
		counts
	}: { hymnals: PublishedHymnal[]; labelledby?: string; counts?: Map<string, number> } = $props();
</script>

<ul class="hb-list hymnal-list" aria-labelledby={labelledby}>
	{#each hymnals as hymnal (hymnal.id)}
		<li>
			<a class="hy-row" href={hymnalUrl(hymnal.id)}>
				<span class="hy-tile" aria-hidden="true">{hymnal.abbreviations[0]}</span>
				<span class="hy-row__text">
					<span class="hy-row__title">{hymnal.name}</span>
					<span class="hy-row__meta"
						>{hymnal.abbreviations[0]} · {hymnCountLabel(
							counts?.get(hymnal.id) ?? hymnal.hymnCount
						)}</span
					>
				</span>
				<Icon name="forward" />
			</a>
		</li>
	{/each}
</ul>

<style>
	.hymnal-list {
		border-top: 1px solid var(--line);
	}
</style>
