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
	await expect(page.getByLabel('Search graph', { exact: true })).toBeFocused();
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
	expect(kinds).toHaveLength(33);
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
		await expect(page.locator('.view-canvas')).toHaveAttribute('data-renderer', 'pele');
		await expect(page.locator('.mermaid-view .help')).toHaveCount(0);
		await expect(page.locator('.view-bar strong')).not.toHaveText('');
		// Returning to the list keeps the picker open for the next kind.
		await list.focus();
		expect(label, `${label} preview rendered`).toBeTruthy();
	}
});

test('diagram type chooser stays in the explorer without covering the diagram', async ({
	page
}) => {
	await ready(page);
	const trigger = page.getByRole('button', { name: 'Diagram type', exact: true });
	await expect(
		page.locator('#diagram-explorer').getByRole('button', { name: 'Diagram type', exact: true })
	).toBeVisible();
	await expect(
		page.locator('.topbar').getByRole('button', { name: 'Diagram type', exact: true })
	).toHaveCount(0);
	await trigger.click();
	const list = page.getByRole('listbox', { name: 'Diagram types', exact: true });
	await expect(list).toBeVisible();
	await expect(page.locator('.view-canvas')).toHaveAttribute('data-view-kind', 'flowchart');
	const geometry = await page.evaluate(() => {
		const list = document.querySelector('.diagram-kind-list')!.getBoundingClientRect();
		const canvas = document.querySelector('.viewport')!.getBoundingClientRect();
		return {
			listRight: list.right,
			listBottom: list.bottom,
			canvasLeft: canvas.left,
			canvasTop: canvas.top,
			scrollWidth: document.documentElement.scrollWidth,
			viewportWidth: window.innerWidth
		};
	});
	expect(
		geometry.listRight <= geometry.canvasLeft + 1 || geometry.listBottom <= geometry.canvasTop + 1
	).toBe(true);
	expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
	await list.press('Escape');
	await expect(trigger).toBeFocused();
});

test('diagram renderer loads on demand when the picker opens', async ({ page }) => {
	const manifest = JSON.parse(
		await readFile('.svelte-kit/output/client/.vite/manifest.json', 'utf8')
	);
	const entry = manifest['slices/architecture-inventory/lib/diagram-render.ts'];
	expect(entry?.isDynamicEntry).toBe(true);
	const requests: string[] = [];
	page.on('request', (request) => requests.push(new URL(request.url()).pathname));
	await ready(page);
	expect(requests.some((path) => path.endsWith(entry.file))).toBe(false);
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	await expect(page.locator('.view-canvas')).toHaveAttribute('data-view-kind', 'flowchart');
	expect(requests.some((path) => path.endsWith(entry.file))).toBe(true);
});

test('diagram preview does not execute or load markup from imported node labels', async ({
	page
}) => {
	await page.addInitScript(() => {
		(window as Window & { __diagramXss?: boolean }).__diagramXss = false;
	});
	const externalRequests: string[] = [];
	await page.route('https://example.invalid/**', async (route) => {
		externalRequests.push(route.request().url());
		await route.abort();
	});
	const malicious = fixture();
	malicious.graph.nodes[0].label =
		'<img src=https://example.invalid/x onerror=window.__diagramXss=true>';
	await page.goto('/app');
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
	await page.locator('input[type="file"]').setInputFiles({
		name: 'unsafe.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(malicious))
	});
	await expect(page.getByRole('status')).toHaveText('Imported unsafe.json.');
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	await expect(page.locator('.view-canvas')).toHaveAttribute('data-view-kind', 'flowchart');
	await expect(
		page.locator(
			'.view-canvas script, .view-canvas img, .view-canvas [onerror], .view-canvas [onload]'
		)
	).toHaveCount(0);
	expect(externalRequests).toEqual([]);
	expect(
		await page.evaluate(() => (window as Window & { __diagramXss?: boolean }).__diagramXss)
	).toBe(false);
});

