<!--
  Text size (T052, FR-015, decisions §7.4): seven steps from 85 to 200 %, kept on the device
  with the reading preferences.
-->
<script lang="ts">
	import { prefs } from '$lib/prefs/prefs';
	import { nearestStep, scaleLabel, stepScale, TEXT_SCALE_STEPS } from '$lib/prefs/text-scale';

	let { labelledby }: { labelledby?: string } = $props();

	const step = $derived(nearestStep($prefs.textScale));
	const change = (direction: 1 | -1) =>
		prefs.update((p) => ({ ...p, textScale: stepScale(p.textScale, direction) }));
</script>

<div
	class="hy-stepper"
	role="group"
	aria-label={labelledby ? undefined : 'Taille du texte'}
	aria-labelledby={labelledby}
>
	<button
		type="button"
		aria-label="Réduire le texte"
		disabled={step === 0}
		onclick={() => change(-1)}
		style="font-size: 15px">A</button
	>
	<output aria-live="polite">{scaleLabel($prefs.textScale)}</output>
	<button
		type="button"
		aria-label="Agrandir le texte"
		disabled={step === TEXT_SCALE_STEPS.length - 1}
		onclick={() => change(1)}
		style="font-size: 22px">A</button
	>
</div>
