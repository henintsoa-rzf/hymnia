<!--
  Hymnal `/recueils/<id>` (T049, FR-012, decisions §6): hymns in number order and a
  "go to number" field that scrolls to that hymn and highlights it.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import NotFound from '$lib/components/NotFound.svelte';
	import { normalizeNumber } from '$lib/domain/numbering';
	import { frenchSpaces, hymnCountLabel, hymnUrl } from '$lib/format';
	import { tick } from 'svelte';

	let { data } = $props();

	let goValue = $state('');
	let target = $state<string>();
	let goMessage = $state('');

	const domId = (number: string) => `n-${normalizeNumber(number)}`;

	async function go(event: SubmitEvent) {
		event.preventDefault();
		const hymnal = data.hymnal;
		const typed = goValue.trim().replace(/^(n°|no|#)\s*/i, '');
		if (!hymnal || !typed) return;
		const found = data.catalog.getEntry(hymnal.id, typed);
		if (!found) {
			target = undefined;
			goMessage = `Pas de n°\u00a0${typed} dans ce recueil.`;
			return;
		}
		goMessage = '';
		target = normalizeNumber(found.entry.number);
		await tick();
		const item = document.getElementById(domId(found.entry.number));
		item?.scrollIntoView({ block: 'center' });
		item?.querySelector('a')?.focus({ preventScroll: true });
	}
</script>

<svelte:head>
	{#if data.hymnal}<title>{data.hymnal.name} · Hymnia</title>{/if}
</svelte:head>

{#if data.hymnal}
	{@const hymnal = data.hymnal}

	<div class="page hymnal">
		<header class="page__header page__header--back">
			<a class="hb-icon-btn" href={resolve('/recueils')} aria-label="Retour aux recueils">
				<Icon name="back" />
			</a>
			<span class="page__back-label">Recueils</span>
		</header>

		<div class="hymnal__head">
			<div>
				<h1 class="hy-screen-title">{hymnal.name}</h1>
				<p class="hy-caption hymnal__count">
					{hymnal.abbreviations[0]} · {hymnCountLabel(hymnal.hymnCount)}
				</p>
			</div>
			<form class="hymnal__go" onsubmit={go}>
				<label class="hymnal__go-label">
					<span>Aller au numéro</span>
					<span class="hb-search">
						<input
							type="text"
							bind:value={goValue}
							autocomplete="off"
							enterkeyhint="go"
							placeholder="Par exemple 12a"
						/>
					</span>
				</label>
				<button type="submit" class="hb-btn">Aller</button>
			</form>
			{#if goMessage}<p class="hymnal__go-message" role="status">{goMessage}</p>{/if}
		</div>

		<ol class="hb-list hymnal__list" aria-label="Chants du recueil, par numéro">
			{#each data.entries as { hymn, entry } (entry.number)}
				<li
					class="hb-item"
					class:is-target={target === normalizeNumber(entry.number)}
					id={domId(entry.number)}
				>
					<a class="hb-item__link" href={hymnUrl(hymnal.id, entry.number)}>
						<span class="hb-item__num">{entry.number}</span>
						<span class="hb-item__title">{frenchSpaces(hymn.title)}</span>
					</a>
				</li>
			{/each}
		</ol>
	</div>
{:else}
	<div class="page">
		<NotFound
			title="Recueil introuvable"
			text={`Aucun recueil « ${data.requested} » dans Hymnia. Les recueils disponibles sont listés dans l’onglet Recueils.`}
		/>
	</div>
{/if}

<style>
	.hymnal {
		max-width: 720px;
	}

	.hymnal__head {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 4px 0 8px;
	}

	.hymnal__count {
		margin-top: 4px;
	}

	.hymnal__go {
		display: flex;
		align-items: flex-end;
		gap: 8px;
	}

	.hymnal__go-label {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 14px;
		line-height: 20px;
		font-weight: 500;
	}

	.hymnal__go-message {
		margin: 0;
		font-size: 14px;
		line-height: 20px;
		color: var(--ink-muted);
	}

	.hymnal__list {
		border-top: 1px solid var(--line);
	}

	.hymnal__list > li {
		content-visibility: auto;
		contain-intrinsic-size: auto 49px;
	}

	@media (min-width: 1024px) {
		.hymnal {
			padding-top: 16px;
		}

		.hymnal__go {
			max-width: 360px;
		}
	}
</style>
