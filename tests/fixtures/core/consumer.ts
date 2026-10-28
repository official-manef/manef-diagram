// This consumer intentionally has no Svelte/React ambient types or app aliases.
import {
	defaultGraph,
	traceGraph,
	createDocument,
	documentAsJson,
	documentAsMarkdown,
	parseDiagramDocument,
	parseDiagramMarkdown,
	importN8nWorkflow,
	n8nCompatibility,
	type ArchitectureGraph,
	type DiagramDocument
} from '../../../slices/architecture-inventory/core';

export function consumer(graph: ArchitectureGraph = defaultGraph): DiagramDocument {
	const connected: string[] = traceGraph(graph, ['architecture'], 'component').nodeIds;
	const document = createDocument(graph, connected.join(', '));
	return parseDiagramMarkdown(documentAsMarkdown(parseDiagramDocument(documentAsJson(document))));
}
export const n8nConsumer = (source: string) => n8nCompatibility(importN8nWorkflow(source));
