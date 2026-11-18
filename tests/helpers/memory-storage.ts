/** In-memory `Storage` for store tests, with switches to make reads or writes fail. */
export class MemoryStorage implements Storage {
	data = new Map<string, string>();
	failReads = false;
	failWrites = false;
	get length() {
		return this.data.size;
	}
	clear() {
		this.data.clear();
	}
	getItem(key: string) {
		if (this.failReads) throw new Error('SecurityError');
		return this.data.get(key) ?? null;
	}
	key(i: number) {
		return [...this.data.keys()][i] ?? null;
	}
	removeItem(key: string) {
		this.data.delete(key);
	}
	setItem(key: string, value: string) {
		if (this.failWrites) throw new Error('QuotaExceededError');
		this.data.set(key, value);
	}
}
