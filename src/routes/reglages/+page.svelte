<!--
  Settings `/reglages` (T056, FR-015, FR-017). Feature 016 (FR-001 to FR-007, research R1–R3): a
  menu of sections, each with a one-line summary of its current state and no control. A section
  opens on its own address; coming back puts focus on its entry.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import { base } from '$app/paths';
	import { offlineOverview, probeOffline, type OfflineOverview } from '$lib/offline/status';
	import { prefs } from '$lib/prefs/prefs';
	import { createScope } from '$lib/scope/scope';
	import { getSearchClient } from '$lib/search/session';
	import { isSectionSlug, SETTINGS_SECTIONS, summaryOf } from '$lib/settings/sections';

	let { data } = $props();

	const hymnals = $derived(data.catalog.getHymnalsByName());
	const scope = $derived(createScope($prefs.excluded, hymnals));
	// Hors ligne summary (feature 016, US3): « Vérification… » until the device is probed.
	const meaningStatus = getSearchClient().meaningStatus;
	let offline = $state<OfflineOverview>({ kind: 'checking' });
	$effect(() => {
		const manifest = data.catalog.manifest;
		const meaningState = $meaningStatus.state;
		if (!manifest) return;
		let stale = false;
		probeOffline(manifest, meaningState, base).then((s) => {
			if (!stale) offline = offlineOverview(s);
		});
		return () => (stale = true);
	});

	const ctx = $derived({
		prefs: $prefs,
		hymnalsInUse: hymnals.filter((h) => scope.hymnalState(h.id) !== 'none').length,
		hymnalsListed: hymnals.length,
		offline
	});

	let menu = $state<HTMLUListElement>();

	afterNavigate(async ({ from }) => {
		const slug = from?.route.id?.match(/^\/reglages\/([^/[]+)$/)?.[1];
		if (!slug || !isSectionSlug(slug)) return;
		await tick();
		menu?.querySelector<HTMLAnchorElement>(`a[data-section="${slug}"]`)?.focus();
	});
</script>

<svelte:head><title>Réglages · Hymnia</title></svelte:head>

<div class="page hy-settings">
	<div>
		<header class="page__header page__header--back mobile-only">
			<a class="hb-icon-btn" href={resolve('/')} aria-label="Retour à la recherche">
				<Icon name="back" />
			</a>
			<span class="page__back-label">Recherche</span>
		</header>

		<h1 class="hy-screen-title">Réglages</h1>
	</div>

	<ul class="settings-menu" bind:this={menu}>
		{#each SETTINGS_SECTIONS as section (section.slug)}
			<li>
				<a
					class="settings-menu__link"
					href={resolve(`/reglages/${section.slug}`)}
					data-section={section.slug}
				>
					<span class="settings-menu__text">
						<span class="settings-menu__title">{section.title}</span>
						<span class="settings-menu__summary">{summaryOf(section.slug, ctx)}</span>
					</span>
					<Icon name="forward" />
				</a>
			</li>
		{/each}
	</ul>
</div>

<style>
	.settings-menu {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--line);
	}

	.settings-menu li {
		border-bottom: 1px solid var(--line);
	}

	.settings-menu__link {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 64px;
		padding: var(--space-3) 0;
		color: var(--ink);
		text-decoration: none;
	}

	.settings-menu__link :global(svg) {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		color: var(--ink-muted);
	}

	.settings-menu__text {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		gap: 2px;
		min-width: 0;
	}

	.settings-menu__title {
		font-family: var(--font-serif);
		font-size: 18px;
		line-height: 24px;
		font-weight: 500;
	}

	.settings-menu__summary {
		font-size: 14px;
		line-height: 20px;
		color: var(--ink-muted);
	}

	@media (hover: hover) {
		.settings-menu__link:hover .settings-menu__title {
			color: var(--rubric);
		}
	}
</style>
