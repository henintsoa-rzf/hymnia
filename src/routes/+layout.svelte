<!--
  App shell (T025): navigation, theme and text size from the reading preferences. Feature 016:
  lyric font and line spacing too; Réglages stays current in all its sections.
-->
<script lang="ts">
	import '@fontsource-variable/literata/opsz.css';
	import '@fontsource-variable/literata/opsz-italic.css';
	import '@fontsource-variable/instrument-sans/wght.css';
	import '../app.css';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import StorageNotice from '$lib/components/StorageNotice.svelte';
	import UndoToast from '$lib/components/UndoToast.svelte';
	import UpdatePrompt from '$lib/components/UpdatePrompt.svelte';
	import { loadCatalog } from '$lib/data/store';
	import { prefs } from '$lib/prefs/prefs';
	import { collectRepairs } from '$lib/repertoire/resolve';
	import { repertoire } from '$lib/repertoire/store';
	import { scheduleMeaningPrefetch } from '$lib/search/session';

	let { children } = $props();

	const THEME_COLORS = { light: '#faf8f4', dark: '#141311' };

	$effect(() => {
		const root = document.documentElement;
		const { theme, textScale, lyricFont, lineSpacing } = $prefs;
		if (theme === 'system') delete root.dataset.theme;
		else root.dataset.theme = theme;
		root.style.setProperty('--text-scale', String(textScale));
		// Feature 016 (research R4): stanza font and line spacing, read by .hb-stanza.
		root.dataset.lyricFont = lyricFont;
		root.dataset.lineSpacing = lineSpacing;

		// Browser chrome follows a forced theme too.
		const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
		metas.forEach((meta, i) => {
			const systemColor = i === 0 ? THEME_COLORS.light : THEME_COLORS.dark;
			meta.content = theme === 'system' ? systemColor : THEME_COLORS[theme];
		});
	});

	// Saved entries follow their hymn when a data update renumbered or merged it (feature 002,
	// FR-027): store the repairs once the catalog of this visit is loaded.
	$effect(() => {
		loadCatalog()
			.then((catalog) =>
				repertoire.applyRepairs(collectRepairs(catalog, repertoire.current().collections))
			)
			.catch(() => {
				// No catalog yet (offline first visit): the screens show their own message.
			});
	});

	// Feature 011 (research R8): the meaning data downloads in the background once the app is
	// idle, never in the install download.
	$effect(() => scheduleMeaningPrefetch());

	// Feature 015: the Bible tab shows when the build has a Bible (known once the catalog loads;
	// shown meanwhile, as the builds of the app always have one).
	let bibleAvailable = $state(true);
	$effect(() => {
		loadCatalog()
			.then((catalog) => (bibleAvailable = Boolean(catalog.bibleFile)))
			.catch(() => {});
	});

	const routeId = $derived(page.route.id ?? '');
	const section = $derived(
		routeId === '/'
			? 'search'
			: routeId.startsWith('/recueils') && !page.url.searchParams.has('collection')
				? 'hymnals'
				: routeId.startsWith('/recueils')
					? 'repertoire'
					: routeId.startsWith('/repertoire')
						? 'repertoire'
						: routeId.startsWith('/bible')
							? 'bible'
							: null
	);
	// The hymn and Bible chapter screens have their own reading bar instead of the tab bar
	// (decisions §3, feature 015).
	const reading = $derived(
		routeId === '/recueils/[recueil]/[numero]' || routeId === '/bible/[livre]/[chapitre]'
	);

	const allLinks = [
		{ id: 'search', href: resolve('/'), label: 'Recherche', icon: 'search' },
		{ id: 'hymnals', href: resolve('/recueils'), label: 'Recueils', icon: 'book' },
		{ id: 'bible', href: resolve('/bible'), label: 'Bible', icon: 'bible' },
		{ id: 'repertoire', href: resolve('/repertoire'), label: 'Répertoire', icon: 'bookmark' }
	] as const;
	const links = $derived(allLinks.filter((l) => l.id !== 'bible' || bibleAvailable));
</script>

<a class="skip-link" href="#contenu">Aller au contenu</a>

<header class="hy-topnav desktop-only">
	<a class="hy-topnav__brand" href={resolve('/')}>Hymnia</a>
	<nav class="hy-topnav__links" aria-label="Navigation principale">
		{#each links as link (link.id)}
			<a
				class="hy-topnav__link"
				href={link.href}
				aria-current={section === link.id ? 'page' : undefined}>{link.label}</a
			>
		{/each}
	</nav>
	<a
		class="hb-icon-btn"
		href={resolve('/reglages')}
		aria-label="Réglages"
		aria-current={routeId.startsWith('/reglages') ? 'page' : undefined}><Icon name="settings" /></a
	>
</header>

<main id="contenu" tabindex="-1" class="app-main" class:app-main--reading={reading}>
	{@render children()}
</main>

{#if !reading}
	<nav class="hy-tabbar mobile-only" aria-label="Navigation principale">
		{#each links as link (link.id)}
			<a class="hy-tab" href={link.href} aria-current={section === link.id ? 'page' : undefined}>
				<Icon name={link.icon} />{link.label}
			</a>
		{/each}
	</nav>
{/if}

<UpdatePrompt />
<UndoToast />
<StorageNotice />

<style>
	.app-main {
		display: block;
		outline: none;
		padding-bottom: calc(var(--tabbar-height) + env(safe-area-inset-bottom) + var(--space-6));
	}

	.app-main--reading {
		/* Room for the reading bar. */
		padding-bottom: calc(80px + env(safe-area-inset-bottom) + var(--space-6));
	}

	.hy-tab :global(svg) {
		width: 24px;
		height: 24px;
	}

	@media (min-width: 1024px) {
		.app-main,
		.app-main--reading {
			padding-bottom: var(--space-16);
		}
	}
</style>
