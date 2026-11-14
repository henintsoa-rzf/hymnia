// Feature 008: drag a collection row by its handle (Pointer Events, no dependency);
// specs/008-drag-reorder-collection/research.md R1–R6, contracts/ui.md.
//
// Rows stay where Svelte put them during the drag: only CSS transforms move. On drop, the
// transforms are cleared and `onmove(from, to)` lets the page reorder its data.
import type { Attachment } from 'svelte/attachments';
import { dropIndex, shiftOf, type RowBox } from './reorder';

/** The pointer must move this far (px) before the row lifts, so a tap does nothing. */
const LIFT = 4;
/** Height (px) of the bands at the top and bottom of the viewport that scroll the page. */
const EDGE = 56;
/** Fastest auto-scroll, in px per frame. */
const MAX_SPEED = 12;

const HANDLE = '.collection__handle';
const ROW = ':scope > li[data-row]';

type Drag = {
	pointerId: number;
	handle: HTMLElement;
	items: HTMLElement[];
	/** Rows in page coordinates, read once at the start. */
	rows: RowBox[];
	from: number;
	to: number;
	startY: number;
	startScroll: number;
	clientY: number;
	lifted: boolean;
	frame: number;
};

export function dragReorder(opts: {
	onmove: (from: number, to: number) => void;
}): Attachment<HTMLOListElement> {
	return (list) => {
		let drag: Drag | null = null;

		/** Lay out the rows for the current pointer position; true if the page scrolled. */
		function render(d: Drag): boolean {
			const y = d.clientY;
			const speed =
				y < EDGE
					? -Math.ceil((MAX_SPEED * (EDGE - y)) / EDGE)
					: y > innerHeight - EDGE
						? Math.ceil((MAX_SPEED * (y - (innerHeight - EDGE))) / EDGE)
						: 0;
			const before = scrollY;
			// `instant`: the page's smooth scrolling would leave scrollY unchanged until later.
			if (speed) scrollBy({ top: speed, behavior: 'instant' });

			const row = d.rows[d.from];
			const first = d.rows[0];
			const last = d.rows[d.rows.length - 1];
			const start = row.top + row.height / 2;
			const wanted = start + y - d.startY + scrollY - d.startScroll;
			const centre = Math.min(
				Math.max(wanted, first.top + row.height / 2),
				last.top + last.height - row.height / 2
			);
			// The landing place follows the pointer; only the drawn row is kept within the list
			// (rows can differ in height, so the clamped centre may not reach the first place).
			d.to = dropIndex(d.from, d.rows, wanted);
			d.items.forEach((item, i) => {
				item.style.transform =
					i === d.from
						? `translateY(${centre - start}px)`
						: `translateY(${shiftOf(i, d.from, d.to) * row.height}px)`;
			});
			return scrollY !== before;
		}

		function schedule(d: Drag) {
			if (d.frame) return;
			d.frame = requestAnimationFrame(() => {
				d.frame = 0;
				// Keep scrolling while the pointer rests in an edge band.
				if (drag === d && render(d)) schedule(d);
			});
		}

		/** Put every row back and stop listening; the order is left to the caller. */
		function reset(d: Drag) {
			drag = null;
			if (d.frame) cancelAnimationFrame(d.frame);
			// Drop the transition first, so rows do not slide back while Svelte reorders them.
			list.classList.remove('is-sorting');
			for (const item of d.items) {
				item.classList.remove('is-dragging');
				item.style.removeProperty('transform');
				if (!item.getAttribute('style')) item.removeAttribute('style');
			}
			try {
				if (d.handle.hasPointerCapture(d.pointerId)) d.handle.releasePointerCapture(d.pointerId);
			} catch {
				// The pointer is already gone.
			}
			removeEventListener('pointermove', onMove);
			removeEventListener('pointerup', onUp);
			removeEventListener('pointercancel', onCancel);
			removeEventListener('keydown', onKey);
			d.handle.removeEventListener('lostpointercapture', onCancel);
		}

		function onDown(event: PointerEvent) {
			const handle = (event.target as Element | null)?.closest<HTMLElement>(HANDLE);
			const item = handle?.closest<HTMLElement>('li[data-row]');
			if (drag || !handle || !item || !list.contains(item)) return;
			if (!event.isPrimary || event.button !== 0) return;
			event.preventDefault();

			const items = Array.from(list.querySelectorAll<HTMLElement>(ROW));
			drag = {
				pointerId: event.pointerId,
				handle,
				items,
				rows: items.map((el) => {
					const box = el.getBoundingClientRect();
					return { top: box.top + scrollY, height: box.height };
				}),
				from: items.indexOf(item),
				to: items.indexOf(item),
				startY: event.clientY,
				startScroll: scrollY,
				clientY: event.clientY,
				lifted: false,
				frame: 0
			};
			try {
				handle.setPointerCapture(event.pointerId);
			} catch {
				// Not an active pointer (synthetic event): window listeners still get the moves.
			}
			addEventListener('pointermove', onMove);
			addEventListener('pointerup', onUp);
			addEventListener('pointercancel', onCancel);
			addEventListener('keydown', onKey);
			handle.addEventListener('lostpointercapture', onCancel);
		}

		function onMove(event: PointerEvent) {
			const d = drag;
			if (!d || event.pointerId !== d.pointerId) return;
			d.clientY = event.clientY;
			if (!d.lifted) {
				if (Math.abs(d.clientY - d.startY) < LIFT) return;
				d.lifted = true;
				list.classList.add('is-sorting');
				d.items[d.from].classList.add('is-dragging');
			}
			schedule(d);
		}

		function onUp(event: PointerEvent) {
			const d = drag;
			if (!d || event.pointerId !== d.pointerId) return;
			if (!d.lifted) return reset(d);
			d.clientY = event.clientY;
			render(d);
			const pageY = event.clientY + scrollY;
			const reach = d.rows[d.from].height;
			const last = d.rows[d.rows.length - 1];
			const inside = pageY >= d.rows[0].top - reach && pageY <= last.top + last.height + reach;
			const { from, to } = d;
			reset(d);
			// A click may follow on whatever is under the pointer: swallow it.
			const swallow = (click: Event) => {
				click.preventDefault();
				click.stopPropagation();
			};
			addEventListener('click', swallow, { capture: true, once: true });
			setTimeout(() => removeEventListener('click', swallow, { capture: true }), 0);
			if (inside && from !== to) opts.onmove(from, to);
		}

		function onCancel(event: Event) {
			const d = drag;
			if (!d) return;
			if (event instanceof PointerEvent && event.pointerId !== d.pointerId) return;
			reset(d);
		}

		function onKey(event: KeyboardEvent) {
			if (event.key === 'Escape' && drag) {
				event.preventDefault();
				reset(drag);
			}
		}

		list.addEventListener('pointerdown', onDown);
		return () => {
			if (drag) reset(drag);
			list.removeEventListener('pointerdown', onDown);
		};
	};
}
