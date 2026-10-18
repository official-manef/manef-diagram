import { describe, expect, it } from 'vitest';
import {
	createDocument,
	documentAsJson,
	documentAsMarkdown,
	parseDiagramDocument,
	parseDiagramMarkdown
} from './document';
import { defaultGraph } from '../config/default-graph';
import { N8N_MAX_NODES, exportN8nWorkflow, importN8nWorkflow, n8nCompatibility } from './n8n';

function workflowFixture() {
	return {
		id: 'fixture-workflow',
		name: 'Branches and AI',
		active: true,
		activeVersionId: 'published-version',
		versionId: 'draft-version',
		versionCounter: 7,
		settings: { executionOrder: 'v1', timezone: 'Asia/Jakarta', unknownSetting: [true, null] },
		staticData: { node: { cursor: 'fixture-cursor' } },
		meta: { templateCredsSetupCompleted: false, extension: { nested: ['α', 0, false, null] } },
		nodeGroups: [
			{ id: 'group-id', name: 'Fixture group', nodeIds: ['node-http'], description: 'Kept' }
		],
		tags: [{ id: 'tag-id', name: 'offline fixture' }],
		unknownRoot: { future: true, array: [1, { key: 'value' }] },
		nodes: [
			{
				id: 'node-start',
				name: 'Start',
				type: 'n8n-nodes-base.manualTrigger',
				typeVersion: 1,
				position: [-320, 80],
				parameters: {}
			},
			{
				id: 'node-switch',
				name: 'Route',
				type: 'n8n-nodes-base.switch',
				typeVersion: 3.2,
				position: [-80, 80],
				parameters: {
					mode: 'rules',
					rules: {
						values: [
							{ conditions: { conditions: [{ leftValue: '={{ $json.ok }}', rightValue: true }] } }
						]
					}
				},
				onError: 'continueErrorOutput',
				futureNodeField: { retain: true }
			},
			{
				id: 'node-http',
				name: 'HTTP Request',
				type: 'n8n-nodes-base.httpRequest',
				typeVersion: 4.2,
				position: [240, -60],
				parameters: {
					url: 'https://example.invalid/fixture',
					jsonBody: '={{ $("Route").item.json }}',
					options: {}
				},
				credentials: {
					httpHeaderAuth: {
						id: 'fixture-credential-id',
						name: 'Fixture reference only',
						__futureReference: 1
					}
				},
				webhookId: 'fixture-webhook',
				retryOnFail: true,
				maxTries: 2
			},
			{
				id: 'node-agent',
				name: 'Agent',
				type: '@n8n/n8n-nodes-langchain.agent',
				typeVersion: 2.2,
				position: [240, 220],
				parameters: { promptType: 'define', text: '={{ $json.prompt }}' }
			},
			{
				id: 'node-model',
				name: 'Model',
				type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
				typeVersion: 1.2,
				position: [60, 420],
				parameters: { modelName: 'fixture-model' },
				credentials: { openAiApi: { id: null, name: 'Fixture unresolved reference' } }
			}
		],
		connections: {
			Start: {
				main: [
					[{ node: 'Route', type: 'main', index: 0, futureConnectionField: { preserved: true } }]
				]
			},
			Route: {
				main: [
					[
						{ node: 'HTTP Request', type: 'main', index: 1 },
						{ node: 'Agent', type: 'main', index: 0 }
					],
					null,
					[],
					[{ node: 'Start', type: 'main', index: 0 }]
				]
			},
			Model: {
				ai_languageModel: [[{ node: 'Agent', type: 'ai_languageModel', index: 0 }]],
				ai_futureChannel: [null, [{ node: 'Agent', type: 'ai_futureInput', index: 2 }]]
			},
			Agent: { main: [[{ node: 'Route', type: 'main', index: 0 }]] }
		},
		pinData: {
			'HTTP Request': [
				{ json: { prompt: 'offline', ok: false, optional: null }, pairedItem: { item: 0 } }
			]
		}
	};
}

