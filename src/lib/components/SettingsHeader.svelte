<!--
  Header of a settings section (feature 016, FR-003, research R2): a back link to the menu, at
  every width, then the section title. When the menu is the previous page of this visit, the link
  goes back in history, so the device back gesture and this link agree.
-->
<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from './Icon.svelte';

	let { title, id = 'section-title' }: { title: string; id?: string } = $props();

	let fromMenu = false;
	afterNavigate(({ from }) => {
		fromMenu = from?.route.id === '/reglages';
	});

	function back(event: MouseEvent) {
		if (!fromMenu || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
		event.preventDefault();
		history.back();
	}
</script>

<header class="page__header page__header--back">
	<a
		class="hb-icon-btn"
		href={resolve('/reglages')}
		aria-label="Retour aux Réglages"
		onclick={back}
	>
		<Icon name="back" />
	</a>
	<span class="page__back-label" aria-hidden="true">Réglages</span>
</header>

<h1 {id} class="hy-screen-title">{title}</h1>
