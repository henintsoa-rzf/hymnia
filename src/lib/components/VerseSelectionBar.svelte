<!--
  The chosen verses (feature 015, contracts/bible-ui.md §3): count and references, « Chercher des
  chants », and « Effacer ». Shown above the reading bar while at least one verse is chosen. The
  live region stays in the page so changes are announced even when the bar appears or goes.
  « Copier » and « Partager » (where the device offers sharing) give the verses as text with
  their references (User Story 3, §5).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { toUrlParam, type SelectionState } from '$lib/bible/selection';
	import Icon from './Icon.svelte';

	let {
		selection,
		limitHit = 0,
		onclear,
		copyText
	}: {
		selection: SelectionState;
		/** Changes each time a verse is refused for the length limit. */
		limitHit?: number;
		onclear: () => void;
		/** The text copied or shared (contracts/bible-ui.md §5). */
		copyText: string;
	} = $props();

	const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
	let note = $state('');
	let noteTimer: ReturnType<typeof setTimeout> | undefined;

	function say(text: string) {
		note = text;
		announcement = text;
		clearTimeout(noteTimer);
		noteTimer = setTimeout(() => (note = ''), 3000);
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(copyText);
			say('Versets copiés');
		} catch {
			say('Copie impossible sur cet appareil');
		}
	}

	async function share() {
		try {
			await navigator.share({ text: copyText });
		} catch (error) {
			if ((error as Error)?.name !== 'AbortError') say('Partage impossible sur cet appareil');
		}
	}

	const count = $derived(selection.ids.length);
	const countLabel = $derived(`${count} verset${count > 1 ? 's' : ''}`);
	const searchHref = $derived(
		`${resolve('/bible/chants')}?versets=${encodeURIComponent(toUrlParam(selection.ids))}`
	);

	let announcement = $state('');
	let limitShown = $state(false);
	let cleared = false;

	// Count changes are announced (« 3 versets choisis »), clearing as « Sélection effacée ».
	let previous = -1;
	$effect(() => {
		const n = count;
		if (previous >= 0 && n !== previous) {
			announcement = cleared
				? 'Sélection effacée'
				: n === 0
					? 'Aucun verset choisi'
					: `${n} verset${n > 1 ? 's' : ''} choisi${n > 1 ? 's' : ''}`;
			cleared = false;
		}
		previous = n;
	});

	$effect(() => {
		if (!limitHit) return;
		limitShown = true;
		announcement = 'Limite atteinte : 2 000 caractères au plus';
		const timer = setTimeout(() => (limitShown = false), 4000);
		return () => clearTimeout(timer);
	});

	function clear() {
		cleared = true;
		onclear();
	}
</script>

<p class="hb-sr" aria-live="polite">{announcement}</p>

{#if count > 0}
	<div class="selbar" role="region" aria-label="Versets choisis">
		<p class="selbar__label" title={selection.label}>
			<span class="selbar__count">{countLabel}</span> · {selection.label}
		</p>
		{#if limitShown}
			<p class="selbar__limit">Limite atteinte&#8239;: 2&#8239;000 caractères au plus</p>
		{:else if note}
			<p class="selbar__limit">{note}</p>
		{/if}
		<div class="selbar__actions">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus ?versets -->
			<a class="hb-btn hb-btn--primary selbar__search" href={searchHref}>
				<Icon name="meaning" />Chercher des chants
			</a>
			<button type="button" class="hb-btn" onclick={copy}>Copier</button>
			{#if canShare}
				<button type="button" class="hb-btn" onclick={share}>Partager</button>
			{/if}
			<button type="button" class="hb-btn hb-btn--quiet" onclick={clear}>Effacer</button>
		</div>
	</div>
{/if}

<style>
	.selbar {
		position: fixed;
		z-index: 11;
		left: 0;
		right: 0;
		/* Just above the reading bar (8 + 44 + 8 px, plus the safe area). */
		bottom: calc(61px + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3) var(--gutter);
		border-top: 1px solid var(--line);
		background: var(--paper-raised);
		box-shadow: var(--shadow-float);
	}

	.selbar__label {
		margin: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 15px;
		line-height: 22px;
		color: var(--ink);
	}

	.selbar__count {
		font-weight: 600;
		color: var(--rubric);
	}

	.selbar__limit {
		margin: 0;
		font-size: 14px;
		line-height: 20px;
		color: var(--ink-muted);
	}

	.selbar__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.selbar__search {
		flex: 1 1 auto;
	}

	@media (min-width: 1024px) {
		.selbar {
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
