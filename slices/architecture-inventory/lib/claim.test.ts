import { describe, expect, it } from 'vitest';
import { canClaim, claimName } from './claim';
import type { ArchitectureGraph } from '../types';

function graph(labels: string[]): ArchitectureGraph {
	return {
		schemaVersion: 1,
		nodes: labels.map((label, index) => ({
			id: `n${index}`,
			label,
			tags: [],
			inputs: [{ id: 'in', label: 'Consumes' }],
			outputs: [{ id: 'out', label: 'Provides' }]
		})),
		edges: []
	};
}

describe('claim helpers', () => {
	it('requires a shared link, enabled auth and a configured Convex backend', () => {
		expect(canClaim({ sharedLink: true, authEnabled: true, convexConfigured: true })).toBe(true);
		for (const key of ['sharedLink', 'authEnabled', 'convexConfigured'] as const) {
			expect(
				canClaim({ sharedLink: true, authEnabled: true, convexConfigured: true, [key]: false })
			).toBe(false);
		}
	});

	it('derives the name from the document title first', () => {
		expect(claimName('  Baton provider tunnel  ', graph(['Workspace']))).toBe(
			'Baton provider tunnel'
		);
		expect(claimName('   ', graph(['Workspace account']))).toBe('Workspace account diagram');
		expect(claimName(undefined, graph(['Baton']))).toBe('Baton diagram');
		expect(claimName(undefined, graph([]))).toBe('Claimed diagram');
	});

	it('bounds long names to the snapshot limit', () => {
		const long = 'x'.repeat(300);
		expect(claimName(long, graph([])).length).toBe(160);
		expect(claimName(undefined, graph([long])).length).toBeLessThanOrEqual(160);
	});
});
