<!-- Réglages › Affichage (feature 016, FR-006): the theme, unchanged since T056 / FR-017. -->
<script lang="ts">
	import SettingsHeader from '$lib/components/SettingsHeader.svelte';
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

	const current = $derived(THEMES.find((t) => t.id === $prefs.theme) ?? THEMES[0]);
</script>

<svelte:head><title>Affichage · Réglages · Hymnia</title></svelte:head>

<div class="page hy-settings">
	<div>
		<SettingsHeader title="Affichage" />
	</div>

	<section aria-labelledby="theme-title">
		<h2 id="theme-title" class="hy-overline">Thème</h2>
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
</div>
