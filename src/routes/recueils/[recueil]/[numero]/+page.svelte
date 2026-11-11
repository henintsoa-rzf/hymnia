<!--
  Hymn `/recueils/<id>/<number>` (T037, T055; FR-013 to FR-016; decisions §7).
  Phone: back and bookmark at the top, reading bar at the bottom (previous · size · next),
  horizontal swipe for previous/next. Desktop: the hymnal's list on the left, size at the top,
  previous/next under the credits.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import HymnCredits from '$lib/components/HymnCredits.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import LyricsView from '$lib/components/LyricsView.svelte';
	import NotFound from '$lib/components/NotFound.svelte';
	import OtherRefs from '$lib/components/OtherRefs.svelte';
	import TextSizeControl from '$lib/components/TextSizeControl.svelte';
	import { frenchSpaces, hymnalUrl, hymnUrl, refLabel } from '$lib/format';
	import type { EntryRef } from '$lib/data/catalog';
	import { inRepertoire, repertoire, toggleRepertoire } from '$lib/repertoire';

	let { data } = $props();

	const abbr = $derived(data.hymnal?.abbreviations[0] ?? '');
	const label = (ref: EntryRef) => refLabel(abbr, ref.entry.number);
	const urlOf = (ref: EntryRef) => hymnUrl(ref.entry.hymnal, ref.entry.number);

	const others = $derived(
		data.found
			? data.found.hymn.entries
					.filter((e) => e.hymnal !== data.found!.entry.hymnal)
					.sort(
						(a, b) =>
							(data.hymnals.get(a.hymnal)?.sortOrder ?? 0) -
							(data.hymnals.get(b.hymnal)?.sortOrder ?? 0)
					)
			: []
	);

	const item = $derived(
		data.found ? { hymnal: data.found.entry.hymnal, number: data.found.entry.number } : undefined
	);
	const bookmarked = $derived(item ? inRepertoire($repertoire, item) : false);

	/* ---------- previous / next: buttons, arrow keys, swipe ---------- */

	function open(ref: EntryRef | undefined) {
		if (ref) goto(urlOf(ref));
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable]')) return;
		if (event.key === 'ArrowLeft') open(data.previous);
		if (event.key === 'ArrowRight') open(data.next);
	}

	let start: { x: number; y: number } | undefined;
	let swipeArea = $state<HTMLElement>();
	const SWIPE_MIN = 80;

	$effect(() => {
		const el = swipeArea;
		if (!el) return;
		el.addEventListener('touchstart', ontouchstart, { passive: true });
		el.addEventListener('touchend', ontouchend, { passive: true });
		return () => {
			el.removeEventListener('touchstart', ontouchstart);
			el.removeEventListener('touchend', ontouchend);
		};
	});

	function ontouchstart(event: TouchEvent) {
		const t = event.touches[0];
		start = event.touches.length === 1 ? { x: t.clientX, y: t.clientY } : undefined;
	}

	function ontouchend(event: TouchEvent) {
		if (!start) return;
		const t = event.changedTouches[0];
		const dx = t.clientX - start.x;
		const dy = t.clientY - start.y;
		start = undefined;
		// A clear horizontal gesture only, so vertical scrolling is never taken for a swipe.
		if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < 2 * Math.abs(dy)) return;
		if (window.getSelection()?.toString()) return;
		open(dx < 0 ? data.next : data.previous);
	}
</script>

