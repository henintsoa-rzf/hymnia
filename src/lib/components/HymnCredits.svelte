<!-- Full credits and source (T053, FR-014, decisions §7.1 item 6). -->
<script lang="ts">
	import type { PublishedHymn } from '$lib/domain/schema';
	import { creditLines, formatDate } from '$lib/format';

	let { hymn }: { hymn: PublishedHymn } = $props();

	const lines = $derived(creditLines(hymn.credits));
</script>

<footer class="hb-credits">
	{#if lines.length > 0}
		<p>
			{#each lines as [label, names], i (label)}{#if i > 0}<br />{/if}{label}&#8239;: {names}{/each}
		</p>
	{/if}
	<p>
		Source&#8239;:
		{#if hymn.source.url}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external source page -->
			<a href={hymn.source.url} rel="noopener noreferrer" target="_blank">{hymn.source.name}</a>
		{:else}
			{hymn.source.name}
		{/if}
		· consultée le {formatDate(hymn.source.retrievedAt)}
	</p>
</footer>
