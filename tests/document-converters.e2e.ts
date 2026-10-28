import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

function fixtureDocument() {
	const positions = { source: { x: 120, y: 80 }, target: { x: 540, y: 100 } };
	return {
		format: 'manef-diagram',
		schemaVersion: 1,
		title: 'Dokumen utuh 日本語 🧭',
		metadata: { unknownRoot: [false, null, { language: 'id' }] },
		nodes: { providerMetadata: true },
		edges: ['root extension, not graph edges'],
		graph: {
			schemaVersion: 1,
			unknownGraph: { ordered: ['first', 'second'] },
			nodes: [
				{
					id: 'source',
					label: 'Fixture source',
					tags: ['fixture'],
					inputs: [],
					outputs: [{ id: 'out', label: 'Output', customPort: { preserved: true } }],
					unknownNode: { text: 'Prosa dan metadata tetap utuh.' },
					views: [
						{
							id: 'fixture-view',
							kind: 'flowchart',
							title: 'Flow fixture',
							format: 'md',
							source:
								'# Diagram\n\nProsa sebelum.\n\n```json\n{"example": true}\n```\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\nProsa sesudah 日本語.\n',
							unknownView: { arbitrary: ['keep', 2, false, null] }
						}
					],
					child: {
						schemaVersion: 1,
						unknownChild: { keep: true },
						nodes: [{ id: 'nested', label: 'Nested fixture', tags: [], inputs: [], outputs: [] }],
						edges: []
					}
				},
				{
					id: 'target',
					label: 'Fixture target',
					tags: ['fixture'],
					inputs: [{ id: 'in', label: 'Input' }],
					outputs: []
				}
			],
			edges: [
				{
					id: 'fixture-edge',
					source: 'source',
					sourcePort: 'out',
					target: 'target',
					targetPort: 'in',
					label: 'Preserved connection',
					unknownEdge: { priority: 3 }
				}
			]
		},
		inventory: [
			{
				id: 'reference-fixture',
				label: 'Imported inventory fixture',
				tags: ['fixture'],
				kind: 'reference',
				unknownInventory: { keep: true }
			}
		],
		ui: {
			themePreset: 'composio-dark',
			diagramMode: 'flow',
			traceMode: 'component',
			focusMode: false,
			query: '',
			tags: [],
			seeds: ['source', 'target'],
			open: [],
			pan: { x: 19, y: -35 },
			zoom: 0.85,
			positions,
			layouts: { '[]': positions, '["source"]': { nested: { x: 28, y: 64 } } },
			unknownUi: { snap: true, grid: 'custom' }
		}
	};
}

async function importFile(page: Page, text: string, name = 'diagram.json') {
	await page.locator('input[type="file"]').setInputFiles({
		name,
		mimeType: name.endsWith('.md') ? 'text/markdown' : 'application/json',
		buffer: Buffer.from(text)
	});
	await expect(page.getByRole('status')).toContainText(`Imported ${name}.`);
}

async function exportText(page: Page, format: 'json' | 'md' | 'n8n' | 'n8n-inactive') {
	await page.getByLabel('Export format', { exact: true }).selectOption(format);
	const waiting = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export', exact: true }).click();
	const download = await waiting;
	expect(download.suggestedFilename()).toMatch(format === 'md' ? /\.md$/ : /\.json$/);
	const path = await download.path();
	expect(path).not.toBeNull();
	return readFile(path!, 'utf8');
}

test.beforeEach(async ({ page }) => {
	await page.goto('/app');
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
});

test('complete document JSON and Markdown retain unknown data, inventory, nested views and camera', async ({
	page
}) => {
	const original = fixtureDocument();
	await importFile(page, JSON.stringify(original));
	await expect(page.getByLabel('Color theme', { exact: true })).toHaveValue('composio-dark');
	expect(JSON.parse(await exportText(page, 'json'))).toEqual(original);
	await page.getByRole('tab', { name: 'Inventory', exact: true }).click();
	await expect(page.getByText('Imported inventory fixture', { exact: true })).toBeVisible();
	const markdown = await exportText(page, 'md');
	expect(markdown).toContain('manef-diagram-json');
	expect(markdown).toContain('flowchart LR');
	await importFile(page, markdown, 'restored.md');
	expect(JSON.parse(await exportText(page, 'json'))).toEqual(original);
});

