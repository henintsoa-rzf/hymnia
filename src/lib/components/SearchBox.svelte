<!--
  Search field (T033, decisions §4.1): 52 px tall, 18 px text, results while typing (no search
  button, FR-009), clear button once there is text. Enter opens the first result.
-->
<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		value = $bindable(''),
		onsubmit,
		input = $bindable()
	}: {
		value?: string;
		onsubmit?: () => void;
		input?: HTMLInputElement;
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
</form>

<style>
	.search-form {
		margin: 0;
	}

	.search-box {
		min-height: 52px;
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
	}
</style>
