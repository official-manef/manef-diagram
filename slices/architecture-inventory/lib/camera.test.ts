import { expect, it } from 'vitest';
import { panForZoom, wheelGesture } from './camera';

it('keeps the point under the cursor fixed when zooming', () => {
	const pan = { x: 40, y: -20 };
	const cursor = { x: 320, y: 180 };
	const zoom = 0.8;
	const nextZoom = 1.2;
	const world = { x: (cursor.x - pan.x) / zoom, y: (cursor.y - pan.y) / zoom };
	const next = panForZoom(pan, cursor, zoom, nextZoom);
	expect(next.x + world.x * nextZoom).toBeCloseTo(cursor.x);
	expect(next.y + world.y * nextZoom).toBeCloseTo(cursor.y);
});

it('normalizes trackpad, shifted wheel, line and page panning without changing zoom', () => {
	const base = {
		deltaX: 0,
		deltaY: 10,
		deltaMode: 0,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false
	};
	expect(wheelGesture({ ...base, deltaX: 5 }, 500)).toEqual({
		kind: 'pan',
		delta: { x: -5, y: -10 }
	});
	expect(wheelGesture({ ...base, shiftKey: true }, 500)).toEqual({
		kind: 'pan',
		delta: { x: -10, y: 0 }
	});
	expect(wheelGesture({ ...base, deltaMode: 1 }, 500)).toEqual({
		kind: 'pan',
		delta: { x: -0, y: -160 }
	});
	expect(wheelGesture({ ...base, deltaY: 1, deltaMode: 2 }, 500)).toEqual({
		kind: 'pan',
		delta: { x: -0, y: -500 }
	});
	const zero = wheelGesture({ ...base, deltaY: 0, ctrlKey: true }, 500);
	expect(zero).toEqual({ kind: 'zoom', factor: 1 });
	expect(wheelGesture({ ...base, metaKey: true, deltaY: -100 }, 500)).toEqual({
		kind: 'zoom',
		factor: Math.exp(0.2)
	});
});
