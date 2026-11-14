<!--
  « Essayez » on a first visit (feature 006, US3; contracts/ui.md): a number, a title and a few
  words of lyrics from the loaded hymnals. Each one fills the search field.
-->
<script lang="ts">
	import type { SearchExample } from '$lib/search/examples';

	let { examples, onpick }: { examples: SearchExample[]; onpick: (query: string) => void } =
		$props();

	const uid = $props.id();
</script>

{#if examples.length > 0}
	<section aria-labelledby="{uid}-title">
		<h2 class="hb-overline" id="{uid}-title">Essayez</h2>
		<ul class="hb-list examples">
			{#each examples as example (example.kind)}
				<li>
					<button
						type="button"
						class="hb-btn examples__btn"
						aria-label="Rechercher {example.query}"
						onclick={() => onpick(example.query)}>{example.query}</button
					>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.examples {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.examples__btn {
		max-width: 100%;
		font-weight: 400;
		text-align: left;
	}
</style>