<svelte:window {onkeydown} />
<svelte:head>
	{#if data.found}
		<title>{refLabel(abbr, data.found.entry.number)} · {data.found.hymn.title} · Hymnia</title>
	{/if}
</svelte:head>

{#if data.hymnal && data.found && item}
	{@const hymnal = data.hymnal}
	{@const { hymn, entry } = data.found}

	<header class="page__header hymn-top mobile-only">
		<a class="hb-icon-btn" href={hymnalUrl(hymnal.id)} aria-label={`Retour à ${hymnal.name}`}>
			<Icon name="back" />
		</a>
		<span class="page__back-label">{hymnal.name}</span>
		<button
			type="button"
			class="hb-icon-btn"
			aria-label="Ajouter au répertoire"
			aria-pressed={bookmarked}
			onclick={() => toggleRepertoire(item)}
		>
			<Icon name="bookmark" />
		</button>
	</header>

	<div class="page hymn">
		<nav class="hymn__index desktop-only" aria-labelledby="index-title">
			<h2 id="index-title" class="hymn__index-title">
				<a href={hymnalUrl(hymnal.id)}>{hymnal.name}</a>
			</h2>
			<p class="hy-caption hymn__index-count">{hymnal.abbreviations[0]}</p>
			<ol class="hb-list">
				{#each data.siblings as sibling (sibling.entry.number)}
					{@const current = sibling.entry.number === entry.number}
					<li>
						<a
							class="hb-item__link hymn__index-link"
							class:is-current={current}
							href={urlOf(sibling)}
							aria-current={current ? 'page' : undefined}
						>
							<span class="hb-item__num">{sibling.entry.number}</span>
							<span>{frenchSpaces(sibling.hymn.title)}</span>
						</a>
					</li>
				{/each}
			</ol>
		</nav>

		<div class="hymn__body">
			<div class="hymn__tools desktop-only">
				<TextSizeControl />
				<button
					type="button"
					class="hb-btn"
					aria-pressed={bookmarked}
					onclick={() => toggleRepertoire(item)}
				>
					<Icon name="bookmark" />
					{bookmarked ? 'Dans le répertoire' : 'Ajouter au répertoire'}
				</button>
			</div>

			<div class="hymn__swipe" bind:this={swipeArea}>
				<LyricsView {hymn} reference={refLabel(abbr, entry.number)}>
					<HymnCredits {hymn} />
				</LyricsView>
			</div>

			<OtherRefs entries={others} hymnals={data.hymnals} />

			<nav class="hymn__neighbours desktop-only" aria-label="Chants voisins">
				{#if data.previous}
					<a class="hy-nav-btn" href={urlOf(data.previous)}>
						<Icon name="back" />
						<span
							><span class="hy-nav-btn__ref">{label(data.previous)}</span> · {frenchSpaces(
								data.previous.hymn.title
							)}</span
						>
					</a>
				{:else}
					<span class="hy-nav-btn" aria-disabled="true"
						><Icon name="back" />Premier chant du recueil</span
					>
				{/if}
				{#if data.next}
					<a class="hy-nav-btn hymn__next" href={urlOf(data.next)}>
						<span
							><span class="hy-nav-btn__ref">{label(data.next)}</span> · {frenchSpaces(
								data.next.hymn.title
							)}</span
						>
						<Icon name="forward" />
					</a>
				{:else}
					<span class="hy-nav-btn hymn__next" aria-disabled="true"
						>Dernier chant du recueil<Icon name="forward" /></span
					>
				{/if}
			</nav>
		</div>
	</div>

	<div class="hy-readbar mobile-only" role="toolbar" aria-label="Lecture">
		{#if data.previous}
			<a
				class="hy-nav-btn"
				href={urlOf(data.previous)}
				aria-label={`Chant précédent : ${label(data.previous)}, ${data.previous.hymn.title}`}
			>
				<Icon name="back" /><span class="hy-nav-btn__ref">{label(data.previous)}</span>
			</a>
		{:else}
			<button
				type="button"
				class="hy-nav-btn"
				disabled
				aria-label={`Pas de chant précédent : ${refLabel(abbr, entry.number)} est le premier du recueil`}
			>
				<Icon name="back" />
			</button>
		{/if}
		<TextSizeControl />
		{#if data.next}
			<a
				class="hy-nav-btn"
				href={urlOf(data.next)}
				aria-label={`Chant suivant : ${label(data.next)}, ${data.next.hymn.title}`}
			>
				<span class="hy-nav-btn__ref">{label(data.next)}</span><Icon name="forward" />
			</a>
		{:else}
			<button
				type="button"
				class="hy-nav-btn"
				disabled
				aria-label={`Pas de chant suivant : ${refLabel(abbr, entry.number)} est le dernier du recueil`}
			>
				<Icon name="forward" />
			</button>
		{/if}
	</div>
{:else}
	{@const known = data.hymnal}
	<div class="page">
		<NotFound
			reference={known
				? refLabel(known.abbreviations[0], data.requested.number)
				: `${data.requested.hymnal.toUpperCase()} ${data.requested.number}`}
			text={known
				? `Il n’y a pas de chant n° ${data.requested.number} dans ${known.name}. Le numéro est peut-être mal saisi, ou ce chant n’a pas encore été ajouté.`
				: `Aucun recueil « ${data.requested.hymnal} » dans Hymnia.`}
			hymnal={known ? { id: known.id, name: known.name } : undefined}
		/>
	</div>
{/if}

<style>
	.hymn-top {
		padding: 8px 8px 0;
	}

	.hymn {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 48px;
		max-width: 1200px;
		padding-top: 16px;
	}

	.hymn__index {
		flex: 1 1 240px;
		min-width: 0;
		max-width: 300px;
		position: sticky;
		top: 16px;
		max-height: calc(100vh - 32px);
		overflow-y: auto;
	}

	.hymn__index-title {
		margin: 0;
		font-size: 15px;
		line-height: 22px;
		font-weight: 600;
	}

	.hymn__index-title a {
		color: var(--ink);
		text-decoration: none;
	}

	.hymn__index-count {
		margin-bottom: 12px;
	}

	.hymn__index-link {
		padding-left: 8px;
		padding-right: 8px;
		font-size: 15px;
		line-height: 22px;
		color: var(--ink);
	}

	.hymn__index-link .hb-item__num {
		font-size: 16px;
	}

	.hymn__body {
		flex: 999 1 560px;
		min-width: 0;
	}

	.hymn__swipe {
		touch-action: pan-y pinch-zoom;
	}

	.hymn__tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		margin-bottom: 32px;
	}

	.hymn__tools .hb-btn[aria-pressed='true'] {
		color: var(--rubric);
	}

	.hymn__tools .hb-btn[aria-pressed='true'] :global(svg) {
		fill: currentColor;
	}

	.hymn__neighbours {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		max-width: var(--measure-lyrics);
		margin: 48px auto 0;
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}

	.hymn__next {
		margin-left: auto;
		text-align: right;
	}

	@media (min-width: 1024px) {
		.hymn {
			padding-top: 32px;
		}
	}
</style>
