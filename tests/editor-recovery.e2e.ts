import { expect, test, type Page } from '@playwright/test';

function fixture() {
	return {
		format: 'manef-diagram',
		schemaVersion: 1,
		title: 'Recovery fixture',
		metadata: { retained: true },
		graph: {
			schemaVersion: 1,
			nodes: [
				{
					id: 'a',
					label: 'Alpha',
					tags: [],
					inputs: [],
					outputs: [{ id: 'out', label: 'Provides' }]
				},
				{
					id: 'b',
					label: 'Beta',
					tags: [],
					inputs: [{ id: 'in', label: 'Consumes' }],
					outputs: []
				},
				{ id: 'c', label: 'Unrelated', tags: [], inputs: [], outputs: [] }
			],
			edges: [
				{
					id: 'ab',
					source: 'a',
					sourcePort: 'out',
					target: 'b',
					targetPort: 'in',
					label: 'depends on'
				}
			]
		},
		inventory: [{ id: 'reference', label: 'New reference', tags: [], kind: 'reference' }],
		ui: {
			diagramMode: 'flow',
			positions: { a: { x: 80, y: 100 }, b: { x: 400, y: 100 }, c: { x: 80, y: 300 } },
			pan: { x: 0, y: 0 },
			zoom: 1,
			seeds: ['a']
		}
	};
}
async function ready(page: Page) {
	await page.goto('/app');
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
	await page.locator('input[type="file"]').setInputFiles({
		name: 'recovery.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(fixture()))
	});
	await expect(page.getByRole('status')).toHaveText('Imported recovery.json.');
}
const source = (page: Page) =>
	page.getByRole('textbox', { name: 'Architecture graph JSON', exact: true });

test('stale JSON apply can cancel newer canvas replacement and an accepted replacement is undoable', async ({
	page
}) => {
	await ready(page);
	await page.getByRole('tab', { name: 'JSON', exact: true }).click();
	await page.getByRole('button', { name: 'Refresh', exact: true }).click();
	const oldSource = await source(page).inputValue();
	await page.getByRole('tab', { name: 'Details', exact: true }).click();
	await page.getByRole('textbox', { name: 'Label', exact: true }).fill('Newer Alpha');
	await page.getByRole('tab', { name: 'JSON', exact: true }).click();
	page.once('dialog', (dialog) => dialog.dismiss());
	await page.getByRole('button', { name: 'Apply JSON', exact: true }).click();
	await expect(source(page)).toHaveValue(oldSource);
	await page.getByRole('tab', { name: 'Details', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue(
		'Newer Alpha'
	);
	await page.getByRole('tab', { name: 'JSON', exact: true }).click();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Apply JSON', exact: true }).click();
	await page.getByRole('tab', { name: 'Details', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue('Alpha');
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue(
		'Newer Alpha'
	);
});

test('dirty source Refresh and replacement import retain drafts when cancelled', async ({
	page
}) => {
	await ready(page);
	await page.getByRole('tab', { name: 'JSON', exact: true }).click();
	const draft = '{"unfinished": ';
	await source(page).fill(draft);
	page.once('dialog', (dialog) => dialog.dismiss());
	await page.getByRole('button', { name: 'Refresh', exact: true }).click();
	await expect(source(page)).toHaveValue(draft);
	page.once('dialog', (dialog) => dialog.dismiss());
	await page.locator('input[type="file"]').setInputFiles({
		name: 'replacement.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify({ ...fixture(), title: 'Replacement' }))
	});
	await expect(page.getByRole('status')).toContainText('Import cancelled');
	await expect(source(page)).toHaveValue(draft);
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Refresh', exact: true }).click();
	await expect(source(page)).not.toHaveValue(draft);
	expect(JSON.parse(await source(page).inputValue()).metadata).toEqual({ retained: true });
});

test('an unapplied source draft remains guarded after exporting the current document', async ({
	page
}) => {
	await ready(page);
	await page.getByRole('tab', { name: 'JSON', exact: true }).click();
	const draft = 'Not applied yet';
	await source(page).fill(draft);
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export', exact: true }).click();
	await download;
	page.once('dialog', (dialog) => dialog.dismiss());
	await page.getByRole('link', { name: 'Converter guide', exact: true }).click();
	await expect(page).toHaveURL(/\/app$/);
	await expect(source(page)).toHaveValue(draft);
});

test('authored overlay isolates the covered map and returns focus to its opener', async ({
	page
}) => {
	await ready(page);
	const picker = page.getByLabel('Add view', { exact: true });
	await picker.selectOption({ label: 'Flowchart' });
	await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeFocused();
	await expect(page.locator('.world')).toHaveAttribute('inert', '');
	await expect(page.locator('.world')).toBeHidden();
	await page.keyboard.press('Tab');
	expect(await page.evaluate(() => document.activeElement?.closest('.world') === null)).toBe(true);
	await page.getByRole('button', { name: 'Map', exact: true }).click();
	await expect(picker).toBeFocused();
	await expect(page.locator('.world')).not.toHaveAttribute('inert', '');
});

test('inventory selection and authored-view deletion have stable focus destinations', async ({
	page
}) => {
	await ready(page);
	await page.getByRole('tab', { name: 'Inventory', exact: true }).click();
	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toBeFocused();
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue(
		'New reference'
	);
	const picker = page.getByLabel('Add view', { exact: true });
	await picker.selectOption({ label: 'Flowchart' });
	await page.getByRole('button', { name: 'Remove view', exact: true }).click();
	await expect(picker).toBeFocused();
	await expect(page.getByRole('status')).toContainText('Undo can restore its source');
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(page.locator('.view-list button')).toHaveCount(1);
});

test('unrelated interactive nodes keep text and focus at full opacity when tracing', async ({
	page
}) => {
	await ready(page);
	if (page.viewportSize()!.width <= 1024)
		await page.getByRole('button', { name: 'Canvas', exact: true }).click();
	await expect(page.locator('.node.dim')).toHaveCount(1);
	const opacity = await page
		.locator('.node.dim')
		.evaluate((element) => getComputedStyle(element).opacity);
	expect(opacity).toBe('1');
	await page.getByRole('button', { name: 'Graph', exact: true }).click();
	await expect(page.locator('.dot.dim')).toHaveCount(1);
	expect(
		await page.locator('.dot.dim').evaluate((element) => getComputedStyle(element).opacity)
	).toBe('1');
});
