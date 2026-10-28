import type { ArchitectureGraph, ArchitectureNode, ArchitecturePort, Point } from '../types';
import {
	documentAsJson,
	createDocument,
	validateDiagramDocument,
	type DiagramDocument
} from './document';
import { cloneJson, isJsonValue, sameJson, type JsonObject } from './json';

export const N8N_REFERENCE = {
	version: '2.43.7',
	revision: 'b7c54308e4d782af48043acf6558926f2f1f8e3b',
	workflowTypesUrl:
		'https://github.com/n8n-io/n8n/blob/b7c54308e4d782af48043acf6558926f2f1f8e3b/packages/workflow/src/interfaces.ts',
	importUrl:
		'https://github.com/n8n-io/n8n/blob/b7c54308e4d782af48043acf6558926f2f1f8e3b/packages/cli/src/services/import.service.ts',
	docsUrl: 'https://docs.n8n.io/build/manage-workflows/export-and-import/'
} as const;

export const N8N_MAX_NODES = 2_000;
export const N8N_MAX_CONNECTIONS = 10_000;
export const N8N_MAX_SOURCE_CHARS = 5_000_000;

export type N8nDiagnostic = {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
};

export type N8nCompatibility = {
	compatible: boolean;
	diagnostics: N8nDiagnostic[];
};

