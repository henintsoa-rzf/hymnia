<!--
  A Bible chapter `/bible/<livre>/<chapitre>` (feature 015, contracts/bible-ui.md §2.3): the
  verses, then a reading bar (previous chapter · chapters of the book · next chapter), across
  books. `?v=<n>` brings verse n into view. The chapter shown is remembered (prefs.bibleAt).
  Tapping a verse chooses it; the selection bar then offers the search from verses (§3).
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { bookByCode, type BookCode, type VerseId } from '$lib/bible/books';
	import { copyText } from '$lib/bible/query';
	import { appSelection } from '$lib/bible/selection';
	import Icon from '$lib/components/Icon.svelte';
	import NotFound from '$lib/components/NotFound.svelte';
	import VerseList from '$lib/components/VerseList.svelte';
	import VerseSelectionBar from '$lib/components/VerseSelectionBar.svelte';
	import { prefs } from '$lib/prefs/prefs';

	let { data } = $props();

	const chapterUrl = (book: BookCode, chapter: number) =>
		resolve('/bible/[livre]/[chapitre]', {
			livre: bookByCode(book)!.slug,
			chapitre: `${chapter}`
		});

	type Step = { url: string; short: string; label: string };
	const step = (ref: { book: BookCode; chapter: number } | undefined): Step | undefined => {
		if (!ref) return undefined;
		const book = bookByCode(ref.book)!;
		return {
			url: chapterUrl(ref.book, ref.chapter),
			short:
				book.code === data.book?.code
					? `${ref.chapter}`
					: `${book.abbreviations[0]} ${ref.chapter}`,
			label: `${book.name} ${ref.chapter}`
		};
	};
	const previous = $derived(
		data.book && data.bible ? step(data.bible.previous(data.book.code, data.chapter)) : undefined
	);
	const next = $derived(
		data.book && data.bible ? step(data.bible.next(data.book.code, data.chapter)) : undefined
	);
	const focus = $derived(Number(page.url.searchParams.get('v')) || undefined);

	// The chapter shown is where the Bible section reopens (FR-008).
	$effect(() => {
		const book = data.book;
		const chapter = data.chapter;
		if (!book || !data.verses) return;
		prefs.update((p) =>
			p.bibleAt?.book === book.code && p.bibleAt.chapter === chapter
				? p
				: { ...p, bibleAt: { book: book.code, chapter } }
		);
	});

	/* ---------- choosing verses (US2) ---------- */

	const selection = $derived(data.bible ? appSelection(data.bible) : undefined);
	const chosen = $derived(selection ? $selection : undefined);
	const selectedSet = $derived(new Set(chosen?.ids ?? []));
	let limitHit = $state(0);

	function toggle(id: VerseId) {
		if (selection?.toggle(id) === 'too-long') limitHit++;
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable], dialog')) return;
		const to = event.key === 'ArrowLeft' ? previous : event.key === 'ArrowRight' ? next : undefined;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- step URLs are resolved
		if (to) goto(to.url);
	}
</script>

<svelte:window {onkeydown} />
<svelte:head>
	{#if data.book && data.verses}<title>{data.book.name} {data.chapter} · Hymnia</title>{/if}
</svelte:head>

{#if data.book && data.verses}
	{@const book = data.book}
	<div class="page chapter" class:chapter--selecting={selectedSet.size > 0}>
		<header class="page__header page__header--back">
			<a
				class="hb-icon-btn"
				href={resolve('/bible/[livre]', { livre: book.slug })}
				aria-label={`Chapitres de ${book.name}`}
			>
				<Icon name="back" />
			</a>
			<span class="page__back-label">{book.name}</span>
		</header>

		<h1 class="chapter__title">{book.name} {data.chapter}</h1>
		<VerseList
			book={book.code}
			chapter={data.chapter}
			verses={data.verses}
			{focus}
			selected={selectedSet}
			ontoggle={toggle}
		/>
		<p class="hy-caption chapter__source">Louis Segond 1910</p>
	</div>

	{#if selection && chosen}
		<VerseSelectionBar
			selection={chosen}
			{limitHit}
			onclear={() => selection.clear()}
			copyText={data.bible ? copyText(chosen.ids, data.bible) : ''}
		/>
	{/if}

	<!-- eslint-disable svelte/no-navigation-without-resolve -- step URLs are resolved -->
	<div class="hy-readbar chapter__bar" role="toolbar" aria-label="Lecture">
		{#if previous}
			<a
				class="hy-nav-btn"
				href={previous.url}
				aria-label={`Chapitre précédent : ${previous.label}`}
			>
				<Icon name="back" /><span class="hy-nav-btn__ref">{previous.short}</span>
			</a>
		{:else}
			<button type="button" class="hy-nav-btn" disabled aria-label="Pas de chapitre précédent">
				<Icon name="back" />
			</button>
		{/if}
		<a
			class="hy-nav-btn chapter__here"
			href={resolve('/bible/[livre]', { livre: book.slug })}
			aria-label={`${book.name} ${data.chapter}, choisir un autre chapitre`}
		>
			{book.name}
			{data.chapter}<Icon name="down" />
		</a>
		{#if next}
			<a class="hy-nav-btn" href={next.url} aria-label={`Chapitre suivant : ${next.label}`}>
				<span class="hy-nav-btn__ref">{next.short}</span><Icon name="forward" />
			</a>
		{:else}
			<button type="button" class="hy-nav-btn" disabled aria-label="Pas de chapitre suivant">
				<Icon name="forward" />
			</button>
		{/if}
	</div>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<div class="page">
		<NotFound
			reference={data.book ? `${data.book.name} ${data.chapter || ''}`.trim() : data.requested}
			title="Chapitre introuvable"
			text={!data.bible
				? 'La Bible n’est pas disponible dans cette version.'
				: data.book
					? `${data.book.name} compte ${data.book.chapters} chapitre${data.book.chapters > 1 ? 's' : ''}.`
					: 'Ce livre n’existe pas dans la Bible.'}
			back={{ href: `${resolve('/bible')}?livres`, label: 'Livres de la Bible' }}
		/>
	</div>
{/if}

<style>
	.chapter {
		max-width: 760px;
	}

	.chapter__title {
		margin: var(--space-2) 0 var(--space-4);
		font-family: var(--font-serif);
		font-size: calc(var(--lyric) * 1.3);
		line-height: 1.3;
		font-weight: 500;
		color: var(--ink);
	}

	.chapter__source {
		margin-top: var(--space-6);
	}

	/* Room for the selection bar over the last verses. */
	.chapter--selecting {
		padding-bottom: 160px;
	}

	.chapter__here {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	@media (min-width: 1024px) {
		.chapter {
			padding-top: 16px;
			/* Room for the reading bar, fixed on every screen size here. */
			padding-bottom: 96px;
		}

		.chapter--selecting {
			padding-bottom: 240px;
		}

		.chapter__bar {
			left: 50%;
			right: auto;
			width: min(760px, 100%);
			transform: translateX(-50%);
			border: 1px solid var(--line);
			border-bottom: 0;
			border-radius: var(--radius-md) var(--radius-md) 0 0;
		}
	}
</style>
