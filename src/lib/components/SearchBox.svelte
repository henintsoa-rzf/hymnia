<!--
  Search field (T033, decisions §4.1): 52 px tall, 18 px text, results while typing (no search
  button, FR-009), clear button once there is text. Enter opens the first result.
  Feature 011: a « Par le sens » button beside the field, for a text query, when the data has
  meaning vectors (specs/011-semantic-search/contracts/meaning-search.md).
-->
<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		value = $bindable(''),
		onsubmit,
		input = $bindable(),
		meaningAvailable = false,
		meaningActive = false,
		onmeaning
	}: {
		value?: string;
		onsubmit?: () => void;
		input?: HTMLInputElement;
		/** The query can be searched by meaning (a text query, data with meaning vectors). */
		meaningAvailable?: boolean;
		/** The results shown are a search by meaning. */
		meaningActive?: boolean;
		onmeaning?: () => void;
	} = $props();

	function clear() {
		value = '';
		input?.focus();
	}
</script>

<form
	role="search"
	class="search-form"
	onsubmit={(event) => {
		event.preventDefault();
		onsubmit?.();
	}}
>
	<label class="hb-search search-box">
		<Icon name="search" />
		<!-- The search field is the purpose of the first screen (FR-001). -->
		<!-- svelte-ignore a11y_autofocus -->
		<input
			bind:this={input}
			bind:value
			type="search"
			aria-label="Rechercher par numéro, titre ou paroles"
			placeholder="Numéro, titre ou paroles"
			autocomplete="off"
			autocorrect="off"
			autocapitalize="off"
			spellcheck="false"
			enterkeyhint="search"
			autofocus
		/>
		{#if value}
			<button
				type="button"
				class="hb-icon-btn search-box__clear"
				aria-label="Effacer la recherche"
				onclick={clear}
			>
				<Icon name="close" />
			</button>
		{/if}
	</label>
	{#if meaningAvailable}
		<button
			type="button"
			class="hb-btn meaning-btn"
			aria-pressed={meaningActive}
			onclick={() => onmeaning?.()}
		>
			<Icon name="meaning" />Par le sens
		</button>
	{/if}
</form>

<style>
	.search-form {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		margin: 0;
	}

	.search-box {
		flex: 1;
		min-width: 0;
		min-height: 52px;
	}

	.meaning-btn {
		flex: none;
		min-height: 52px;
		padding: 0 var(--space-3);
		white-space: nowrap;
	}

	.meaning-btn[aria-pressed='true'] {
		background: var(--rubric-soft);
		border-color: var(--rubric);
		color: var(--rubric);
	}

	.search-box input {
		height: 50px;
		font-size: 18px;
	}

	.search-box__clear {
		margin-right: -12px;
		color: var(--ink-muted);
	}

	@media (min-width: 1024px) {
		.search-box {
			min-height: 56px;
		}

		.search-box input {
			height: 54px;
		}

		.meaning-btn {
			min-height: 56px;
		}
	}
</style>
