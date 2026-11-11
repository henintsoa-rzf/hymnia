<!--
  Offline support (T062, FR-018): registers the service worker and, when a new version of the
  app or of the hymn data is ready, offers to reload. Nothing is reloaded without the user.
-->
<script lang="ts">
	import { useRegisterSW } from 'virtual:pwa-register/svelte';

	const { needRefresh, updateServiceWorker } = useRegisterSW();
</script>

{#if $needRefresh}
	<div class="update" role="status">
		<p>Une nouvelle version des chants est disponible.</p>
		<div class="update__actions">
			<button type="button" class="hb-btn hb-btn--quiet" onclick={() => needRefresh.set(false)}>
				Plus tard
			</button>
			<button type="button" class="hb-btn hb-btn--primary" onclick={() => updateServiceWorker()}>
				Recharger
			</button>
		</div>
	</div>
{/if}

<style>
	.update {
		position: fixed;
		z-index: 30;
		left: var(--space-4);
		right: var(--space-4);
		bottom: calc(var(--tabbar-height) + env(safe-area-inset-bottom) + var(--space-3));
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
		max-width: 36em;
		margin: 0 auto;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		background: var(--paper-raised);
		box-shadow: var(--shadow-float);
	}

	.update p {
		margin: 0;
		font-size: 15px;
		line-height: 22px;
	}

	.update__actions {
		display: flex;
		gap: var(--space-2);
	}

	@media (min-width: 1024px) {
		.update {
			bottom: var(--space-6);
		}
	}
</style>
