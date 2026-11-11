<!--
  Create or rename a collection (contracts/ui.md, "Create / rename"). Native modal dialog:
  focus is kept inside, Escape closes it. Stays open while the name is refused.
-->
<script lang="ts">
	import type { NameError } from '$lib/repertoire/model';
	import { NAME_MAX_LENGTH } from '$lib/repertoire/model';

	let {
		open = $bindable(false),
		mode = 'create',
		initial = '',
		submit
	}: {
		open?: boolean;
		mode?: 'create' | 'rename';
		initial?: string;
		/** Returns null when accepted, or the reason it was refused. */
		submit: (name: string) => NameError | null;
	} = $props();

	const MESSAGES: Record<NameError, string> = {
		empty: 'Donnez un nom à la collection.',
		taken: 'Une collection porte déjà ce nom.',
		'too-long': `${NAME_MAX_LENGTH} caractères au plus.`
	};

	let dialog = $state<HTMLDialogElement>();
	let input = $state<HTMLInputElement>();
	let name = $state('');
	let error = $state<NameError | null>(null);
	const uid = $props.id();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			name = initial;
			error = null;
			dialog.showModal();
			input?.focus();
			input?.select();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		error = submit(name);
		if (error === null) open = false;
		else input?.focus();
	}
</script>

<dialog
	bind:this={dialog}
	class="hy-dialog"
	aria-labelledby="{uid}-title"
	onclose={() => (open = false)}
>
	<form method="dialog" {onsubmit} novalidate>
		<h2 class="hy-dialog__title" id="{uid}-title">
			{mode === 'create' ? 'Nouvelle collection' : 'Renommer la collection'}
		</h2>
		<label class="name-field">
			<span>Nom de la collection</span>
			<span class="hb-search">
				<input
					bind:this={input}
					bind:value={name}
					type="text"
					autocomplete="off"
					enterkeyhint="done"
					maxlength={NAME_MAX_LENGTH + 20}
					aria-invalid={error !== null}
					aria-describedby={error ? `${uid}-error` : undefined}
				/>
			</span>
		</label>
		{#if error}
			<p class="hy-field-error" id="{uid}-error" role="alert">{MESSAGES[error]}</p>
		{/if}
		<div class="hy-dialog__actions">
			<button type="button" class="hb-btn hb-btn--quiet" onclick={() => (open = false)}>
				Annuler
			</button>
			<button type="submit" class="hb-btn hb-btn--primary">
				{mode === 'create' ? 'Créer' : 'Renommer'}
			</button>
		</div>
	</form>
</dialog>

<style>
	.name-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 14px;
		line-height: 20px;
		font-weight: 500;
	}
</style>