type Projection = {
	workflow: JsonObject;
	graph: ArchitectureGraph;
	positions: Record<string, Point>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(path: string, reason: string): never {
	throw new Error(`n8n workflow ${path}: ${reason}`);
}

function isName(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function port(type: string, index: number): ArchitecturePort {
	return { id: JSON.stringify([type, index]), label: `${type} ${index}`, kind: type };
}

function addPort(ports: ArchitecturePort[], type: string, index: number): void {
	const next = port(type, index);
	if (!ports.some((current) => current.id === next.id)) ports.push(next);
}

function projectWorkflow(value: unknown): Projection {
	if (!isJsonValue(value) || !isRecord(value)) {
		invalid('$', 'expected a plain JSON workflow object.');
	}
	if (!Array.isArray(value.nodes) || !isRecord(value.connections)) {
		invalid('$', 'needs a nodes array and a connections object; import one workflow at a time.');
	}
	if (value.nodes.length > N8N_MAX_NODES) {
		invalid('nodes', `exceeds the ${N8N_MAX_NODES} node limit.`);
	}

	const graph: ArchitectureGraph = { schemaVersion: 1, nodes: [], edges: [] };
	const positions: Record<string, Point> = {};
	const nodesByName = new Map<string, ArchitectureNode>();
	for (const [index, raw] of value.nodes.entries()) {
		const path = `nodes[${index}]`;
		if (!isRecord(raw) || !isName(raw.name)) invalid(path, 'needs a nonempty node name.');
		if (nodesByName.has(raw.name)) {
			invalid(`${path}.name`, 'must be unique because n8n connections reference node names.');
		}
		if (!isName(raw.type)) invalid(`${path}.type`, 'needs an explicit n8n node type.');
		if (
			typeof raw.typeVersion !== 'number' ||
			!Number.isFinite(raw.typeVersion) ||
			raw.typeVersion <= 0
		) {
			invalid(`${path}.typeVersion`, 'needs a positive finite node version.');
		}
		if (!isRecord(raw.parameters)) invalid(`${path}.parameters`, 'needs a JSON object.');
		if (
			!Array.isArray(raw.position) ||
			raw.position.length !== 2 ||
			!raw.position.every(
				(coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)
			)
		) {
			invalid(`${path}.position`, 'needs two finite coordinates.');
		}
		const node: ArchitectureNode = {
			id: `n8n-node-${index + 1}`,
			label: raw.name,
			subtitle: raw.type,
			tags: ['n8n', `n8n:type:${raw.type}`],
			inputs: [],
			outputs: []
		};
		graph.nodes.push(node);
		nodesByName.set(raw.name, node);
		positions[node.id] = { x: raw.position[0] as number, y: raw.position[1] as number };
	}

	let slotCount = 0;
	const connectionKeys = new Set<string>();
	for (const [sourceName, channels] of Object.entries(value.connections)) {
		const source = nodesByName.get(sourceName);
		if (!source) invalid('connections', 'contains a source name that is absent from nodes.');
		if (!isRecord(channels)) invalid('connections', 'each source needs a connection-type object.');
		for (const [sourceType, outputs] of Object.entries(channels)) {
			if (!isName(sourceType) || !Array.isArray(outputs)) {
				invalid('connections', 'each connection type needs an array of output slots.');
			}
			slotCount += outputs.length;
			if (slotCount > N8N_MAX_CONNECTIONS) {
				invalid('connections', `exceeds the ${N8N_MAX_CONNECTIONS} output-slot limit.`);
			}
			for (const [outputIndex, connections] of outputs.entries()) {
				addPort(source.outputs, sourceType, outputIndex);
				if (connections === null) continue;
				if (!Array.isArray(connections)) {
					invalid('connections', 'each output slot must be an array or null.');
				}
				for (const raw of connections) {
					if (
						!isRecord(raw) ||
						!isName(raw.node) ||
						!isName(raw.type) ||
						typeof raw.index !== 'number' ||
						!Number.isSafeInteger(raw.index) ||
						raw.index < 0
					) {
						invalid(
							'connections',
							'each destination needs a node name, connection type and nonnegative integer input index.'
						);
					}
					const target = nodesByName.get(raw.node);
					if (!target)
						invalid('connections', 'contains a destination name that is absent from nodes.');
					const key = JSON.stringify([
						source.id,
						sourceType,
						outputIndex,
						target.id,
						raw.type,
						raw.index
					]);
					if (connectionKeys.has(key)) {
						invalid(
							'connections',
							'contains duplicate endpoint/port connections. Remove the duplicate in n8n before importing; the MANEF graph requires unique connections.'
						);
					}
					connectionKeys.add(key);
					if (connectionKeys.size > N8N_MAX_CONNECTIONS) {
						invalid('connections', `exceeds the ${N8N_MAX_CONNECTIONS} connection limit.`);
					}
					addPort(target.inputs, raw.type, raw.index);
					graph.edges.push({
						id: `n8n-edge-${graph.edges.length + 1}`,
						source: source.id,
						sourcePort: port(sourceType, outputIndex).id,
						target: target.id,
						targetPort: port(raw.type, raw.index).id
					});
				}
			}
		}
	}
	return { workflow: cloneJson(value) as JsonObject, graph, positions };
}

/** Retains the complete source workflow; the architecture graph is its read-only projection. */
export function importN8nWorkflow(source: string | unknown): DiagramDocument {
	if (typeof source === 'string' && source.length > N8N_MAX_SOURCE_CHARS) {
		invalid('$', `exceeds the ${N8N_MAX_SOURCE_CHARS} character import limit.`);
	}
	const value: unknown = typeof source === 'string' ? JSON.parse(source) : source;
	const { workflow, graph, positions } = projectWorkflow(value);
	const title = isName(workflow.name) ? workflow.name : 'n8n workflow';
	const document = createDocument(graph, title);
	document.ui = {
		...document.ui,
		positions,
		layouts: { '[]': cloneJson(positions) }
	};
	document.extensions = {
		n8n: { adapterVersion: 1, workflow, baselineGraph: cloneJson(graph) }
	};
	if (!validateDiagramDocument(document)) {
		invalid('$', 'cannot fit the canonical document contract.');
	}
	try {
		documentAsJson(document);
	} catch {
		invalid(
			'$',
			'the expanded MANEF document exceeds the canonical import size limit. Import a smaller workflow.'
		);
	}
	return document;
}

export function n8nCompatibility(document: DiagramDocument): N8nCompatibility {
	const diagnostics: N8nDiagnostic[] = [];
	if (!validateDiagramDocument(document)) {
		diagnostics.push({
			code: 'invalid-document',
			severity: 'error',
			message: 'The MANEF document is invalid.'
		});
		return { compatible: false, diagnostics };
	}
	const extension = isRecord(document.extensions) ? document.extensions.n8n : undefined;
	if (!isRecord(extension)) {
		diagnostics.push({
			code: 'n8n-workflow-required',
			severity: 'error',
			message:
				'Import an n8n workflow first. Diagram shapes alone do not define executable n8n node types, parameters or credentials.'
		});
		return { compatible: false, diagnostics };
	}
	if (extension.adapterVersion !== 1) {
		diagnostics.push({
			code: 'unsupported-adapter',
			severity: 'error',
			message: 'This n8n adapter version is unsupported.'
		});
		return { compatible: false, diagnostics };
	}
	try {
		const projection = projectWorkflow(extension.workflow);
		if (!sameJson(projection.graph, extension.baselineGraph)) {
			diagnostics.push({
				code: 'invalid-n8n-baseline',
				severity: 'error',
				message:
					'The preserved n8n workflow and its baseline graph disagree. Re-import the n8n workflow.'
			});
		} else if (!sameJson(document.graph, extension.baselineGraph)) {
			diagnostics.push({
				code: 'n8n-projection-changed',
				severity: 'error',
				message:
					'The projected graph has changed. Export the MANEF document to keep your edits, or re-import the original n8n workflow before n8n export; these edits cannot yet be mapped safely to executable nodes.'
			});
		} else {
			diagnostics.push({
				code: 'n8n-preserved-workflow',
				severity: 'info',
				message:
					'The original n8n workflow, connection order, layout and unknown fields are preserved. Canvas display settings stay in the MANEF document.'
			});
		}
	} catch (error) {
		diagnostics.push({
			code: 'invalid-n8n-workflow',
			severity: 'error',
			message: error instanceof Error ? error.message : 'The preserved n8n workflow is invalid.'
		});
	}
	return {
		compatible: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
		diagnostics
	};
}

/** Preserve is lossless; inactive deliberately changes publishing state for a new import. */
export function exportN8nWorkflow(
	document: DiagramDocument,
	options: { mode?: 'preserve' | 'inactive' } = {}
): string {
	if (options.mode !== undefined && options.mode !== 'preserve' && options.mode !== 'inactive') {
		throw new Error('Unknown n8n export mode.');
	}
	const compatibility = n8nCompatibility(document);
	if (!compatibility.compatible) {
		throw new Error(
			compatibility.diagnostics
				.filter((diagnostic) => diagnostic.severity === 'error')
				.map((diagnostic) => diagnostic.message)
				.join(' ')
		);
	}
	const extension = (document.extensions as Record<string, unknown>).n8n as Record<string, unknown>;
	const workflow = cloneJson(extension.workflow) as JsonObject;
	if (options.mode === 'inactive') {
		workflow.active = false;
		if (Object.hasOwn(workflow, 'activeVersionId')) workflow.activeVersionId = null;
	}
	return JSON.stringify(workflow, null, 2);
}
