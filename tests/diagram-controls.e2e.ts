import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

function fixture(seeds: string[] = []) {
	return {
		format: 'manef-diagram',
		schemaVersion: 1,
		title: 'Controls fixture',
		metadata: { keep: true },
		graph: {
			schemaVersion: 1,
			nodes: [
				{
					id: 'a',
					label: 'Alpha',
					level: 0,
					tags: [],
					inputs: [],
					outputs: [{ id: 'out', label: 'Provides' }]
				},
				{
					id: 'b',
					label: 'Beta',
					level: 1,
					tags: [],
					inputs: [{ id: 'in', label: 'Consumes' }],
					outputs: []
				}
			],
			edges: [{ id: 'ab', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' }]
		},
		ui: {
			diagramMode: 'flow',
			seeds,
			pan: { x: 0, y: 0 },
			zoom: 1,
			positions: { a: { x: 80, y: 120 }, b: { x: 430, y: 120 } }
		}
	};
}
async function ready(page: Page, seeds: string[] = []) {
	await page.goto('/app');
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
	if (page.viewportSize()!.width <= 1024)
		await page.getByRole('button', { name: 'Canvas', exact: true }).click();
	await page.locator('input[type="file"]').setInputFiles({
		name: 'controls.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(fixture(seeds)))
	});
	await expect(page.getByRole('status')).toHaveText('Imported controls.json.');
}
async function exported(page: Page) {
	const waiting = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export', exact: true }).click();
	const download = await waiting;
	return JSON.parse(await readFile((await download.path())!, 'utf8')) as ReturnType<
		typeof fixture
	> & { ui: { flowDirection?: string }; graph: { nodes: { views?: unknown[] }[] } };
}

test('one canvas click and navigator selection do not change zoom; the explicit zoom tool does', async ({
	page
}) => {
	await ready(page);
	const before = await page.locator('.world').getAttribute('style');
	await page.locator('.node-select').first().click();
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue('Alpha');
	await expect(page.locator('.world')).toHaveAttribute('style', before!);
	const nav = page.locator('.service-navigator');
	if (!(await nav.evaluate((element) => (element as HTMLDetailsElement).open)))
		await nav.locator('summary').click();
	await nav.getByRole('button', { name: 'Beta', exact: true }).click();
	await expect(page.locator('.world')).toHaveAttribute('style', before!);
	await page.getByRole('button', { name: 'Zoom selection', exact: true }).click();
	await expect(page.locator('.world')).not.toHaveAttribute('style', before!);
});

test('upper-right arrows change Flow direction and preserve it in export, undo and share', async ({
	page
}) => {
	await ready(page, ['a']);
	for (const [label, direction] of [
		['Flow top to bottom', 'TB'],
		['Flow bottom to top', 'BT'],
		['Flow right to left', 'RL'],
		['Flow left to right', 'LR']
	]) {
		await page.getByRole('button', { name: label, exact: true }).click();
		await expect(page.locator('main.workspace')).toHaveAttribute('data-flow-direction', direction);
		await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		const layout = await page.locator('.node').evaluateAll((nodes) =>
			nodes.map((node) => ({
				id: node.getAttribute('data-node-id'),
				x: parseFloat((node as HTMLElement).style.left),
				y: parseFloat((node as HTMLElement).style.top)
			}))
		);
		if (direction === 'TB') expect(layout[0].y).toBeLessThan(layout[1].y);
		if (direction === 'BT') expect(layout[0].y).toBeGreaterThan(layout[1].y);
		if (direction === 'RL') expect(layout[0].x).toBeGreaterThan(layout[1].x);
		if (direction === 'LR') expect(layout[0].x).toBeLessThan(layout[1].x);
	}
	await page.getByRole('button', { name: 'Flow top to bottom', exact: true }).click();
	const document = await exported(page);
	expect(document.ui.flowDirection).toBe('TB');
	expect(document.graph).toEqual(fixture().graph);
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(page.locator('main.workspace')).toHaveAttribute('data-flow-direction', 'LR');
	await page.getByRole('button', { name: 'Redo', exact: true }).click();
	await expect(page.locator('main.workspace')).toHaveAttribute('data-flow-direction', 'TB');
	await page.getByRole('button', { name: 'Share view', exact: true }).click();
	expect(new URL(page.url()).searchParams.get('direction')).toBe('TB');
	// Export clears document dirty state before explicit reload of the portable view.
	await exported(page);
	await page.reload();
	await expect(page.locator('main.workspace')).toHaveAttribute('data-flow-direction', 'TB');
});

test('keyboard preview works without a selected node and does not author views', async ({
	page
}) => {
	await ready(page);
	const before = (await exported(page)).graph;
	const trigger = page.getByRole('button', { name: 'Diagram type', exact: true });
	await trigger.focus();
	await trigger.press('ArrowDown');
	const list = page.getByRole('listbox', { name: 'Diagram types', exact: true });
	await expect(list).toBeFocused();
	await expect(page.locator('.view-canvas')).toHaveAttribute('data-view-kind', 'flowchart');
	await list.press('ArrowDown');
	await expect(list).toBeFocused();
	await expect(page.locator('.view-canvas')).toHaveAttribute('data-view-kind', 'sequence');
	await list.press('ArrowUp');
	await expect(page.locator('.view-canvas')).toHaveAttribute('data-view-kind', 'flowchart');
	await expect(
		page.getByRole('button', { name: 'Add to selected node', exact: true })
	).toBeDisabled();
	await list.press('Escape');
	await expect(trigger).toBeFocused();
	expect((await exported(page)).graph).toEqual(before);
});

test('changing preview repeatedly adds only the explicitly committed type', async ({ page }) => {
	await ready(page, ['a']);
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	const list = page.getByRole('listbox', { name: 'Diagram types', exact: true });
	await list.press('ArrowDown');
	await expect(page.locator('.view-canvas')).toHaveAttribute('data-view-kind', 'sequence');
	await list.press('ArrowDown');
	await expect(page.locator('.view-canvas')).toHaveAttribute('data-view-kind', 'state');
	await list.press('Escape');
	await page.getByRole('button', { name: 'Add to selected node', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Diagram source', exact: true })).toBeVisible();
	const document = await exported(page);
	expect(document.graph.nodes[0].views).toHaveLength(1);
	expect(document.graph.nodes[0].views![0]).toMatchObject({ kind: 'state' });
	expect(document.graph.nodes[1].views).toBeUndefined();
});

test('Flow sockets and routes remain aligned when cards change direction', async ({ page }) => {
	await ready(page);
	for (const label of [
		'Flow right to left',
		'Flow top to bottom',
		'Flow bottom to top',
		'Flow left to right'
	]) {
		await page.getByRole('button', { name: label, exact: true }).click();
		const error = await page.evaluate(() => {
			const viewport = document.querySelector('.viewport')!.getBoundingClientRect();
			const world = new DOMMatrix(getComputedStyle(document.querySelector('.world')!).transform);
			const path = document.querySelector('.edge-hit') as SVGPathElement;
			return [
				['.port.out .socket', path.getPointAtLength(0)],
				['.port.in .socket', path.getPointAtLength(path.getTotalLength())]
			].map(([selector, point]) => {
				const rect = document.querySelector(selector as string)!.getBoundingClientRect();
				const p = point as DOMPoint;
				return Math.hypot(
					rect.x + rect.width / 2 - (viewport.x + world.e + p.x * world.a),
					rect.y + rect.height / 2 - (viewport.y + world.f + p.y * world.a)
				);
			});
		});
		expect(Math.max(...error)).toBeLessThan(3);
	}
});

test('diagram listbox keeps accessible focus and selected-option semantics', async ({ page }) => {
	await ready(page);
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	const list = page.getByRole('listbox', { name: 'Diagram types', exact: true });
	await list.press('ArrowDown');
	await expect(list).toHaveAttribute('aria-activedescendant', 'diagram-kind-sequence');
	await expect(page.getByRole('option', { name: 'Sequence', exact: true })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(page.getByRole('option', { name: 'Flowchart', exact: true })).toHaveAttribute(
		'aria-selected',
		'false'
	);
	await expect(page.locator('.view-canvas')).toHaveAttribute('data-view-kind', 'sequence');
	const result = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
		.analyze();
	expect(result.violations).toEqual([]);
	await list.press('Tab');
	await expect(list).toBeHidden();
	await expect(page.getByLabel('Color theme', { exact: true })).toBeFocused();
});

test('all bundled diagram types can be compared with arrows without creating saved views', async ({
	page
}) => {
	test.setTimeout(90_000);
	await ready(page);
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	const list = page.getByRole('listbox', { name: 'Diagram types', exact: true });
	const kinds = await list
		.getByRole('option')
		.evaluateAll((options) => options.map((option) => option.id.replace('diagram-kind-', '')));
	expect(kinds).toHaveLength(24);
	for (let index = 0; index < kinds.length; index++) {
		if (index) await list.press('ArrowDown');
		await expect(page.locator('.view-canvas')).toHaveAttribute('data-view-kind', kinds[index]);
		await expect(list).toBeFocused();
	}
	await list.press('Escape');
	expect((await exported(page)).graph).toEqual(fixture().graph);
});

test('changing selection with Focus enabled does not automatically refit the camera', async ({
	page
}) => {
	await ready(page, ['a']);
	await page.getByRole('button', { name: 'Focus: Off', exact: true }).click();
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	);
	const before = await page.locator('.world').getAttribute('style');
	const navigator = page.locator('.service-navigator');
	if (!(await navigator.evaluate((element) => (element as HTMLDetailsElement).open)))
		await navigator.locator('summary').click();
	await navigator.getByRole('button', { name: 'Beta', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue('Beta');
	await expect(page.locator('.world')).toHaveAttribute('style', before!);
});

test('active diagram chooser does not forward delete or undo to the background document', async ({
	page
}) => {
	await ready(page);
	await page.locator('.edge-strip button').first().click();
	await expect(
		page.getByRole('heading', { name: 'Connection details', exact: true })
	).toBeVisible();
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	const list = page.getByRole('listbox', { name: 'Diagram types', exact: true });
	const dialogs: string[] = [];
	page.on('dialog', (dialog) => {
		dialogs.push(dialog.message());
		return dialog.dismiss();
	});
	for (const key of ['Delete', 'Backspace', 'Control+z', 'Control+Shift+z', 'Meta+z'])
		await list.press(key);
	await expect(list).toBeFocused();
	await list.press('Escape');
	expect((await exported(page)).graph).toEqual(fixture().graph);
	expect(dialogs).toEqual([]);
});

test('selection during a Flow transition cancels its pending automatic camera fit', async ({
	page
}) => {
	await ready(page);
	await page.getByRole('button', { name: 'Graph', exact: true }).click();
	await page.getByRole('button', { name: 'Flow', exact: true }).click();
	await page.locator('.node-select').first().focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue('Alpha');
	await expect(page.locator('.node').first()).toHaveCSS('left', '24px');
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	);
	const zoom = await page
		.locator('.world')
		.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a);
	expect(zoom).toBe(1);
});

test('every diagram kind compiles from the demo graph and renders a preview', async ({ page }) => {
	await page.goto('/app');
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	const list = page.getByRole('listbox', { name: 'Diagram types' });
	const options = list.getByRole('option');
	const count = await options.count();
	expect(count).toBeGreaterThanOrEqual(24);
	for (let index = 0; index < count; index += 1) {
		const label = await options.nth(index).textContent();
		await options.nth(index).click();
		await expect(page.locator('.view-canvas svg').first()).toBeVisible({ timeout: 20_000 });
		await expect(page.locator('.mermaid-view .help')).toHaveCount(0);
		await expect(page.locator('.view-bar strong')).not.toHaveText('');
		// Returning to the list keeps the picker open for the next kind.
		await list.focus();
		expect(label, `${label} preview rendered`).toBeTruthy();
	}
});
