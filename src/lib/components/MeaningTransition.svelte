<!--
  Feature 017: what stands in for the result list while a search by meaning runs
  (specs/017-meaning-results-transition/research.md R3). Three rows shaped like results are
  "being written" in the meaning color, under the sparkle of the mode button. Decorative: the
  status line above (MeaningStatus) says what happens.
-->
<script lang="ts">
	import Icon from './Icon.svelte';
</script>

<div class="meaning-transition" aria-hidden="true">
	<span class="meaning-transition__glyph"><Icon name="meaning" /></span>
	{#each [0, 1, 2] as row (row)}
		<div class="meaning-transition__row" style="--row: {row}">
			<span class="meaning-transition__bar meaning-transition__bar--title"></span>
			<span class="meaning-transition__bar meaning-transition__bar--excerpt"></span>
		</div>
	{/each}
</div>

<style>
	.meaning-transition {
		margin-top: var(--space-6);
	}

	.meaning-transition__glyph {
		display: block;
		width: 20px;
		height: 20px;
		margin-bottom: var(--space-1);
		color: var(--meaning);
	}

	.meaning-transition__glyph :global(svg) {
		width: 20px;
		height: 20px;
	}

	.meaning-transition__row {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px 0;
		border-bottom: 1px solid var(--line);
		overflow: hidden;
	}

	.meaning-transition__bar {
		display: block;
		height: 12px;
		border-radius: var(--radius-sm);
		background: var(--meaning-soft);
	}

	.meaning-transition__bar--title {
		width: 60%;
		height: 16px;
	}

	.meaning-transition__bar--excerpt {
		width: 85%;
	}

	/* The sweep: rows being written, left to right, one after the other. */
	.meaning-transition__row::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			transparent 0%,
			color-mix(in srgb, var(--meaning) 25%, transparent) 50%,
			transparent 100%
		);
		transform: translateX(-100%);
		opacity: 0;
	}

	@media (prefers-reduced-motion: no-preference) {
		.meaning-transition__row::after {
			opacity: 1;
			animation: meaning-sweep 1.2s ease-in-out infinite;
			animation-delay: calc(var(--row) * 150ms);
		}
	}

	@keyframes meaning-sweep {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(100%);
		}
	}
</style>
