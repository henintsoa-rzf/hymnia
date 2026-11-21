<!-- Calm message with optional actions (never red, decisions §4.1). -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { frenchSpaces } from '$lib/format';

	let {
		title,
		text,
		actions,
		icon,
		role = 'status'
	}: {
		title: string;
		text?: string;
		actions?: Snippet;
		/** Feature 017: a glyph before the title (the meaning sparkle). */
		icon?: Snippet;
		role?: 'status' | null;
	} = $props();
</script>

<div class="hy-message" {role}>
	<p class="hy-message__title">{@render icon?.()}{frenchSpaces(title)}</p>
	{#if text}<p class="hy-message__text">{frenchSpaces(text)}</p>{/if}
	{#if actions}<div class="hy-message__actions">{@render actions()}</div>{/if}
</div>
