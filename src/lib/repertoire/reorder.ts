// Feature 008: where a dragged hymn lands, and how the other rows slide (pure, unit-tested).

/** A row's position on the page, read once when the drag starts. */
export type RowBox = { top: number; height: number };

/**
 * Index where the row `from` would land when its centre is at `centerY`: the number of other
 * rows whose midpoint lies above that centre.
 */
export function dropIndex(from: number, rows: RowBox[], centerY: number): number {
	let index = 0;
	rows.forEach((row, i) => {
		if (i !== from && row.top + row.height / 2 < centerY) index++;
	});
	return Math.min(Math.max(index, 0), Math.max(rows.length - 1, 0));
}

/** How many places row `i` slides while row `from` hovers at `to`. */
export function shiftOf(i: number, from: number, to: number): -1 | 0 | 1 {
	if (from < i && i <= to) return -1;
	if (to <= i && i < from) return 1;
	return 0;
}
