import { expect, it } from 'vitest';
import { panForZoom } from './camera';

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
