import type { Point } from '../types';

/** Keep the world point under `anchor` fixed while the zoom changes. */
export function panForZoom(pan: Point, anchor: Point, zoom: number, nextZoom: number): Point {
	if (zoom === 0) return pan;
	const scale = nextZoom / zoom;
	return {
		x: anchor.x - (anchor.x - pan.x) * scale,
		y: anchor.y - (anchor.y - pan.y) * scale
	};
}
