<!-- A book's chapters `/bible/<livre>` (feature 015, contracts/bible-ui.md §2.2). -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import NotFound from '$lib/components/NotFound.svelte';

	let { data } = $props();

	const chapters = $derived(
		data.book ? Array.from({ length: data.book.chapters }, (_, i) => i + 1) : []
	);
	const booksUrl = `${resolve('/bible')}?livres`;
</script>

<svelte:head>
	{#if data.book && data.bible}<title>{data.book.name} · Hymnia</title>{/if}
</svelte:head>

{#if data.book && data.bible}
	{@const book = data.book}
	<div class="page chapters">
		<header class="page__header page__header--back">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus ?livres -->
			<a class="hb-icon-btn" href={booksUrl} aria-label="Retour aux livres de la Bible">
				<Icon name="back" />
			</a>
			<span class="page__back-label">Bible</span>
		</header>
		<h1 class="hy-screen-title">{book.name}</h1>
		<ol class="hb-list chapters__grid" aria-label={`Chapitres de ${book.name}`}>
			{#each chapters as n (n)}
				<li>
					<a
						class="chapters__link"
						href={resolve('/bible/[livre]/[chapitre]', { livre: book.slug, chapitre: `${n}` })}
						aria-label={`Chapitre ${n}`}>{n}</a
					>
				</li>
			{/each}
		</ol>
	</div>
{:else}
	<div class="page">
		<NotFound
			title="Livre introuvable"
			text={data.bible
				? `Aucun livre « ${data.slug} » dans la Bible.`
				: 'La Bible n’est pas disponible dans cette version.'}
			back={{ href: booksUrl, label: 'Livres de la Bible' }}
		/>
	</div>
{/if}

<style>
	.chapters {
		max-width: 720px;
	}

	.chapters__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
		gap: var(--space-2);
		margin-top: var(--space-4);
	}

	.chapters__link {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: var(--tap-target);
		min-height: 52px;
		border-radius: var(--radius-sm);
		background: var(--paper-sunken);
		font-family: var(--font-serif);
		font-size: 18px;
		line-height: 24px;
		color: var(--ink);
		text-decoration: none;
		font-variant-numeric: tabular-nums;
	}

	.chapters__link:hover {
		background: var(--rubric-soft);
		color: var(--rubric);
	}
</style>
