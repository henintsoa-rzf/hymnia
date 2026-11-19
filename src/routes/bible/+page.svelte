<!--
  Bible `/bible` (feature 015, contracts/bible-ui.md §2.1): a field to go to a reference, then the
  books of the Ancien and Nouveau Testament. The load function reopens the last chapter read
  unless `?livres` is in the URL.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { BOOKS, bookByCode, type Book } from '$lib/bible/books';
	import { parseReference } from '$lib/bible/reference';
	import Icon from '$lib/components/Icon.svelte';

	let { data } = $props();

	const groups = [
		{ id: 'at', title: 'Ancien Testament', books: BOOKS.filter((b) => b.testament === 'AT') },
		{ id: 'nt', title: 'Nouveau Testament', books: BOOKS.filter((b) => b.testament === 'NT') }
	];

	let reference = $state('');
	let error = $state('');

	/** One-chapter books open their chapter at once. */
	const bookHref = (book: Book) =>
		book.chapters === 1
			? resolve('/bible/[livre]/[chapitre]', { livre: book.slug, chapitre: '1' })
			: resolve('/bible/[livre]', { livre: book.slug });

	function go(event: SubmitEvent) {
		event.preventDefault();
		if (!data.bible || !reference.trim()) return;
		const ref = parseReference(reference, data.bible.verseCount);
		if (!ref) {
			error = 'Référence introuvable';
			return;
		}
		error = '';
		const book = bookByCode(ref.book)!;
		const url = resolve('/bible/[livre]/[chapitre]', {
			livre: book.slug,
			chapitre: `${ref.chapter}`
		});
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved above, plus ?v=
		goto(ref.verse ? `${url}?v=${ref.verse}` : url);
	}
</script>

<svelte:head><title>Bible · Hymnia</title></svelte:head>

<div class="page bible">
	<header class="page__header">
		<h1 class="hy-screen-title">Bible</h1>
	</header>

	{#if data.bible}
		<form class="bible__go" onsubmit={go} role="search" aria-label="Aller à une référence">
			<label class="hb-search">
				<Icon name="search" />
				<input
					type="search"
					bind:value={reference}
					oninput={() => (error = '')}
					placeholder="Aller à… (ex. Jean 3:16)"
					aria-label="Aller à une référence, par exemple Jean 3:16"
					aria-invalid={error ? 'true' : undefined}
					aria-describedby={error ? 'reference-error' : undefined}
					enterkeyhint="go"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
				/>
			</label>
			{#if error}<p class="hy-field-error" id="reference-error" role="alert">{error}</p>{/if}
		</form>

		{#each groups as group (group.id)}
			<section aria-labelledby={`books-${group.id}`}>
				<h2 class="hb-overline bible__group" id={`books-${group.id}`}>{group.title}</h2>
				<ul class="hb-list bible__books">
					{#each group.books as book (book.code)}
						<li><a class="bible__book" href={bookHref(book)}>{book.name}</a></li>
					{/each}
				</ul>
			</section>
		{/each}

		<p class="hy-caption bible__source">Louis Segond 1910 · domaine public</p>
	{:else}
		<div class="hy-message" role="status">
			<p class="hy-message__title">La Bible n’est pas disponible dans cette version</p>
			<p class="hy-message__text">Les recueils restent consultables.</p>
		</div>
	{/if}
</div>

<style>
	.bible {
		max-width: 720px;
	}

	.bible__go {
		padding: 12px 0 4px;
	}

	.bible__group {
		margin-top: var(--space-6);
	}

	.bible__books {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		column-gap: var(--space-4);
	}

	.bible__book {
		display: flex;
		align-items: center;
		min-height: var(--tap-target);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--line);
		font-size: 17px;
		line-height: 24px;
		font-weight: 500;
		color: var(--ink);
		text-decoration: none;
	}

	.bible__book:hover {
		color: var(--rubric);
	}

	.bible__source {
		margin-top: var(--space-8);
	}

	@media (min-width: 1024px) {
		.bible {
			padding-top: 32px;
		}
	}
</style>
