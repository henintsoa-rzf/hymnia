<!--
  Hymn `/recueils/<id>/<number>` (T037, T055; FR-013 to FR-016; decisions §7).
  Phone: back and bookmark at the top, reading bar at the bottom (previous · size · next),
  horizontal swipe for previous/next. Desktop: the list on the left, size at the top,
  previous/next under the credits.
  Feature 003: the bookmark opens the choice of collections; with `?collection=<id>`, the hymn
  is read in that collection's order (previous/next, list, "<name> · 2 / 5").
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import CollectionSheet from '$lib/components/CollectionSheet.svelte';
	import HymnCredits from '$lib/components/HymnCredits.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import LyricsView from '$lib/components/LyricsView.svelte';
	import NotFound from '$lib/components/NotFound.svelte';
	import OtherRefs from '$lib/components/OtherRefs.svelte';
	import TextSizeControl from '$lib/components/TextSizeControl.svelte';
	import { normalizeNumber } from '$lib/domain/numbering';
	import { titleIn } from '$lib/domain/titles';
	import { frenchSpaces, hymnalUrl, hymnInCollectionUrl, hymnUrl, refLabel } from '$lib/format';
	import { collectionsWith } from '$lib/repertoire/model';
	import { hymnIdOf, resolveEntries } from '$lib/repertoire/resolve';
	import { repertoire } from '$lib/repertoire/store';

	let { data } = $props();

	const abbr = $derived(data.hymnal?.abbreviations[0] ?? '');
	const idOf = $derived(hymnIdOf(data.catalog));

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
	const bookmarked = $derived(item ? collectionsWith($repertoire, item, idOf).length : 0);
	let sheetOpen = $state(false);

	/* ---------- reading order: the hymnal, or a collection (?collection=<id>) ---------- */

	type Step = { url: string; ref: string; title: string; current: boolean };

	/** The collection being read, when the hymn is in it; otherwise the hymnal (001). */
	const reading = $derived.by(() => {
		const id = page.url.searchParams.get('collection');
		const found = data.found;
		if (!id || !found) return undefined;
		const collection = $repertoire.collections.find((c) => c.id === id);
		if (!collection) return undefined;
		const rows = resolveEntries(data.catalog, collection).filter((r) => r.available);
		const key = normalizeNumber(found.entry.number);
		const position = rows.findIndex(
			(r) => r.entry.hymnal === found.entry.hymnal && normalizeNumber(r.entry.number) === key
		);
		if (position < 0) return undefined;
		const steps: Step[] = rows.map((r, i) => ({
			url: hymnInCollectionUrl(r.entry.hymnal, r.entry.number, collection.id),
			ref: refLabel(r.hymnal?.abbreviations[0] ?? r.entry.hymnal, r.entry.number),
			title: titleIn(r.hymn!, r.entry.hymnal, r.entry.number),
			current: i === position
		}));
		return { collection, steps, position };
	});

	const steps = $derived.by((): Step[] => {
		if (reading) return reading.steps;
		return data.siblings.map((s) => ({
			url: hymnUrl(s.entry.hymnal, s.entry.number),
			ref: refLabel(abbr, s.entry.number),
			title: s.entry.title ?? s.hymn.title,
			current: s.entry.number === data.found?.entry.number
		}));
	});
	const position = $derived(steps.findIndex((s) => s.current));
	const previous = $derived(position > 0 ? steps[position - 1] : undefined);
	const next = $derived(position >= 0 ? steps[position + 1] : undefined);
	const where = $derived(reading ? 'de la collection' : 'du recueil');

	/* ---------- previous / next: buttons, arrow keys, swipe ---------- */

	function open(step: Step | undefined) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- step URLs are built from resolved hymn URLs
		if (step) goto(step.url);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable], dialog')) return;
		if (event.key === 'ArrowLeft') open(previous);
		if (event.key === 'ArrowRight') open(next);
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
		open(dx < 0 ? next : previous);
	}
</script>

