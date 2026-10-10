import { describe, expect, it } from 'vitest';
import { hitByMarquee, marqueeMode } from './select';

describe('CAD marquee', () => {
	const card = { id: 'card', kind: 'box' as const, x: 100, y: 100, width: 80, height: 40 };
	const dot = { id: 'dot', kind: 'circle' as const, x: 40, y: 40, radius: 8 };

	it('treats left-to-right as a window and right-to-left as a crossing', () => {
		expect(marqueeMode(10, 80)).toBe('window');
		expect(marqueeMode(80, 10)).toBe('crossing');
	});

	it('window selection keeps only what is fully inside', () => {
		const cover = { x: 90, y: 90, width: 100, height: 60 };
		const overlap = { x: 140, y: 90, width: 80, height: 60 };
		expect(hitByMarquee(card, cover, 'window')).toBe(true);
		expect(hitByMarquee(card, overlap, 'window')).toBe(false);
		expect(hitByMarquee(card, overlap, 'crossing')).toBe(true);
	});

	it('crossing selection catches a dot the window only touches', () => {
		const touch = { x: 44, y: 20, width: 30, height: 30 };
		expect(hitByMarquee(dot, touch, 'window')).toBe(false);
		expect(hitByMarquee(dot, touch, 'crossing')).toBe(true);
	});
});
