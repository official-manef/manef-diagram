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

export type WheelInput = {
	deltaX: number;
	deltaY: number;
	deltaMode: number;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
};

/** Ordinary wheel/two-finger scroll pans; browser pinch gestures signal Ctrl. */
export function wheelGesture(
	input: WheelInput,
	pageHeight: number
): { kind: 'pan'; delta: Point } | { kind: 'zoom'; factor: number } {
	const unit = input.deltaMode === 1 ? 16 : input.deltaMode === 2 ? pageHeight : 1;
	const x = Number.isFinite(input.deltaX) ? input.deltaX * unit : 0;
	const y = Number.isFinite(input.deltaY) ? input.deltaY * unit : 0;
	if (input.ctrlKey || input.metaKey) {
		return { kind: 'zoom', factor: Math.exp(-Math.max(-600, Math.min(600, y)) * 0.002) };
	}
	return { kind: 'pan', delta: input.shiftKey && x === 0 ? { x: -y, y: 0 } : { x: -x, y: -y } };
}
