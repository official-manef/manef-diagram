import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { documentAsJson, parseDiagramMarkdown } from './document';

type WorkflowNode = {
	id: string;
	name: string;
	type: string;
	typeVersion: number;
	parameters: { mode?: string; language?: string; jsCode?: string };
};
const workflow = JSON.parse(
	readFileSync(
		new URL('../../../examples/n8n/manef-diagram-converter.json', import.meta.url),
		'utf8'
	)
) as {
	active: boolean;
	nodes: WorkflowNode[];
	connections: Record<string, { main: { node: string; type: string; index: number }[][] }>;
	settings: { executionOrder: string };
};
const sampleCode = workflow.nodes.find((node) => node.id === 'manef-synthetic-input')!.parameters
	.jsCode!;
const converterCode = workflow.nodes.find((node) => node.id === 'manef-document-converter')!
	.parameters.jsCode!;
type Item = { json: Record<string, unknown>; pairedItem?: { item: number } };

async function execute(code: string, items: unknown[] = []): Promise<Item[]> {
	const context = createContext(
		{
			__inputJson: JSON.stringify(items),
			require: undefined,
			process: undefined,
			Bun: undefined,
			Buffer: undefined,
			fetch: undefined,
			XMLHttpRequest: undefined,
			WebSocket: undefined,
			setTimeout: undefined,
			setInterval: undefined
		},
		{ codeGeneration: { strings: false, wasm: false } }
	);
	new Script('const $input = Object.freeze({ all: () => JSON.parse(__inputJson) });').runInContext(
		context,
		{ timeout: 1000 }
	);
	const result: unknown = await new Script(`(async () => {${code}\n})()`).runInContext(context, {
		timeout: 1000
	});
	return JSON.parse(JSON.stringify(result)) as Item[];
}

describe('n8n converter workflow offline Code-node smoke', () => {
	it('regenerates exactly from the canonical source and matches the download', () => {
		const result = execFileSync('bun', ['scripts/build-n8n-converter.mjs', '--check'], {
			cwd: fileURLToPath(new URL('../../../', import.meta.url)),
			encoding: 'utf8'
		});
		expect(result).toContain('match the canonical document source');
		expect(
			readFileSync(
				new URL('../../../static/workflows/manef-diagram-converter.json', import.meta.url),
				'utf8'
			)
		).toBe(
			readFileSync(
				new URL('../../../examples/n8n/manef-diagram-converter.json', import.meta.url),
				'utf8'
			)
		);
	});

	it('has portable inactive Manual Trigger and Code v2 nodes without credentials', () => {
		expect(workflow.active).toBe(false);
		expect(workflow.settings.executionOrder).toBe('v1');
		expect(workflow.nodes.map((node) => [node.type, node.typeVersion])).toEqual([
			['n8n-nodes-base.manualTrigger', 1],
			['n8n-nodes-base.code', 2],
			['n8n-nodes-base.code', 2]
		]);
		expect(new Set(workflow.nodes.map((node) => node.id)).size).toBe(3);
		expect(new Set(workflow.nodes.map((node) => node.name)).size).toBe(3);
		expect(workflow.connections['Manual Trigger'].main[0][0].node).toBe('Synthetic example input');
		expect(workflow.connections['Synthetic example input'].main[0][0].node).toBe(
			'MANEF document converter'
		);
		expect(JSON.stringify(workflow)).not.toContain('"credentials"');
		expect(converterCode).not.toMatch(
			/\b(?:require|fetch|XMLHttpRequest|WebSocket)\s*\(|\bimport\s*(?:\(|["'{*])/
		);
	});

	it('runs the bundled canonical code JSON → Markdown → JSON without losing nested data', async () => {
		const input = await execute(sampleCode);
		const original = JSON.parse(input[0].json.source as string) as Record<string, unknown>;
		const markdown = await execute(converterCode, input);
		expect(markdown[0].json.format).toBe('md');
		expect(markdown[0].json.document).toEqual(original);
		expect(parseDiagramMarkdown(markdown[0].json.source as string)).toEqual(original);
		expect(markdown[0].pairedItem).toEqual({ item: 0 });
		const restored = await execute(converterCode, [
			{
				json: {
					format: 'md',
					source: markdown[0].json.source,
					target: 'json'
				}
			}
		]);
		expect(restored[0].json.document).toEqual(original);
		expect(JSON.parse(restored[0].json.source as string)).toEqual(original);
		expect(restored[0].json.source).toBe(
			documentAsJson(parseDiagramMarkdown(markdown[0].json.source as string))
		);
	});

	it('preserves item ordering and links each output to its own input', async () => {
		const input = await execute(sampleCode);
		const second = { json: { ...input[0].json, target: 'json' } };
		const output = await execute(converterCode, [input[0], second]);
		expect(output.map((item) => item.json.format)).toEqual(['md', 'json']);
		expect(output.map((item) => item.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
		expect(output[0].json.document).toEqual(output[1].json.document);
		expect(await execute(converterCode, [])).toEqual([]);
	});

	it.each([
		[null, /json must be an object/],
		[{}, /format must be json or md/],
		[{ format: 'json', source: {}, target: 'md' }, /source must be a string/],
		[{ format: 'json', source: '{}', target: 'xml' }, /target must be json or md/],
		[{ format: 'json', source: '{broken', target: 'md' }, /Item 0:/],
		[{ format: 'json', source: '{}', target: 'md' }, /not a MANEF diagram/],
		[
			{ format: 'md', source: 'flowchart LR\n A-->B', target: 'json' },
			/exactly one manef-diagram-json/
		]
	])('rejects invalid input without substituting sample data: %j', async (json, error) => {
		await expect(execute(converterCode, [{ json }])).rejects.toThrow(error);
	});

	it('fails a batch explicitly at the invalid item', async () => {
		const input = await execute(sampleCode);
		await expect(execute(converterCode, [input[0], { json: {} }])).rejects.toThrow(
			'Item 1: format must be json or md.'
		);
	});
});
