import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

function fixture(seeds = ['source']) {
	return {
		format: 'manef-diagram',
		schemaVersion: 1,
		title: 'Interaction fixture',
		graph: {
			schemaVersion: 1,
			nodes: [
				{
					id: 'source',
					label: 'Source',
					tags: [],
					inputs: [],
					outputs: [{ id: 'out', label: 'Output' }],
					child: {
						schemaVersion: 1,
						nodes: [{ id: 'nested', label: 'Nested', tags: [], inputs: [], outputs: [] }],
						edges: []
					}
				},
				{
					id: 'target',
					label: 'Target',
					tags: [],
					inputs: [{ id: 'in', label: 'Input' }],
					outputs: []
				},
				{
					id: 'other',
					label: 'Other',
					tags: [],
					inputs: [{ id: 'in', label: 'Input' }],
					outputs: []
				}
			],
			edges: [
				{
					id: 'connection',
					source: 'source',
					sourcePort: 'out',
					target: 'target',
					targetPort: 'in'
				}
			]
		},
		ui: { seeds, diagramMode: 'flow' }
	};
}

async function importFixture(page: Page, seeds?: string[]) {
	const document = fixture(seeds);
	await page.locator('input[type="file"]').setInputFiles({
		name: 'interactions.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(document))
	});
	await expect(page.getByRole('status')).toHaveText('Imported interactions.json.');
	return document;
}

async function exportDocument(page: Page) {
	await page.getByLabel('Export format', { exact: true }).selectOption('json');
	const pending = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export', exact: true }).click();
	const download = await pending;
	const path = await download.path();
	expect(path).not.toBeNull();
	return JSON.parse(await readFile(path!, 'utf8')) as ReturnType<typeof fixture>;
}

async function selectNode(page: Page, label: string) {
	const card = page.getByRole('button', { name: label, exact: true });
	await card.click();
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue(label);
}

test.beforeEach(async ({ page }) => {
	await page.goto('/app');
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
});

test('node removal cancels safely, cascades connections and components, and supports repeated edits', async ({
	page
}) => {
	const original = await importFixture(page);
	page.once('dialog', (dialog) => dialog.dismiss());
	await page.getByRole('button', { name: 'Remove node', exact: true }).click();
	expect((await exportDocument(page)).graph).toEqual(original.graph);
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue('Source');
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Remove node', exact: true }).click();
	let current = await exportDocument(page);
	expect(current.graph.nodes.map((node) => node.id)).toEqual(['target', 'other']);
	expect(current.graph.edges).toEqual([]);
	expect(current.ui.seeds).toEqual([]);
	await selectNode(page, 'Target');
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('tab', { name: 'Details', exact: true }).focus();
	await page.keyboard.press('Delete');
	current = await exportDocument(page);
	expect(current.graph.nodes.map((node) => node.id)).toEqual(['other']);
	for (let iteration = 0; iteration < 2; iteration += 1) {
		await page.getByRole('button', { name: '+ Node', exact: true }).click();
		page.once('dialog', (dialog) => dialog.accept());
		await page.getByRole('button', { name: 'Remove node', exact: true }).click();
		expect((await exportDocument(page)).graph.nodes.map((node) => node.id)).toEqual(['other']);
	}
});

test('removing multiple selected nodes preserves cancellation and removes each selected subtree', async ({
	page
}) => {
	const original = await importFixture(page, ['source', 'target']);
	page.once('dialog', (dialog) => dialog.dismiss());
	await page.getByRole('button', { name: 'Remove selected nodes', exact: true }).click();
	expect((await exportDocument(page)).graph).toEqual(original.graph);
	await expect(
		page.getByRole('button', { name: 'Remove selected nodes', exact: true })
	).toBeVisible();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Remove selected nodes', exact: true }).click();
	const current = await exportDocument(page);
	expect(current.graph.nodes.map((node) => node.id)).toEqual(['other']);
	expect(current.graph.edges).toEqual([]);
	expect(current.ui.seeds).toEqual([]);
});

