<!-- Line icons from the design (24 × 24, stroke 1.5). Decorative: always aria-hidden. -->
<script lang="ts" module>
	export type IconName =
		'search' | 'book' | 'bookmark' | 'settings' | 'back' | 'forward' | 'close' | 'check';
</script>

<script lang="ts">
	let { name }: { name: IconName } = $props();
</script>

<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
	{#if name === 'search'}
		<circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
	{:else if name === 'book'}
		<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z" />
		<path d="M5 20.5A2.5 2.5 0 0 0 7.5 23H19v-5M9 7h6" />
	{:else if name === 'bookmark'}
		<path d="M6 4h12v16l-6-4-6 4z" />
	{:else if name === 'settings'}
		<path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle
			cx="9"
			cy="17"
			r="2"
		/>
	{:else if name === 'back'}
		<path d="M15 5l-7 7 7 7" />
	{:else if name === 'forward'}
		<path d="M9 5l7 7-7 7" />
	{:else if name === 'close'}
		<path d="M7 7l10 10M17 7L7 17" />
	{:else if name === 'check'}
		<path d="M5 12.5l4.5 4.5L19 7" />
	{/if}
</svg>

<style>
	svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
	}
</style>
