<!--
  Recent collections on the search screen (feature 006, US2; contracts/ui.md): the most recently
  changed collections of the Répertoire, then a link to all of them.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { hymnCountLabel } from '$lib/format';
	import type { Collection } from '$lib/repertoire/schema';
	import Icon from './Icon.svelte';

	let { collections }: { collections: Collection[] } = $props();

	const uid = $props.id();
</script>

{#if collections.length > 0}
	<section aria-labelledby="{uid}-title">
		<h2 class="hb-overline" id="{uid}-title">Collections</h2>
		<ul class="hb-list collections__list" aria-labelledby="{uid}-title">
			{#each collections as collection (collection.id)}
				<li>
					<a
						class="hy-row"
						href={resolve('/repertoire/[collection]', { collection: collection.id })}
					>
						<span class="collections__icon"><Icon name="bookmark" /></span>
						<span class="hy-row__text">
							<span class="hy-row__title">{collection.name}</span>
							<span class="hy-row__meta">{hymnCountLabel(collection.entries.length)}</span>
						</span>
						<Icon name="forward" />
					</a>
				</li>
			{/each}
		</ul>
		<a class="hb-btn hb-btn--quiet collections__all" href={resolve('/repertoire')}
			>Tout le Répertoire</a
		>
	</section>
{/if}

<style>
	.collections__list {
		border-top: 1px solid var(--line);
	}

	.collections__icon {
		display: flex;
		color: var(--ink-muted);
	}

	.collections__icon :global(svg) {
		width: 20px;
		height: 20px;
	}

	.collections__all {
		margin-left: calc(-1 * var(--space-4));
	}
</style>
