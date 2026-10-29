/** Bounded serialized snapshots; history is local to one editor, never a backend save. */
export const HISTORY_MAX_CHARS = 8_000_000;
export const HISTORY_MAX_ENTRIES = 40;

export function rememberSnapshot(stack: string[], snapshot: string): string[] {
	if (stack.at(-1) === snapshot) return stack;
	const next = [...stack, snapshot].slice(-HISTORY_MAX_ENTRIES);
	let size = next.reduce((total, value) => total + value.length, 0);
	while (size > HISTORY_MAX_CHARS && next.length > 1) size -= next.shift()!.length;
	// Accepted documents are at most five million characters, below the history budget.
	return snapshot.length <= HISTORY_MAX_CHARS ? next : [];
}
