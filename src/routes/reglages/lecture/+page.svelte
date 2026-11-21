<!--
  Réglages › Lecture (feature 016, FR-008 to FR-015, contracts/settings-ui.md): how lyrics are
  laid out. Text size moved here from Affichage; font, line spacing, stanza numbers, chorus
  repetition and « Garder l'écran allumé » are new. The preview follows every setting at once.
-->
<script lang="ts">
	import SettingsHeader from '$lib/components/SettingsHeader.svelte';
	import Stanza from '$lib/components/Stanza.svelte';
	import TextSizeControl from '$lib/components/TextSizeControl.svelte';
	import type { Section } from '$lib/domain/schema';
	import { layoutSections } from '$lib/lyrics/layout';
	import { prefs, type Prefs } from '$lib/prefs/prefs';
	import { wakeLockSupported } from '$lib/reading/wake-lock';
	import { LYRIC_FONT_LABELS } from '$lib/settings/sections';

	type Choice<K extends keyof Prefs> = {
		key: K;
		title: string;
		id: string;
		options: [Prefs[K], string][];
	};

	const FONT: Choice<'lyricFont'> = {
		key: 'lyricFont',
		title: 'Police des paroles',
		id: 'font-title',
		options: [
			['serif', LYRIC_FONT_LABELS.serif],
			['sans', LYRIC_FONT_LABELS.sans]
		]
	};
	const SPACING: Choice<'lineSpacing'> = {
		key: 'lineSpacing',
		title: 'Interligne',
		id: 'spacing-title',
		options: [
			['tight', 'Serré'],
			['normal', 'Normal'],
			['loose', 'Aéré']
		]
	};
	const CHORUS: Choice<'chorus'> = {
		key: 'chorus',
		title: 'Refrain',
		id: 'chorus-title',
		options: [
			['once', 'Une seule fois'],
			['each', 'Après chaque strophe']
		]
	};

	const set = <K extends keyof Prefs>(key: K, value: Prefs[K]) =>
		prefs.update((p) => ({ ...p, [key]: value }));

	const canKeepAwake = wakeLockSupported();

	// A short excerpt with a numbered stanza, a chorus and a second stanza (FR-014).
	const EXCERPT: Section[] = [
		{
			type: 'verse',
			number: 1,
			lines: ['À toi la gloire,', 'Ô Ressuscité !', 'À toi la victoire', 'Pour l’éternité !']
		},
		{ type: 'chorus', number: null, lines: ['À toi la gloire,', 'Ô Ressuscité !'] },
		{
			type: 'verse',
			number: 2,
			lines: ['Vois-le paraître :', 'C’est lui, c’est Jésus,', 'Ton Sauveur, ton Maître !']
		}
	];
	const preview = $derived(layoutSections(EXCERPT, { chorus: $prefs.chorus }));
</script>

<svelte:head><title>Lecture · Réglages · Hymnia</title></svelte:head>

{#snippet choice<K extends keyof Prefs>(c: Choice<K>)}
	<section aria-labelledby={c.id}>
		<h2 id={c.id} class="hy-overline">{c.title}</h2>
		<div class="hy-seg" role="group" aria-labelledby={c.id}>
			{#each c.options as [value, label] (value)}
				<button
					type="button"
					aria-pressed={$prefs[c.key] === value}
					onclick={() => set(c.key, value)}>{label}</button
				>
			{/each}
		</div>
	</section>
{/snippet}

<div class="page hy-settings">
	<div>
		<SettingsHeader title="Lecture" />
	</div>

	<section aria-labelledby="size-title">
		<h2 id="size-title" class="hy-overline">Taille du texte</h2>
		<div class="settings__size">
			<span>Paroles</span>
			<TextSizeControl labelledby="size-title" />
		</div>
		<p class="hy-caption">
			S’applique à tous les chants. Vous pouvez aussi la changer pendant la lecture.
		</p>
	</section>

	{@render choice(FONT)}
	{@render choice(SPACING)}

	<section aria-labelledby="numbers-title">
		<h2 id="numbers-title" class="hy-overline">Numéros des strophes</h2>
		<label class="hy-switch">
			<span>Afficher les numéros</span>
			<input
				type="checkbox"
				role="switch"
				checked={$prefs.stanzaNumbers}
				onchange={(e) => set('stanzaNumbers', e.currentTarget.checked)}
			/>
		</label>
	</section>

	{@render choice(CHORUS)}

	<section aria-labelledby="awake-title">
		<h2 id="awake-title" class="hy-overline">Garder l’écran allumé</h2>
		<label class="hy-switch">
			<span>Empêcher la mise en veille</span>
			<input
				type="checkbox"
				role="switch"
				aria-describedby="awake-help"
				disabled={!canKeepAwake}
				checked={canKeepAwake && $prefs.keepAwake}
				onchange={(e) => set('keepAwake', e.currentTarget.checked)}
			/>
		</label>
		<p class="hy-caption" id="awake-help">
			{canKeepAwake
				? 'Seulement pendant la lecture d’un chant.'
				: 'Non disponible sur cet appareil'}
		</p>
	</section>

	<div class="settings__preview" role="group" aria-label="Aperçu">
		<p class="hy-overline settings__preview-title" aria-hidden="true">Aperçu</p>
		<div class="hb-hymn">
			{#each preview as block (block.key)}
				<Stanza {block} numbers={$prefs.stanzaNumbers} />
			{/each}
		</div>
	</div>
</div>

<style>
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

	.settings__preview :global(.hb-stanza:last-child) {
		margin-bottom: 0;
	}
</style>
