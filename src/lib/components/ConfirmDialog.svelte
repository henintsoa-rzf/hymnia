<!-- Confirmation before an action that removes something (contracts/ui.md, "Collection"). -->
<script lang="ts">
	let {
		open = $bindable(false),
		title,
		text,
		confirmLabel,
		onconfirm
	}: {
		open?: boolean;
		title: string;
		text: string;
		confirmLabel: string;
		onconfirm: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let cancel = $state<HTMLButtonElement>();
	const uid = $props.id();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
			cancel?.focus();
		} else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	class="hy-dialog"
	aria-labelledby="{uid}-title"
	aria-describedby="{uid}-text"
	onclose={() => (open = false)}
>
	<h2 class="hy-dialog__title" id="{uid}-title">{title}</h2>
	<p class="hy-dialog__text" id="{uid}-text">{text}</p>
	<div class="hy-dialog__actions">
		<button
			bind:this={cancel}
			type="button"
			class="hb-btn hb-btn--quiet"
			onclick={() => (open = false)}
		>
			Annuler
		</button>
		<button
			type="button"
			class="hb-btn hb-btn--primary"
			onclick={() => {
				open = false;
				onconfirm();
			}}>{confirmLabel}</button
		>
	</div>
</dialog>
