import type { NodeView } from '../types';
import { mermaidSource } from './diagram-views';

/**
 * Diagram rendering: Pele first, mermaid.js as fallback.
 *
 * Pele renders Mermaid synchronously with no dependencies and themes through
 * CSS variables (mapped to the editor tokens in editor.css), so previews and
 * views draw instantly in both themes. mermaid.js stays as the fallback until
 * Pele parity is proven by the render matrix, so a Pele parse failure never
 * breaks a view that Mermaid can draw. Pele is pinned to an exact version.
 */

export type DiagramRenderer = 'pele' | 'mermaid';
export type DiagramTheme = 'dark' | 'neutral';

type PeleModule = typeof import('pele');

let pelePromise: Promise<PeleModule> | undefined;

function loadPele(): Promise<PeleModule> {
	pelePromise ??= import('pele');
	return pelePromise;
}

/** Render options shared by both engines: no interactive links or images inside diagrams. */
const PELE_OPTIONS = { responsive: true, links: false, images: false } as const;

async function renderWithMermaid(source: string, theme: DiagramTheme): Promise<string> {
	const mermaid = (await import('mermaid')).default;
	mermaid.initialize({
		startOnLoad: false,
		suppressErrorRendering: true,
		securityLevel: 'strict',
		theme: theme === 'dark' ? 'dark' : 'neutral',
		fontFamily: 'inherit'
	});
	const drawn = await mermaid.render(`mmd-${crypto.randomUUID()}`, source);
	return drawn.svg;
}

/** Render a view's source with Pele first and mermaid.js as the fallback. */
export async function renderDiagram(
	view: Pick<NodeView, 'kind' | 'format' | 'source'>,
	theme: DiagramTheme = 'neutral'
): Promise<{ svg: string; renderer: DiagramRenderer }> {
	const source = mermaidSource(view);
	const pele = await loadPele();
	if (pele.supports(source)) {
		try {
			const rendered = pele.render(source, PELE_OPTIONS);
			return { svg: rendered.svg, renderer: 'pele' };
		} catch {
			// Pele could not draw this source (syntax, semantics or limits);
			// mermaid.js is the compatibility fallback until parity is proven.
		}
	}
	return { svg: await renderWithMermaid(source, theme), renderer: 'mermaid' };
}
