import type { Point } from '../types';

export type MarqueeMode = 'window' | 'crossing';

export type WorldRect = { x: number; y: number; width: number; height: number };

export type Selectable =
	| { id: string; kind: 'box'; x: number; y: number; width: number; height: number }
	| { id: string; kind: 'circle'; x: number; y: number; radius: number }
	| { id: string; kind: 'line'; points: Point[] };

/** Left to right encloses. Right to left crosses. Same rule as CAD window selection. */
export function marqueeMode(startX: number, endX: number): MarqueeMode {
	return endX + 0.5 >= startX ? 'window' : 'crossing';
}

export function worldRect(start: Point, end: Point): WorldRect {
	return {
		x: Math.min(start.x, end.x),
		y: Math.min(start.y, end.y),
		width: Math.abs(end.x - start.x),
		height: Math.abs(end.y - start.y)
	};
}

function contains(rect: WorldRect, x: number, y: number) {
	return x >= rect.x && y >= rect.y && x <= rect.x + rect.width && y <= rect.y + rect.height;
}

function boxInside(rect: WorldRect, item: Extract<Selectable, { kind: 'box' }>) {
	return (
		item.x >= rect.x &&
		item.y >= rect.y &&
		item.x + item.width <= rect.x + rect.width &&
		item.y + item.height <= rect.y + rect.height
	);
}

function boxCrosses(rect: WorldRect, item: Extract<Selectable, { kind: 'box' }>) {
	return (
		item.x < rect.x + rect.width &&
		item.x + item.width > rect.x &&
		item.y < rect.y + rect.height &&
		item.y + item.height > rect.y
	);
}

function circleInside(rect: WorldRect, item: Extract<Selectable, { kind: 'circle' }>) {
	return (
		item.x - item.radius >= rect.x &&
		item.y - item.radius >= rect.y &&
		item.x + item.radius <= rect.x + rect.width &&
		item.y + item.radius <= rect.y + rect.height
	);
}

function circleCrosses(rect: WorldRect, item: Extract<Selectable, { kind: 'circle' }>) {
	const nearestX = Math.max(rect.x, Math.min(item.x, rect.x + rect.width));
	const nearestY = Math.max(rect.y, Math.min(item.y, rect.y + rect.height));
	const dx = item.x - nearestX;
	const dy = item.y - nearestY;
	return dx * dx + dy * dy <= item.radius * item.radius;
}

function lineInside(rect: WorldRect, points: Point[]) {
	return points.length > 0 && points.every((point) => contains(rect, point.x, point.y));
}

function lineCrosses(rect: WorldRect, points: Point[]) {
	return points.some((point) => contains(rect, point.x, point.y));
}

export function hitByMarquee(item: Selectable, rect: WorldRect, mode: MarqueeMode): boolean {
	if (item.kind === 'box')
		return mode === 'window' ? boxInside(rect, item) : boxCrosses(rect, item);
	if (item.kind === 'circle')
		return mode === 'window' ? circleInside(rect, item) : circleCrosses(rect, item);
	return mode === 'window' ? lineInside(rect, item.points) : lineCrosses(rect, item.points);
}