test('diagram type picker stays in flow at tablet width', async ({ page }) => {
	await page.setViewportSize({ width: 768, height: 1024 });
	await ready(page);
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	await expect(page.locator('.view-canvas')).toHaveAttribute('data-view-kind', 'flowchart');
	const bounds = await page.evaluate(() => {
		const list = document.querySelector('.diagram-kind-list')!.getBoundingClientRect();
		const viewport = document.querySelector('.viewport')!.getBoundingClientRect();
		return {
			listBottom: list.bottom,
			viewportTop: viewport.top,
			scrollWidth: document.documentElement.scrollWidth,
			width: innerWidth
		};
	});
	expect(bounds.listBottom).toBeLessThanOrEqual(bounds.viewportTop + 1);
	expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width + 1);
});

test('authored diagram source does not inject executable markup', async ({ page }) => {
	await page.addInitScript(() => {
		(window as Window & { __diagramXss?: boolean }).__diagramXss = false;
	});
	const externalRequests: string[] = [];
	await page.route('https://example.invalid/**', async (route) => {
		externalRequests.push(route.request().url());
		await route.abort();
	});
	await ready(page, ['a']);
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	await page.getByRole('listbox', { name: 'Diagram types', exact: true }).press('Escape');
	await page.getByRole('button', { name: 'Add to selected node', exact: true }).click();
	await page
		.getByLabel('Diagram source', { exact: true })
		.fill(
			'```mermaid\nflowchart LR\nA["<img src=https://example.invalid/x onerror=window.__diagramXss=true>"]\n```'
		);
	await expect(page.locator('.view-canvas')).toHaveAttribute('aria-busy', 'false');
	await expect(
		page.locator(
			'.view-canvas script, .view-canvas img, .view-canvas [onerror], .view-canvas [onload]'
		)
	).toHaveCount(0);
	expect(externalRequests).toEqual([]);
	expect(
		await page.evaluate(() => (window as Window & { __diagramXss?: boolean }).__diagramXss)
	).toBe(false);
});

test('diagram type list supports first-letter keyboard navigation', async ({ page }) => {
	await ready(page);
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	const list = page.getByRole('listbox', { name: 'Diagram types', exact: true });
	await expect(list).toHaveAccessibleDescription(
		'Use arrow keys or type the first letter to find a type.'
	);
	await list.press('s');
	await expect(list).toHaveAttribute('aria-activedescendant', 'diagram-kind-sequence');
	await expect(page.locator('.view-canvas')).toHaveAttribute('data-view-kind', 'sequence');
	await list.press('s');
	await expect(list).toHaveAttribute('aria-activedescendant', 'diagram-kind-state');
	await expect(list).toBeFocused();
});

test('large graph preview warns when compiled diagram may omit items', async ({ page }) => {
	await page.goto('/app');
	const graph = {
		schemaVersion: 1,
		nodes: Array.from({ length: 81 }, (_, i) => ({
			id: `n${i}`,
			label: `Node ${i}`,
			tags: [],
			inputs: [],
			outputs: []
		})),
		edges: []
	};
	await page.locator('input[type="file"]').setInputFiles({
		name: 'large.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify({ format: 'manef-diagram', schemaVersion: 1, title: 'Large', graph })
		)
	});
	await expect(page.getByRole('status')).toHaveText('Imported large.json.');
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	await expect(
		page.getByText(/Large diagram preview is limited to the first 80 nodes/)
	).toBeVisible();
	await expect(page.getByText(/The original graph is unchanged/)).toBeVisible();
});

test('oversized compiled preview reports an error without replacing the graph', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/app');
	const graph = {
		schemaVersion: 1,
		nodes: Array.from({ length: 80 }, (_, i) => ({
			id: `n${i}`,
			label: `Node ${i} ` + 'x'.repeat(300),
			tags: [],
			inputs: [],
			outputs: []
		})),
		edges: []
	};
	await page.locator('input[type="file"]').setInputFiles({
		name: 'oversized-preview.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify({ format: 'manef-diagram', schemaVersion: 1, title: 'Large', graph })
		)
	});
	await expect(page.getByRole('status')).toHaveText('Imported oversized-preview.json.');
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	await expect(page.getByRole('status')).toContainText(
		'Compiled view exceeds the source size limit.'
	);
	await expect(page.getByRole('listbox', { name: 'Diagram types', exact: true })).toBeFocused();
	await expect(page.locator('.mermaid-view')).toHaveCount(0);
	await expect(page.locator('.sidebar .metric').first()).toContainText('80');
	expect(errors).toEqual([]);
});
