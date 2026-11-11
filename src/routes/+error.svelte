<!--
  Unknown address or failed load (T027). A "not found" page, not an error page
  (contracts/routes.md).
-->
<script lang="ts">
	import { page } from '$app/state';
	import NotFound from '$lib/components/NotFound.svelte';
</script>

<div class="page">
	{#if page.status === 404}
		<NotFound
			title="Page introuvable"
			text="Cette adresse ne correspond à aucune page de Hymnia. Le lien est peut-être incomplet."
		/>
	{:else}
		<NotFound
			title="Les chants n’ont pas pu être chargés"
			text="Vérifiez la connexion, puis rechargez la page. Une fois ouverte une première fois, Hymnia fonctionne sans réseau."
		/>
	{/if}
</div>
