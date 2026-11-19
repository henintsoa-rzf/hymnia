<!--
  Settings `/reglages` (T056, FR-015, FR-017, decisions §8). Feature 014: two subsections,
  « Affichage » (theme and text size) and « Recueils » (hymnals and parts in use).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import HymnalScope from '$lib/components/HymnalScope.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import TextSizeControl from '$lib/components/TextSizeControl.svelte';
	import { prefs, type Theme } from '$lib/prefs/prefs';

	const THEMES: { id: Theme; label: string; help: string }[] = [
		{ id: 'system', label: 'Système', help: 'Suit le réglage clair ou sombre de votre appareil.' },
		{
			id: 'light',
			label: 'Clair',
			help: 'Toujours clair, quel que soit le réglage de l’appareil.'
		},
		{ id: 'dark', label: 'Sombre', help: 'Toujours sombre, plus reposant le soir.' }
	];

	let { data } = $props();

	const current = $derived(THEMES.find((t) => t.id === $prefs.theme) ?? THEMES[0]);
</script>

<svelte:head><title>Réglages · Hymnia</title></svelte:head>

<div class="page settings">
	<header class="page__header page__header--back mobile-only">
		<a class="hb-icon-btn" href={resolve('/')} aria-label="Retour à la recherche">
			<Icon name="back" />
		</a>
		<span class="page__back-label">Recherche</span>
	</header>

	<h1 class="hy-screen-title">Réglages</h1>

	<section class="settings__group" aria-labelledby="display-title">
		<h2 id="display-title" class="settings__group-title">Affichage</h2>

		<section aria-labelledby="theme-title">
			<h3 id="theme-title" class="hy-overline">Thème</h3>
			<div class="hy-seg" role="group" aria-labelledby="theme-title">
				{#each THEMES as theme (theme.id)}
					<button
						type="button"
						aria-pressed={$prefs.theme === theme.id}
						onclick={() => prefs.update((p) => ({ ...p, theme: theme.id }))}>{theme.label}</button
					>
				{/each}
			</div>
			<p class="hy-caption">{current.help}</p>
		</section>

		<section aria-labelledby="size-title">
			<h3 id="size-title" class="hy-overline">Taille du texte</h3>
			<div class="settings__size">
				<span>Paroles</span>
				<TextSizeControl labelledby="size-title" />
			</div>
			<div class="settings__preview" role="group" aria-label="Aperçu">
				<p class="hy-overline settings__preview-title" aria-hidden="true">Aperçu</p>
				<div class="hb-hymn">
					<p class="hb-stanza settings__stanza">
						<span class="hb-stanza__num">1</span>
						<span class="hb-stanza__line">À toi la gloire,</span>
						<span class="hb-stanza__line">Ô Ressuscité&#8239;!</span>
						<span class="hb-stanza__line">À toi la victoire</span>
						<span class="hb-stanza__line">Pour l’éternité&#8239;!</span>
					</p>
				</div>
			</div>
			<p class="hy-caption">
				S’applique à tous les chants. Vous pouvez aussi la changer pendant la lecture.
			</p>
		</section>
	</section>

	<section class="settings__group" aria-labelledby="scope-title">
		<h2 id="scope-title" class="settings__group-title">Recueils</h2>
		<HymnalScope hymnals={data.catalog.getHymnalsByName()} labelledby="scope-title" />
	</section>
</div>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 32px;
		max-width: 640px;
	}

	.settings > h1 {
		margin-top: 4px;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.settings__group {
		gap: 24px;
	}

	.settings__group-title {
		margin: 0;
		padding-bottom: 8px;
		border-bottom: 2px solid var(--rubric);
		font-family: var(--font-serif);
		font-size: 20px;
		line-height: 26px;
		font-weight: 500;
		color: var(--rubric);
	}

	.settings__size {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.settings__preview {
		padding: 16px;
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		background: var(--paper-raised);
		overflow: hidden;
	}

	.settings__preview-title {
		margin-bottom: 12px;
	}

	.settings__stanza {
		margin-bottom: 0;
	}

	@media (min-width: 1024px) {
		.settings {
			padding-top: 32px;
		}
	}
</style>
