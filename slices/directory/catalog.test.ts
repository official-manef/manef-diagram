import { expect, it } from 'vitest';
import { defaultGraph } from '$features/architecture-inventory';
import { auditRows, productMapNodes, products } from './catalog';

it('gives every audit row a unique id', () => {
	const ids = auditRows.map((row) => row.id);
	expect(new Set(ids).size).toBe(ids.length);
	expect(ids).toContain('manef-production-deployment');
	expect(ids).toContain('diagram-production-deployment');
});

it('points directory products at the same public-map node when they are one service', () => {
	for (const [productId, nodeId] of Object.entries(productMapNodes)) {
		const product = products.find((item) => item.id === productId);
		const node = defaultGraph.nodes.find((item) => item.id === nodeId);
		expect(product, productId).toBeTruthy();
		expect(node, nodeId).toBeTruthy();
		expect(product!.domain).toContain(node!.label);
	}
});
