import { describe, expect, it } from 'vitest';
import { defaultGraph } from '../config/default-graph';
import { DIAGRAM_KINDS } from './diagram-views';
import { compileGraphSource } from './diagram-compile';
import { renderDiagram } from './diagram-render';
import type { ArchitectureGraph } from '../types';

/** The parity matrix: every compiled kind must render with Pele, not the fallback. */
describe('pele render matrix', () => {
	it('renders every compiled diagram kind with pele in node', async () => {
		for (const kind of DIAGRAM_KINDS) {
			const source = compileGraphSource(defaultGraph, kind.id, 'Manef demo');
			const { svg, renderer } = await renderDiagram({ kind: kind.id, format: 'md', source });
			expect(renderer, `${kind.id} fell back to mermaid`).toBe('pele');
			expect(svg, `${kind.id} produced no svg`).toMatch(/^\s*<svg/);
		}
	});

	it('renders authored mermaid sources and stays fast', async () => {
		const source = compileGraphSource(defaultGraph, 'flowchart', 'Manef demo');
		const start = performance.now();
		for (let index = 0; index < 20; index += 1) {
			const { renderer, svg } = await renderDiagram({ kind: 'flowchart', format: 'md', source });
			expect(renderer).toBe('pele');
			expect(svg).toContain('<svg');
		}
		const elapsed = performance.now() - start;
		expect(elapsed, `20 renders took ${elapsed.toFixed(0)}ms`).toBeLessThan(200);
	});

	it('renders a portable link graph the way the embed does', async () => {
		const graph: ArchitectureGraph = {
			schemaVersion: 1,
			nodes: [
				{
					id: 'baton',
					label: 'Baton',
					level: 0,
					tags: [],
					inputs: [],
					outputs: [{ id: 'out', label: 'Provides' }]
				},
				{
					id: 'manef',
					label: 'Manef Diagram',
					level: 1,
					tags: [],
					inputs: [{ id: 'in', label: 'Consumes' }],
					outputs: []
				}
			],
			edges: [
				{
					id: 'e1',
					source: 'baton',
					sourcePort: 'out',
					target: 'manef',
					targetPort: 'in',
					label: 'embeds'
				}
			]
		};
		const source = compileGraphSource(graph, 'flowchart', 'Baton embed');
		const { renderer, svg } = await renderDiagram({ kind: 'flowchart', format: 'md', source });
		expect(renderer).toBe('pele');
		expect(svg).toContain('<svg');
	});
});