describe('n8n preservation adapter', () => {
	it('projects names, typed output/input indexes, cycles and positions without changing raw node IDs', () => {
		const workflow = workflowFixture();
		const document = importN8nWorkflow(JSON.stringify(workflow));
		expect(document.title).toBe('Branches and AI');
		expect(document.graph.nodes.map((node) => [node.id, node.label])).toEqual([
			['n8n-node-1', 'Start'],
			['n8n-node-2', 'Route'],
			['n8n-node-3', 'HTTP Request'],
			['n8n-node-4', 'Agent'],
			['n8n-node-5', 'Model']
		]);
		expect(document.ui?.positions?.['n8n-node-1']).toEqual({ x: -320, y: 80 });
		expect(document.ui?.layouts?.['[]']).toEqual(document.ui?.positions);
		expect(document.graph.nodes[1].outputs.map((port) => port.id)).toEqual([
			'["main",0]',
			'["main",1]',
			'["main",2]',
			'["main",3]'
		]);
		expect(document.graph.edges).toContainEqual({
			id: 'n8n-edge-2',
			source: 'n8n-node-2',
			sourcePort: '["main",0]',
			target: 'n8n-node-3',
			targetPort: '["main",1]'
		});
		expect(document.graph.edges).toContainEqual({
			id: 'n8n-edge-5',
			source: 'n8n-node-5',
			sourcePort: '["ai_languageModel",0]',
			target: 'n8n-node-4',
			targetPort: '["ai_languageModel",0]'
		});
		expect(JSON.parse(exportN8nWorkflow(document))).toEqual(workflow);
	});

	it('preserves every field through canonical JSON and Markdown round trips', () => {
		const workflow = workflowFixture();
		const imported = importN8nWorkflow(workflow);
		const jsonRoundTrip = parseDiagramDocument(documentAsJson(imported));
		const markdownRoundTrip = parseDiagramMarkdown(documentAsMarkdown(jsonRoundTrip));
		expect(JSON.parse(exportN8nWorkflow(markdownRoundTrip))).toEqual(workflow);
		expect(JSON.parse(exportN8nWorkflow(markdownRoundTrip)).connections.Route.main[1]).toBeNull();
		expect(JSON.parse(exportN8nWorkflow(markdownRoundTrip)).connections.Route.main[2]).toEqual([]);
	});

	it('does not mutate either the caller workflow or preserved source while exporting inactive', () => {
		const workflow = workflowFixture();
		const original = structuredClone(workflow);
		const document = importN8nWorkflow(workflow);
		workflow.nodes[0].name = 'Caller changed';
		const inactive = JSON.parse(exportN8nWorkflow(document, { mode: 'inactive' }));
		expect(inactive).toEqual({ ...original, active: false, activeVersionId: null });
		expect(JSON.parse(exportN8nWorkflow(document))).toEqual(original);
	});

	it('keeps unknown node types, missing legacy IDs and unresolved credential references', () => {
		const workflow = workflowFixture();
		const node = workflow.nodes[4] as Record<string, unknown>;
		delete node.id;
		node.type = 'community.futureNode';
		const document = importN8nWorkflow(workflow);
		expect(JSON.parse(exportN8nWorkflow(document))).toEqual(workflow);
		expect(n8nCompatibility(document).compatible).toBe(true);
	});

	it('refuses to invent executable behavior for an unbound diagram', () => {
		const document = createDocument(defaultGraph, 'Diagram');
		expect(n8nCompatibility(document)).toMatchObject({
			compatible: false,
			diagnostics: [{ code: 'n8n-workflow-required', severity: 'error' }]
		});
		expect(() => exportN8nWorkflow(document)).toThrow(/Import an n8n workflow first/);
	});

	it('rejects edited projections instead of exporting stale executable workflow', () => {
		const document = importN8nWorkflow(workflowFixture());
		document.graph.nodes[0].label = 'Renamed node';
		expect(n8nCompatibility(document)).toMatchObject({
			compatible: false,
			diagnostics: [{ code: 'n8n-projection-changed' }]
		});
		expect(() => exportN8nWorkflow(document)).toThrow(/projected graph has changed/);
		expect(parseDiagramDocument(documentAsJson(document)).graph.nodes[0].label).toBe(
			'Renamed node'
		);
	});

	it('rechecks preserved workflow against baseline after a canonical document import', () => {
		const document = importN8nWorkflow(workflowFixture());
		const extensions = document.extensions as { n8n: { workflow: { nodes: { name: string }[] } } };
		extensions.n8n.workflow.nodes[0].name = 'Changed raw source';
		expect(n8nCompatibility(document).compatible).toBe(false);
		expect(() => exportN8nWorkflow(document)).toThrow(
			/source name that is absent|baseline graph disagree/
		);
	});

	it('rejects duplicate node names and unresolved connection endpoints with actionable errors', () => {
		const duplicate = workflowFixture();
		duplicate.nodes[1].name = duplicate.nodes[0].name;
		expect(() => importN8nWorkflow(duplicate)).toThrow(/must be unique/);
		const unknown = workflowFixture();
		unknown.connections.Start.main[0][0].node = 'Missing';
		expect(() => importN8nWorkflow(unknown)).toThrow(/destination name that is absent/);
	});

	it('rejects duplicate connections without returning a partially converted document', () => {
		const workflow = workflowFixture();
		workflow.connections.Start.main[0].push({ ...workflow.connections.Start.main[0][0] });
		expect(() => importN8nWorkflow(workflow)).toThrow(/Remove the duplicate in n8n/);
	});

	it('validates indexes, positions and complete explicit n8n node bindings', () => {
		const negativeIndex = workflowFixture();
		negativeIndex.connections.Start.main[0][0].index = -1;
		expect(() => importN8nWorkflow(negativeIndex)).toThrow(/nonnegative integer input index/);
		const noType = workflowFixture();
		noType.nodes[0].type = '';
		expect(() => importN8nWorkflow(noType)).toThrow(/explicit n8n node type/);
		const noPosition = workflowFixture();
		noPosition.nodes[0].position = [0];
		expect(() => importN8nWorkflow(noPosition)).toThrow(/two finite coordinates/);
	});

	it('bounds imports and rejects non-JSON values rather than coercing them away', () => {
		expect(() => importN8nWorkflow({ nodes: [], connections: {}, lost: undefined })).toThrow(
			/plain JSON workflow object/
		);
		expect(() =>
			importN8nWorkflow({ nodes: [], connections: {}, invalid: Number.POSITIVE_INFINITY })
		).toThrow(/plain JSON workflow object/);
		expect(() =>
			importN8nWorkflow({ nodes: new Array(N8N_MAX_NODES + 1).fill(null), connections: {} })
		).toThrow(/node limit/);
		expect(() => importN8nWorkflow([workflowFixture()])).toThrow(/plain JSON workflow object/);
	});

	it('treats unusual names as data instead of object prototype properties', () => {
		const workflow = {
			name: 'Names',
			nodes: [
				{
					name: '__proto__',
					type: 'community.node',
					typeVersion: 1,
					position: [0, 0],
					parameters: {}
				},
				{
					name: 'constructor',
					type: 'community.node',
					typeVersion: 1,
					position: [100, 0],
					parameters: {}
				}
			],
			connections: JSON.parse(
				'{"__proto__":{"main":[[{"node":"constructor","type":"main","index":0}]]}}'
			)
		};
		const document = importN8nWorkflow(workflow);
		expect(document.graph.edges).toHaveLength(1);
		expect(JSON.parse(exportN8nWorkflow(document))).toEqual(workflow);
	});
});
