import { expect, it } from 'vitest';
import {
	DIAGRAM_KINDS,
	createNodeView,
	mermaidSource,
	viewAsJson,
	viewAsMarkdown
} from './diagram-views';

it('covers every bundled mermaid diagram and round-trips markdown and json', () => {
	expect(DIAGRAM_KINDS.length).toBeGreaterThanOrEqual(24);
	for (const kind of DIAGRAM_KINDS) {
		const view = createNodeView(kind.id, 'Map');
		expect(view.format).toBe('md');
		const body = mermaidSource(view);
		expect(body.startsWith(kind.keyword)).toBe(true);
		const json = viewAsJson({ ...view, source: body, format: 'md' });
		expect(mermaidSource({ kind: kind.id, format: 'json', source: json })).toBe(body);
		expect(
			mermaidSource({
				...view,
				format: 'md',
				source: viewAsMarkdown({ title: view.title, source: body })
			})
		).toBe(body);
	}
});
