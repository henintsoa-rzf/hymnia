<!-- Tells the user once when collections cannot be kept, or were unreadable (contracts/storage.md). -->
<script lang="ts">
	import { repertoire } from '$lib/repertoire/store';

	const notice = repertoire.notice;
	const MESSAGES = {
		unavailable: 'Vos collections ne pourront pas être conservées sur cet appareil.',
		corrupt: 'Le répertoire enregistré était illisible ; il a été mis de côté.'
	} as const;
</script>

{#if $notice}
	<div class="hy-toast notice" role="status">
		<span>{MESSAGES[$notice].replace(' ;', ' ;')}</span>
		<button type="button" class="hb-btn hb-btn--quiet" onclick={repertoire.dismissNotice}>OK</button
		>
	</div>
{/if}

<style>
	.notice {
		bottom: auto;
		top: calc(var(--space-3) + env(safe-area-inset-top));
	}
</style>
