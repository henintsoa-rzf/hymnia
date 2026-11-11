<!-- Reference badge « CE 12 ». A link when `href` is given (44 px tall, decisions §10). -->
<script lang="ts">
	import { refLabel } from '$lib/format';

	let {
		abbreviation,
		number,
		href,
		label
	}: { abbreviation: string; number: string; href?: string; label?: string } = $props();
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass a resolved URL (hymnUrl) -->
	<a class="hy-ref" {href} aria-label={label}>{refLabel(abbreviation, number)}</a>
{:else}
	<span class="hy-ref">{refLabel(abbreviation, number)}</span>
{/if}
