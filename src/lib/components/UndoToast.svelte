<!-- "Collection « X » supprimée · Annuler", for a few seconds after a deletion (FR-003). -->
<script lang="ts">
	import { frenchSpaces } from '$lib/format';
	import { repertoire } from '$lib/repertoire/store';

	const deleted = repertoire.lastDeleted;
</script>

<div class="toast-region" role="status">
	{#if $deleted}
		<div class="hy-toast">
			<span>{frenchSpaces(`Collection « ${$deleted.name} » supprimée`)}</span>
			<button type="button" class="hb-btn hb-btn--quiet" onclick={() => $deleted?.undo()}>
				Annuler
			</button>
		</div>
	{/if}
</div>

<style>
	.toast-region:empty {
		display: none;
	}
</style>