<svelte:window {onkeydown} />
<svelte:head>
	{#if data.found}
		<title
			>{refLabel(abbr, data.found.entry.number)} · {data.found.entry.title ?? data.found.hymn.title} ·
			Hymnia</title
		>
	{/if}
</svelte:head>

<!-- eslint-disable svelte/no-navigation-without-resolve -- step URLs are built from resolved hymn URLs -->
{#if data.hymnal && data.found && item}
	{@const hymnal = data.hymnal}
	{@const { hymn, entry } = data.found}
	{@const title = entry.title ?? hymn.title}
	{@const backUrl = reading
		? resolve('/repertoire/[collection]', { collection: reading.collection.id })
		: hymnalUrl(hymnal.id)}
	{@const backName = reading ? reading.collection.name : hymnal.name}

	<header class="page__header hymn-top mobile-only">
		<a class="hb-icon-btn" href={backUrl} aria-label={`Retour à ${backName}`}>
			<Icon name="back" />
		</a>
		<span class="page__back-label"
			>{backName}{reading ? ` · ${position + 1}\u00a0/\u00a0${steps.length}` : ''}</span
		>
		<button
			type="button"
			class="hb-icon-btn"
			aria-label="Ajouter à une collection"
			aria-haspopup="dialog"
			aria-pressed={bookmarked > 0}
			onclick={() => (sheetOpen = true)}
		>
			<Icon name="bookmark" />
		</button>
	</header>

	<div class="page hymn">
		<nav class="hymn__index desktop-only" aria-labelledby="index-title">
			<h2 id="index-title" class="hymn__index-title">
				<a href={backUrl}>{backName}</a>
			</h2>
			<p class="hy-caption hymn__index-count">
				{reading ? `${position + 1} / ${steps.length}` : hymnal.abbreviations[0]}
			</p>
			<ol class="hb-list">
				{#each steps as step (step.url)}
					<li>
						<a
							class="hb-item__link hymn__index-link"
							class:is-current={step.current}
							href={step.url}
							aria-current={step.current ? 'page' : undefined}
						>
							<span class="hb-item__num">{reading ? step.ref : step.ref.replace(/^\S+\s/, '')}</span
							>
							<span>{frenchSpaces(step.title)}</span>
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
					aria-haspopup="dialog"
					aria-pressed={bookmarked > 0}
					onclick={() => (sheetOpen = true)}
				>
					<Icon name="bookmark" />
					{bookmarked === 0
						? 'Ajouter à une collection'
						: bookmarked === 1
							? 'Dans 1 collection'
							: `Dans ${bookmarked} collections`}
				</button>
			</div>

			<div class="hymn__swipe" bind:this={swipeArea}>
				<LyricsView {hymn} {title} reference={refLabel(abbr, entry.number)}>
					<HymnCredits {hymn} />
				</LyricsView>
			</div>

			<OtherRefs entries={others} hymnals={data.hymnals} />

			<nav class="hymn__neighbours desktop-only" aria-label="Chants voisins">
				{#if previous}
					<a class="hy-nav-btn" href={previous.url}>
						<Icon name="back" />
						<span
							><span class="hy-nav-btn__ref">{previous.ref}</span> · {frenchSpaces(
								previous.title
							)}</span
						>
					</a>
				{:else}
					<span class="hy-nav-btn" aria-disabled="true"
						><Icon name="back" />Premier chant {where}</span
					>
				{/if}
				{#if next}
					<a class="hy-nav-btn hymn__next" href={next.url}>
						<span><span class="hy-nav-btn__ref">{next.ref}</span> · {frenchSpaces(next.title)}</span
						>
						<Icon name="forward" />
					</a>
				{:else}
					<span class="hy-nav-btn hymn__next" aria-disabled="true"
						>Dernier chant {where}<Icon name="forward" /></span
					>
				{/if}
			</nav>
		</div>
	</div>

	<div class="hy-readbar mobile-only" role="toolbar" aria-label="Lecture">
		{#if previous}
			<a
				class="hy-nav-btn"
				href={previous.url}
				aria-label={`Chant précédent : ${previous.ref}, ${previous.title}`}
			>
				<Icon name="back" /><span class="hy-nav-btn__ref">{previous.ref}</span>
			</a>
		{:else}
			<button
				type="button"
				class="hy-nav-btn"
				disabled
				aria-label={`Pas de chant précédent : ${refLabel(abbr, entry.number)} est le premier ${where}`}
			>
				<Icon name="back" />
			</button>
		{/if}
		<TextSizeControl />
		{#if next}
			<a
				class="hy-nav-btn"
				href={next.url}
				aria-label={`Chant suivant : ${next.ref}, ${next.title}`}
			>
				<span class="hy-nav-btn__ref">{next.ref}</span><Icon name="forward" />
			</a>
		{:else}
			<button
				type="button"
				class="hy-nav-btn"
				disabled
				aria-label={`Pas de chant suivant : ${refLabel(abbr, entry.number)} est le dernier ${where}`}
			>
				<Icon name="forward" />
			</button>
		{/if}
	</div>

	<CollectionSheet bind:open={sheetOpen} ref={item} {title} hymnIdOf={idOf} />
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

<!-- eslint-enable svelte/no-navigation-without-resolve -->

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