test('future document versions leave the current graph and pasted input intact', async ({
	page
}) => {
	await importFile(page, JSON.stringify(fixtureDocument()));
	const before = JSON.parse(await exportText(page, 'json')) as unknown;
	await page.getByRole('tab', { name: 'JSON', exact: true }).click();
	await page.getByLabel('Input format', { exact: true }).selectOption('json');
	const unsupported = JSON.stringify({ ...fixtureDocument(), schemaVersion: 2 }, null, 2);
	const input = page.getByRole('textbox', { name: 'Architecture graph JSON', exact: true });
	await input.fill(unsupported);
	await page.getByRole('button', { name: 'Apply JSON', exact: true }).click();
	await expect(
		page.getByText('Unsupported diagram document version.', { exact: true })
	).toBeVisible();
	await expect(input).toHaveValue(unsupported);
	expect(JSON.parse(await exportText(page, 'json'))).toEqual(before);
	await expect(input).toHaveValue(unsupported);

	await page.locator('input[type="file"]').setInputFiles({
		name: 'future.json',
		mimeType: 'application/json',
		buffer: Buffer.from(unsupported)
	});
	await expect(page.getByRole('status')).toHaveText('Unsupported diagram document version.');
	await expect(input).toHaveValue(unsupported);
	expect(JSON.parse(await exportText(page, 'json'))).toEqual(before);
});

test('partial camera settings and layout-only positions survive import with multiple selections', async ({
	page
}) => {
	for (const retained of ['pan', 'zoom'] as const) {
		const original = fixtureDocument();
		const partial = original as typeof original & { ui: Record<string, unknown> };
		Reflect.deleteProperty(partial.ui, retained === 'pan' ? 'zoom' : 'pan');
		Reflect.deleteProperty(partial.ui, 'positions');
		await importFile(page, JSON.stringify(partial), `partial-${retained}.json`);
		const exported = JSON.parse(await exportText(page, 'json')) as typeof original;
		expect(exported.graph).toEqual(original.graph);
		expect(exported.ui[retained]).toEqual(partial.ui[retained]);
		expect(exported.ui.seeds).toEqual(['source', 'target']);
		expect(exported.ui.positions).toEqual(original.ui.layouts['[]']);
		expect(exported.ui.layouts).toEqual(original.ui.layouts);
		expect(exported.ui.unknownUi).toEqual(original.ui.unknownUi);
	}
});

test('the editor applies canonical Markdown and rejects an ambiguous payload without replacing data', async ({
	page
}) => {
	await importFile(page, JSON.stringify(fixtureDocument()));
	const original = JSON.parse(await exportText(page, 'json')) as unknown;
	const markdown = await exportText(page, 'md');
	await page.getByRole('tab', { name: 'JSON', exact: true }).click();
	await page.getByLabel('Input format', { exact: true }).selectOption('md');
	const input = page.getByRole('textbox', { name: 'Architecture graph JSON', exact: true });
	await input.fill(markdown);
	await page.getByRole('button', { name: 'Apply Markdown', exact: true }).click();
	expect(JSON.parse(await exportText(page, 'json'))).toEqual(original);
	const ambiguous = markdown + '\n' + markdown;
	await input.fill(ambiguous);
	await page.getByRole('button', { name: 'Apply Markdown', exact: true }).click();
	await expect(
		page.getByText(/Markdown must contain exactly one manef-diagram-json block/)
	).toBeVisible();
	await expect(input).toHaveValue(ambiguous);
	expect(JSON.parse(await exportText(page, 'json'))).toEqual(original);
});

test('n8n preserve export retains workflow semantics and inactive export is explicit', async ({
	page
}) => {
	const workflow = {
		id: 'fixture-workflow',
		name: 'Offline n8n fixture 日本語',
		active: true,
		activeVersionId: 'fixture-published-version',
		settings: { executionOrder: 'v1', saveDataErrorExecution: 'all' },
		unknownWorkflow: { preserve: [false, null, { value: 3 }] },
		nodes: [
			{
				id: 'manual',
				name: 'Start fixture',
				type: 'n8n-nodes-base.manualTrigger',
				typeVersion: 1,
				position: [100, 240],
				parameters: {},
				unknownNode: { retain: true }
			},
			{
				id: 'code',
				name: 'Keep fixture',
				type: 'n8n-nodes-base.code',
				typeVersion: 2,
				position: [400, 240],
				parameters: { jsCode: 'return $input.all();' },
				credentials: { fixtureOnly: { id: 'offline-reference', name: 'Offline reference' } },
				notes: 'Credential reference is a local fixture, never a secret.'
			}
		],
		connections: {
			'Start fixture': { main: [[{ node: 'Keep fixture', type: 'main', index: 0 }], null, []] }
		},
		pinData: { 'Start fixture': [{ json: { fixture: true } }] },
		tags: [{ id: 'fixture-tag', name: 'offline' }]
	};
	await importFile(page, JSON.stringify(workflow), 'workflow.json');
	expect(JSON.parse(await exportText(page, 'n8n'))).toEqual(workflow);
	const markdown = await exportText(page, 'md');
	await importFile(page, markdown, 'workflow.md');
	expect(JSON.parse(await exportText(page, 'n8n'))).toEqual(workflow);
	expect(JSON.parse(await exportText(page, 'n8n-inactive'))).toEqual({
		...workflow,
		active: false,
		activeVersionId: null
	});
});
