<!--
  Réglages › Hors ligne (feature 016, FR-016 to FR-020, contracts/settings-ui.md): what this
  device keeps for use without a network, the space it takes, the date of the hymns, what needs a
  connection, and a check for a new version that ends in the usual update prompt.
-->
<script lang="ts">
	import { base } from '$app/paths';
	import SettingsHeader from '$lib/components/SettingsHeader.svelte';
	import {
		formatBytes,
		OFFLINE_STATE_LABELS,
		probeOffline,
		type OfflineStatus
	} from '$lib/offline/status';
	import { checkForUpdate, type UpdateResult } from '$lib/offline/sw';
	import { getSearchClient } from '$lib/search/session';

	let { data } = $props();

	const meaningStatus = getSearchClient().meaningStatus;
	let status = $state<OfflineStatus>();

	// Probe again when the meaning download changes state, and every few seconds while something
	// is still on its way (the service worker stores a file just after handing it over).
	let tick = $state(0);
	$effect(() => {
		const manifest = data.catalog.manifest;
		const meaningState = $meaningStatus.state;
		void tick;
		if (!manifest) return;
		let stale = false;
		probeOffline(manifest, meaningState, base).then((s) => {
			if (!stale) status = s;
		});
		return () => (stale = true);
	});
	$effect(() => {
		if (!status?.cacheAvailable || status.items.every((i) => i.state === 'ready')) return;
		const id = setTimeout(() => tick++, 2000);
		return () => clearTimeout(id);
	});

	const updatedAt = $derived.by(() => {
		const date = data.catalog.manifest?.updatedAt;
		if (!date) return undefined;
		return new Intl.DateTimeFormat('fr-FR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		}).format(new Date(`${date}T00:00:00Z`));
	});
	const usage = $derived(status?.cacheAvailable ? formatBytes(status.usage) : undefined);

	let checking = $state(false);
	let result = $state<{ value: UpdateResult; at: Date }>();

	async function check() {
		if (checking) return;
		checking = true;
		try {
			result = { value: await checkForUpdate(), at: new Date() };
		} finally {
			checking = false;
		}
	}

	const time = (d: Date) => `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;

	const MESSAGES: Record<UpdateResult, (at: Date) => string> = {
		update: () => 'Une mise à jour est disponible.',
		'up-to-date': (at) => `Hymnia est à jour (vérifié à ${time(at)}).`,
		offline: () => 'Pas de connexion : la vérification est impossible pour le moment.',
		failed: () => 'La vérification a échoué. Réessayez plus tard.',
		unavailable: () => 'La vérification n’est pas possible dans ce navigateur.'
	};
</script>

<svelte:head><title>Hors ligne · Réglages · Hymnia</title></svelte:head>

<div class="page hy-settings">
	<div>
		<SettingsHeader title="Hors ligne" />
	</div>

	<section aria-labelledby="kept-title">
		<h2 id="kept-title" class="hy-overline">Sur cet appareil</h2>
		{#if status && !status.cacheAvailable}
			<p class="hy-caption">
				Ce navigateur ne garde pas Hymnia pour une utilisation hors ligne. Installez l’application
				ou rouvrez-la avec une connexion pour l’emporter.
			</p>
		{/if}
		<ul class="offline__items" aria-busy={!status}>
			{#each status?.items ?? [] as item (item.id)}
				<li class="offline__item">
					<span>{item.label}</span>
					<span class="offline__state offline__state--{item.state}"
						>{OFFLINE_STATE_LABELS[item.state]}</span
					>
				</li>
			{/each}
		</ul>
		{#if usage}<p class="hy-caption">Espace utilisé : {usage}</p>{/if}
		{#if updatedAt}<p class="hy-caption">Chants mis à jour le {updatedAt}</p>{/if}
	</section>

	<section aria-labelledby="online-title">
		<h2 id="online-title" class="hy-overline">Avec une connexion seulement</h2>
		<ul class="offline__needs">
			<li>une nouvelle recherche par le sens (celles déjà faites restent disponibles)&#8239;;</li>
			<li>les liens vers YouTube&#8239;;</li>
			<li>la recherche de mises à jour.</li>
		</ul>
	</section>

	<section aria-labelledby="update-title">
		<h2 id="update-title" class="hy-overline">Mises à jour</h2>
		<button type="button" class="hb-btn" aria-disabled={checking} onclick={check}>
			{checking ? 'Vérification…' : 'Rechercher une mise à jour'}
		</button>
		<p class="hy-caption" role="status">
			{result && !checking ? MESSAGES[result.value](result.at) : ''}
		</p>
	</section>
</div>

<style>
	.offline__items,
	.offline__needs {
		margin: 0;
		padding: 0;
	}

	.offline__items {
		list-style: none;
		border-top: 1px solid var(--line);
	}

	.offline__item {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-1) var(--space-3);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--line);
	}

	.offline__state {
		font-size: 14px;
		line-height: 20px;
		color: var(--ink-muted);
	}

	.offline__state--ready {
		color: var(--ink);
		font-weight: 500;
	}

	.offline__needs {
		padding-left: 1.2em;
		font-size: 15px;
		line-height: 22px;
	}

	.hb-btn {
		align-self: flex-start;
	}

	.hb-btn[aria-disabled='true'] {
		cursor: progress;
		opacity: 0.7;
	}
</style>
