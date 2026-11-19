<!--
  Search field (T033, decisions §4.1): 52 px tall, 18 px text, results while typing (no search
  button, FR-009), clear button once there is text. Enter opens the first result.
  Feature 012: the field has two modes (specs/012-meaning-search-mode/contracts/search-mode.md).
  A small switch beside it, shown from the first paint when the data has meaning vectors, turns
  the search by meaning on or off: the field doubles in height, wraps the text and takes the gold
  `--meaning` frame. Turning it on runs nothing: a launch button appears under the switch, and the
  search runs (or runs again) only when it is pressed, or with Enter. The field is one textarea in both modes, so
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
		/** Enter or the launch button; the page decides what it does (decideSubmit). */
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
		<div class="mode-col">
			<button
				type="button"
				role="switch"
				class="hb-btn mode-btn"
				aria-label="Recherche par le sens"
				title="Recherche par le sens"
				aria-checked={meaning}
				onmousedown={(event) => event.preventDefault()}
				onclick={toggle}
			>
				<Icon name="meaning" />
				<span class="mode-switch" aria-hidden="true"></span>
			</button>
			{#if meaning}
				<!-- Takes the focus, so that on a phone the keyboard closes on the results. -->
				<button
					type="submit"
					class="hb-btn launch-btn"
					aria-label="Lancer la recherche par le sens"
					title="Lancer la recherche"
					disabled={!value.trim()}
				>
					<Icon name="search" />
				</button>
			{/if}
		</div>
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

	/* The switch and, in the meaning mode, the launch button under it: together as tall as the
	   doubled field (52 + 8 + 44 = 104; 56 + 8 + 48 = 112 on desktop). */
	.mode-col {
		display: flex;
		flex: none;
		flex-direction: column;
		gap: var(--space-2);
	}

	.mode-btn {
		flex-direction: column;
		gap: 4px;
		width: 52px;
		min-height: 52px;
		padding: 0;
		background: var(--paper-raised);
		color: var(--ink-muted);
	}

	.mode-btn[aria-checked='true'] {
		background: var(--meaning-soft);
		border-color: var(--meaning);
		color: var(--meaning);
	}

	/* A small on/off track under the icon, so the button reads as a switch. */
	.mode-switch {
		position: relative;
		width: 26px;
		height: 14px;
		border-radius: 7px;
		background: var(--ink-muted);
		transition: background-color 160ms ease-out;
	}

	.mode-switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--paper-raised);
		transition: transform 160ms ease-out;
	}

	.mode-btn[aria-checked='true'] .mode-switch {
		background: var(--meaning);
	}

	.mode-btn[aria-checked='true'] .mode-switch::after {
		transform: translateX(12px);
	}

	.launch-btn {
		width: 52px;
		min-height: 44px;
		padding: 0;
		background: var(--meaning);
		border-color: var(--meaning);
		color: var(--on-rubric);
	}

	.launch-btn:disabled {
		opacity: 0.45;
		cursor: default;
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

		.launch-btn {
			width: 56px;
			min-height: 48px;
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
		.search-box textarea,
		.mode-switch,
		.mode-switch::after {
			transition: none;
		}
	}
</style>
