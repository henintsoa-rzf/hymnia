<!--
  Status line of a search by meaning (specs/011-semantic-search/contracts/meaning-search.md,
  "UI states"; contracts/embed-api.md for the error messages). One polite live region; word
  results stay visible below it in every state.
-->
<script module lang="ts">
	import type { EmbedFailure } from '$lib/meaning/embed-client';

	export type MeaningPhase =
		| { kind: 'idle' }
		| { kind: 'waiting' }
		| { kind: 'preparing'; percent: number }
		| { kind: 'error'; reason: Exclude<EmbedFailure, 'cancelled'> };

	export const MEANING_MESSAGES: Record<Exclude<EmbedFailure, 'cancelled'>, string> = {
		offline: 'La recherche par le sens nécessite une connexion.',
		timeout: 'La recherche par le sens n’a pas répondu à temps. Réessayez.',
		rate: 'Trop de recherches d’affilée, réessayez dans un instant.',
		unavailable: 'La recherche par le sens est indisponible pour le moment.',
		config: 'Mettez l’application à jour pour utiliser la recherche par le sens.',
		failed: 'La recherche par le sens a échoué.'
	};
</script>

<script lang="ts">
	let {
		phase,
		truncated = false,
		oncancel
	}: { phase: MeaningPhase; truncated?: boolean; oncancel?: () => void } = $props();

	const busy = $derived(phase.kind === 'waiting' || phase.kind === 'preparing');
</script>

<div class="meaning-status" aria-live="polite">
	{#if phase.kind !== 'idle'}
		<p class="meaning-status__line" class:meaning-status__line--error={phase.kind === 'error'}>
			{#if phase.kind === 'waiting'}
				Recherche par le sens…
			{:else if phase.kind === 'preparing'}
				Préparation de la recherche par le sens… {phase.percent}&nbsp;%
			{:else if phase.kind === 'error'}
				{MEANING_MESSAGES[phase.reason]}
			{/if}
		</p>
		{#if busy}
			<button type="button" class="hb-btn hb-btn--quiet" onclick={() => oncancel?.()}
				>Annuler</button
			>
		{:else if phase.kind === 'error' && phase.reason === 'config'}
			<button type="button" class="hb-btn hb-btn--quiet" onclick={() => location.reload()}
				>Recharger</button
			>
		{/if}
	{/if}
	{#if truncated && phase.kind !== 'error'}
		<p class="meaning-status__note hy-caption">Recherche limitée aux 500 premiers caractères</p>
	{/if}
</div>

<style>
	.meaning-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0 var(--space-3);
	}

	.meaning-status:empty {
		display: none;
	}

	.meaning-status__line {
		flex: 1 1 auto;
		margin: var(--space-2) 0;
		font-size: 15px;
		line-height: 22px;
		color: var(--ink-muted);
	}

	.meaning-status__line--error {
		color: var(--ink);
	}

	.meaning-status__note {
		flex-basis: 100%;
		margin: 0 0 var(--space-2);
	}
</style>
