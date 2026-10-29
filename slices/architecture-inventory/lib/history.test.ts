import { expect, it } from 'vitest';
import { HISTORY_MAX_CHARS, HISTORY_MAX_ENTRIES, rememberSnapshot } from './history';

it('preserves snapshots independently, deduplicates unchanged content and bounds entries', () => {
	const previous = ['first'];
	const next = rememberSnapshot(previous, 'second');
	expect(previous).toEqual(['first']);
	expect(next).toEqual(['first', 'second']);
	expect(rememberSnapshot(next, 'second')).toBe(next);
	let stack: string[] = [];
	for (let i = 0; i < HISTORY_MAX_ENTRIES + 5; i++) stack = rememberSnapshot(stack, String(i));
	expect(stack).toHaveLength(HISTORY_MAX_ENTRIES);
	expect(stack[0]).toBe('5');
});

it('evicts oldest snapshots under the character budget and refuses oversized entries', () => {
	const large = 'x'.repeat(HISTORY_MAX_CHARS / 2 + 1);
	expect(rememberSnapshot([large], 'y'.repeat(large.length))).toEqual(['y'.repeat(large.length)]);
	expect(rememberSnapshot(['small'], 'x'.repeat(HISTORY_MAX_CHARS + 1))).toEqual([]);
});
