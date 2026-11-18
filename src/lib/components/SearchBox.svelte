<!--
  Search field (T033, decisions §4.1): 52 px tall, 18 px text, results while typing (no search
  button, FR-009), clear button once there is text. Enter opens the first result.
  Feature 012: the field has two modes (specs/012-meaning-search-mode/contracts/search-mode.md).
  A small button beside it, shown from the first paint when the data has meaning vectors, switches
  to the search by meaning: the field doubles in height, wraps the text and takes the gold
  `--meaning` frame; Enter then runs the search. The field is one textarea in both modes, so
  switching never replaces the focused element (research R3). Nothing here depends on the text
  typed, so the form never changes size while typing (research R1).
-->
<script lang="ts">
	import Icon from './Icon.svelte';
	import { singleLine, type SearchMode } from '$lib/meaning/mode';

	let {
		value = $bindable(''),
		input = $bindable(),
		mode = $bindable('word'),
		meaningAvailable = false,
		onsubmit,
		onmodechange
	}: {
		/** Always one line: typed or pasted line breaks become spaces. */
		value?: string;
		input?: HTMLTextAreaElement;
		mode?: SearchMode;
		/** The data has meaning vectors (from the manifest, not from the query). */
		meaningAvailable?: boolean;
		/** Enter; the page decides what it does (decideSubmit). */
		onsubmit?: () => void;
		onmodechange?: (mode: SearchMode) => void;
	} = $props();

	let form = $state<HTMLFormElement>();
	const meaning = $derived(mode === 'meaning');

	function clear() {
		value = '';
		input?.focus();
	}

	function oninput(event: Event & { currentTarget: HTMLTextAreaElement }) {
		const field = event.currentTarget;
		const text = singleLine(field.value);
		if (text !== field.value) {
			// A pasted line break: keep the caret where it was in the one-line text.
			const caret = singleLine(field.value.slice(0, field.selectionStart)).length;
			field.value = text;
			field.setSelectionRange(caret, caret);
		}
		value = text;
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.isComposing) return;
		// Enter never adds a line break: it submits, in both modes.
		event.preventDefault();
		form?.requestSubmit();
	}

	function toggle(event: MouseEvent) {
		const fromPointer = document.activeElement !== event.currentTarget;
		mode = meaning ? 'word' : 'meaning';
		onmodechange?.(mode);
		// A tap or click keeps the typing in the field; a keyboard user stays on the button.
		if (fromPointer) input?.focus();
	}
</script>

<form
	bind:this={form}
	role="search"
	class="search-form"
	class:search-form--meaning={meaning}
	onsubmit={(event) => {
		event.preventDefault();
		onsubmit?.();
	}}
>
	<label class="hb-search search-box">
		<Icon name={meaning ? 'meaning' : 'search'} />
		<!-- The search field is the purpose of the first screen (FR-001). -->
		<!-- svelte-ignore a11y_autofocus -->
		<textarea
			bind:this={input}
			{value}
			{oninput}
			{onkeydown}
			rows="1"
			wrap={meaning ? 'soft' : 'off'}
			aria-label={meaning
				? 'Rechercher par le sens : décrivez ce que vous cherchez'
				: 'Rechercher par numéro, titre ou paroles'}
			placeholder={meaning
				? 'Décrivez un thème, une idée, un passage…'
				: 'Numéro, titre ou paroles'}
			autocomplete="off"
			{...{ autocorrect: 'off' }}
			autocapitalize="off"
			spellcheck="false"
			enterkeyhint="search"
			autofocus></textarea>
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
			class="hb-btn mode-btn"
			aria-label="Rechercher par le sens"
			title="Rechercher par le sens"
			aria-pressed={meaning}
			onmousedown={(event) => event.preventDefault()}
			onclick={toggle}
		>
			<Icon name="meaning" />
		</button>
	{/if}
</form>

<style>
	.search-form {
		display: flex;
		gap: var(--space-2);
		/* The button stays at the top when the field grows. */
		align-items: flex-start;
		margin: 0;
	}

	.search-box {
		flex: 1;
		min-width: 0;
		min-height: 52px;
		transition: min-height 160ms ease-out;
	}

	/* The space above and below the text is a margin, not a padding, so that text scrolled in
	   the meaning mode is cut at a line boundary, never through a line. */
	.search-box textarea {
		display: block;
		box-sizing: content-box;
		height: 24px;
		margin: 13px 0;
		padding: 0;
		font-size: 18px;
		line-height: 24px;
		resize: none;
		overflow: hidden;
		white-space: pre;
		transition:
			height 160ms ease-out,
			margin 160ms ease-out;
	}

	.search-box__clear {
		margin-right: -12px;
		color: var(--ink-muted);
	}

	.mode-btn {
		flex: none;
		width: 52px;
		min-height: 52px;
		padding: 0;
		background: var(--paper-raised);
		color: var(--ink-muted);
	}

	.mode-btn[aria-pressed='true'] {
		background: var(--meaning-soft);
		border-color: var(--meaning);
		color: var(--meaning);
	}

	/* ---------- Search-by-meaning mode ---------- */

	.search-form--meaning .search-box {
		align-items: flex-start;
		min-height: 104px;
		border-color: var(--meaning);
	}

	.search-form--meaning .search-box:focus-within {
		border-color: var(--meaning);
		box-shadow: 0 0 0 1px var(--meaning);
	}

	.search-form--meaning .search-box :global(svg) {
		color: var(--meaning);
	}

	/* The leading icon lines up with the first line of text (margin 15 + half a line). */
	.search-form--meaning .search-box > :global(svg) {
		margin-top: 17px;
	}

	/* Three lines, then the text scrolls inside. */
	.search-form--meaning .search-box textarea {
		height: 72px;
		margin: 15px 0;
		white-space: pre-wrap;
		overflow-y: auto;
		/* A scrollbar appearing must not reflow the text. */
		scrollbar-gutter: stable;
	}

	.search-form--meaning .search-box__clear {
		margin-top: 5px;
		color: var(--ink-muted);
	}

	.search-form--meaning .search-box__clear :global(svg) {
		color: var(--ink-muted);
	}

	@media (min-width: 1024px) {
		.search-box {
			min-height: 56px;
		}

		.search-box textarea {
			margin: 15px 0;
		}

		.mode-btn {
			width: 56px;
			min-height: 56px;
		}

		.search-form--meaning .search-box {
			min-height: 112px;
		}

		.search-form--meaning .search-box textarea {
			margin: 19px 0;
		}

		.search-form--meaning .search-box > :global(svg) {
			margin-top: 21px;
		}

		.search-form--meaning .search-box__clear {
			margin-top: 9px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.search-box,
		.search-box textarea {
			transition: none;
		}
	}
</style>