test('removing an armed output clears the pending connection and a fresh output still connects', async ({
	page
}) => {
	await importFixture(page);
	const mobileOutput = page.getByRole('button', { name: 'Use output', exact: true });
	if (await mobileOutput.isVisible()) await mobileOutput.click();
	else
		await page
			.locator('.node')
			.filter({ has: page.getByRole('button', { name: 'Source', exact: true }) })
			.locator('.port.out')
			.click();
	page.once('dialog', (dialog) => dialog.dismiss());
	await page.getByRole('button', { name: 'Remove output port: Output', exact: true }).click();
	expect((await exportDocument(page)).graph.edges).toHaveLength(1);
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Remove output port: Output', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Cancel connection', exact: true })).toHaveCount(0);
	let current = await exportDocument(page);
	expect(current.graph.nodes.find((node) => node.id === 'source')?.outputs).toEqual([]);
	expect(current.graph.edges).toEqual([]);
	await page.getByRole('button', { name: 'Add output port', exact: true }).click();
	if (await mobileOutput.isVisible()) {
		await mobileOutput.click();
		await selectNode(page, 'Other');
		await page.getByRole('button', { name: 'Connect', exact: true }).click();
	} else {
		await page
			.locator('.node')
			.filter({ has: page.getByRole('button', { name: 'Source', exact: true }) })
			.locator('.port.out')
			.click();
		await page
			.locator('.node')
			.filter({ has: page.getByRole('button', { name: 'Other', exact: true }) })
			.locator('.port.in')
			.click();
	}
	current = await exportDocument(page);
	expect(current.graph.edges).toHaveLength(1);
	expect(current.graph.edges[0]).toMatchObject({
		source: 'source',
		target: 'other',
		sourcePort: 'out-1',
		targetPort: 'in'
	});
});

test('adding a node closes the previous node view and the new node can open its own view', async ({
	page
}) => {
	await importFixture(page);
	await page.getByLabel('Add view', { exact: true }).selectOption('flowchart');
	await expect(page.locator('.view-canvas svg')).toBeVisible();
	await page.getByRole('button', { name: '+ Node', exact: true }).click();
	await expect(page.locator('.mermaid-view')).toHaveCount(0);
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue('New node');
	await page.getByLabel('Add view', { exact: true }).selectOption('sequence');
	await expect(page.locator('.view-canvas svg')).toBeVisible();
	await expect(page.getByLabel('Diagram source', { exact: true })).toHaveValue(/sequenceDiagram/);
	const current = await exportDocument(page);
	expect(current.graph.nodes.find((node) => node.id === 'source')).toHaveProperty('views', [
		expect.objectContaining({ kind: 'flowchart' })
	]);
	expect(current.graph.nodes.find((node) => node.label === 'New node')).toHaveProperty('views', [
		expect.objectContaining({ kind: 'sequence' })
	]);
});

test('invalid Mermaid views recover repeatedly without leaving error diagrams outside the editor', async ({
	page
}) => {
	await importFixture(page);
	await page.getByLabel('Add view', { exact: true }).selectOption('flowchart');
	await expect(page.locator('.view-canvas svg')).toBeVisible();
	const source = page.getByLabel('Diagram source', { exact: true });
	const valid = await source.inputValue();
	for (let cycle = 0; cycle < 2; cycle += 1) {
		await source.fill('```mermaid\ninvalid diagram syntax\n```');
		await expect(page.locator('.mermaid-view .help')).toBeVisible();
		await expect(page.locator('body > div[id^="dmmd-"]')).toHaveCount(0);
		await source.fill(valid);
		await expect(page.locator('.view-canvas svg')).toBeVisible();
		await expect(page.locator('.mermaid-view .help')).toHaveCount(0);
		await expect(page.locator('body > div[id^="dmmd-"]')).toHaveCount(0);
	}
	await page.getByRole('button', { name: 'Map', exact: true }).click();
	await expect(page.locator('body > div[id^="dmmd-"]')).toHaveCount(0);
});

test('inspector tabs use arrow keys, Home and End with one tab stop and a labelled panel', async ({
	page
}) => {
	const details = page.getByRole('tab', { name: 'Details', exact: true });
	const inventory = page.getByRole('tab', { name: 'Inventory', exact: true });
	const json = page.getByRole('tab', { name: 'JSON', exact: true });
	await details.focus();
	for (const [key, tab] of [
		['ArrowRight', inventory],
		['End', json],
		['ArrowRight', details],
		['ArrowLeft', json],
		['Home', details]
	] as const) {
		await page.keyboard.press(key);
		await expect(tab).toBeFocused();
		await expect(tab).toHaveAttribute('aria-selected', 'true');
		await expect(tab).toHaveAttribute('tabindex', '0');
		await expect(
			page.getByRole('tablist', { name: 'Inspector', exact: true }).locator('[tabindex="0"]')
		).toHaveCount(1);
		const panel = page.getByRole('tabpanel');
		await expect(panel).toBeVisible();
		await expect(panel).toHaveAttribute('id', (await tab.getAttribute('aria-controls'))!);
		await expect(panel).toHaveAttribute('aria-labelledby', (await tab.getAttribute('id'))!);
	}
});
