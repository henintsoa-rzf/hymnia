<!--
  "Not found" page (decisions §9): the reference asked for in large type, a calm explanation,
  one main action back to search, and a link to the hymnal when it exists.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { hymnalUrl } from '$lib/format';

	let {
		reference,
		title = 'Chant introuvable',
		text,
		hymnal
	}: {
		reference?: string;
		title?: string;
		text: string;
		hymnal?: { id: string; name: string };
	} = $props();
</script>

<svelte:head><title>{title} · Hymnia</title></svelte:head>

<div class="not-found">
	{#if reference}<p class="not-found__ref">{reference}</p>{/if}
	<h1 class="hy-screen-title">{title}</h1>
	<p class="not-found__text">{text}</p>
	<div class="not-found__actions">
		<a class="hb-btn hb-btn--primary" href={resolve('/')}>Retour à la recherche</a>
		{#if hymnal}
			<a class="hb-btn hb-btn--quiet not-found__secondary" href={hymnalUrl(hymnal.id)}>
				Voir les chants de {hymnal.name}
			</a>
		{/if}
	</div>
</div>

<style>
	.not-found {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 12px;
		max-width: 40em;
		min-height: 60vh;
		padding: 24px 8px;
	}

	.not-found__ref {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 44px;
		line-height: 48px;
		font-weight: 300;
		color: var(--rubric);
		font-variant-numeric: tabular-nums;
	}

	.not-found__text {
		margin: 0;
		font-size: 16px;
		line-height: 24px;
		color: var(--ink-muted);
	}

	.not-found__actions {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		margin-top: 12px;
	}

	.not-found__secondary {
		padding-left: 0;
	}
</style>
