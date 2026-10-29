import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

function fixture() {
	return {
		format: 'manef-diagram',
		schemaVersion: 1,
		title: 'Input fixture',
		metadata: { provider: 'preserved' },
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
				{ id: 'b', label: 'Beta', tags: [], inputs: [{ id: 'in', label: 'Consumes' }], outputs: [] }
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
		ui: {
			diagramMode: 'flow',
			positions: { a: { x: 100, y: 100 }, b: { x: 450, y: 100 } },
			pan: { x: 0, y: 0 },
			zoom: 1
		}
	};
}
async function camera(page: Page) {
	return page.locator('.world').evaluate((element) => {
		const matrix = new DOMMatrix(getComputedStyle(element).transform);
		return { x: matrix.e, y: matrix.f, zoom: matrix.a };
	});
}
async function exported(page: Page) {
	const waiting = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export', exact: true }).click();
	const file = await waiting;
	return JSON.parse(await readFile((await file.path())!, 'utf8')) as ReturnType<typeof fixture>;
}
async function ready(page: Page) {
	await page.goto('/app');
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
	if (page.viewportSize()!.width <= 1024)
		await page.getByRole('button', { name: 'Canvas', exact: true }).click();
	await page.locator('input[type="file"]').setInputFiles({
		name: 'input.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(fixture()))
	});
	await expect(page.getByRole('status')).toHaveText('Imported input.json.');
}

async function openServices(page: Page) {
	if (
		!(await page
			.locator('.service-navigator')
			.evaluate((element) => (element as HTMLDetailsElement).open))
	)
		await page.locator('.service-navigator summary').click();
}

test('trackpad wheel pans in both axes; pinch zoom stays anchored and zero wheel does nothing', async ({
	page
}) => {
	await ready(page);
	const viewport = page.locator('.viewport');
	await viewport.scrollIntoViewIfNeeded();
	const box = (await viewport.boundingBox())!;
	await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6);
	// Native Chromium mobile emulation scales wheel deltas into CSS pixels.
	await viewport.evaluate((element) => {
		element.addEventListener(
			'wheel',
			(event) =>
				element.setAttribute(
					'data-last-wheel',
					JSON.stringify({ x: (event as WheelEvent).deltaX, y: (event as WheelEvent).deltaY })
				),
			{ once: true }
		);
	});
	await page.mouse.wheel(35, 60);
	await expect(viewport).toHaveAttribute('data-last-wheel', /x/);
	const delta = JSON.parse((await viewport.getAttribute('data-last-wheel'))!) as {
		x: number;
		y: number;
	};
	await expect.poll(async () => (await camera(page)).x).toBeCloseTo(-delta.x, 2);
	await expect.poll(async () => (await camera(page)).y).toBeCloseTo(-delta.y, 2);
	const before = await camera(page);
	expect(before.zoom).toBe(1);
	await viewport.dispatchEvent('wheel', { deltaX: 0, deltaY: 0, deltaMode: 0 });
	expect(await camera(page)).toEqual(before);
	await viewport.dispatchEvent('wheel', {
		deltaX: 0,
		deltaY: -100,
		ctrlKey: true,
		clientX: box.x + 200,
		clientY: box.y + 200
	});
	await expect.poll(async () => (await camera(page)).zoom).toBeGreaterThan(1);
	const after = await camera(page);
	expect(after.x + (200 - before.x) * after.zoom).toBeCloseTo(200, 0);
	expect(after.y + (200 - before.y) * after.zoom).toBeCloseTo(200, 0);
	expect((await exported(page)).ui.positions).toEqual(fixture().ui.positions);
});

test('canvas keyboard and one-click controls pan without dragging or stealing input keys', async ({
	page
}) => {
	await ready(page);
	const viewport = page.locator('.viewport');
	await viewport.focus();
	await viewport.press('ArrowRight');
	await viewport.press('Shift+ArrowDown');
	expect(await camera(page)).toEqual({ x: -40, y: -160, zoom: 1 });
	await viewport.press('+');
	await expect.poll(async () => (await camera(page)).zoom).toBeCloseTo(1.1);
	await viewport.press('1');
	await expect.poll(async () => (await camera(page)).zoom).toBeCloseTo(1);
	await page.getByRole('button', { name: 'Pan left', exact: true }).click();
	const before = await camera(page);
	await page.getByRole('textbox', { name: 'Search graph', exact: true }).focus();
	await page.keyboard.press('ArrowRight');
	expect(await camera(page)).toEqual(before);
	await viewport.focus();
	await page.keyboard.press('Tab');
	await expect(viewport).not.toBeFocused();
});

test('Pan tool and Space drag change only camera; Select retains box selection', async ({
	page
}) => {
	await ready(page);
	const viewport = page.locator('.viewport');
	await viewport.scrollIntoViewIfNeeded();
	let box = (await viewport.boundingBox())!;
	await page.getByRole('button', { name: 'Pan', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Pan', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.mouse.move(box.x + 20, box.y + 200);
	await page.mouse.down();
	await page.mouse.move(box.x + 70, box.y + 245);
	await page.mouse.up();
	expect(await camera(page)).toEqual({ x: 50, y: 45, zoom: 1 });
	await page.getByRole('button', { name: 'Select', exact: true }).click();
	await viewport.focus();
	await page.keyboard.down('Space');
	box = (await viewport.boundingBox())!;
	await page.mouse.move(box.x + 20, box.y + 220);
	await page.mouse.down();
	await page.mouse.move(box.x + 45, box.y + 245);
	await page.mouse.up();
	await page.keyboard.up('Space');
	expect(await camera(page)).toEqual({ x: 75, y: 70, zoom: 1 });
	const snapshot = await exported(page);
	expect(snapshot.graph).toEqual(fixture().graph);
	expect(snapshot.ui.positions).toEqual(fixture().ui.positions);
	await viewport.focus();
	await viewport.press('0');
	expect((await camera(page)).zoom).toBeGreaterThan(0);
});

test('service navigator and position fields provide a non-drag edit path', async ({ page }) => {
	await ready(page);
	await openServices(page);
	await page
		.locator('.service-navigator')
		.getByRole('button', { name: 'Alpha', exact: true })
		.click();
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue('Alpha');
	const x = page.getByRole('spinbutton', { name: 'Node X position', exact: true });
	await x.fill('175');
	await x.press('Tab');
	await expect(x).toHaveValue('175');
	expect((await exported(page)).ui.positions.a).toEqual({ x: 175, y: 100 });
	await page.getByRole('button', { name: 'Graph', exact: true }).click();
	await page.locator('.edge-strip button').first().focus();
	await page.keyboard.press('Enter');
	await expect(
		page.getByRole('heading', { name: 'Connection details', exact: true })
	).toBeVisible();
	await expect(page.locator('[aria-hidden="true"] [tabindex="0"]')).toHaveCount(0);
});

test('reduced motion draws stable layouts and keyboard focus is visible', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await ready(page);
	await page.getByRole('button', { name: 'Graph', exact: true }).click();
	await expect(page.locator('.dot')).toHaveCount(2);
	const first = await page.locator('.dot').first().getAttribute('style');
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	);
	await expect(page.locator('.dot').first()).toHaveAttribute('style', first!);
	await page.getByRole('button', { name: 'Flow', exact: true }).click();
	const viewport = page.locator('.viewport');
	await viewport.focus();
	await page.keyboard.press('ArrowLeft');
	const outline = await viewport.evaluate((element) => getComputedStyle(element).outlineWidth);
	expect(parseFloat(outline)).toBeGreaterThanOrEqual(2);
});

for (const theme of ['composio-light', 'composio-dark']) {
	test(`editor passes automated WCAG A/AA checks in ${theme}`, async ({ page }) => {
		await page.goto('/app');
		await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
		if (page.viewportSize()!.width <= 1024)
			await page.getByRole('button', { name: 'Canvas', exact: true }).click();
		await page.getByLabel('Color theme', { exact: true }).selectOption(theme);
		for (const state of ['overview', 'inspector', 'graph']) {
			if (state === 'inspector') {
				await openServices(page);
				await page.locator('.service-navigator button').first().click();
			}
			if (state === 'graph') await page.getByRole('button', { name: 'Graph', exact: true }).click();
			const results = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
				.analyze();
			expect(results.violations, state).toEqual([]);
		}
	});
}

test('two-finger touch pinch zooms without changing node positions and releases cleanly', async ({
	page
}) => {
	await ready(page);
	const viewport = page.locator('.viewport');
	await viewport.scrollIntoViewIfNeeded();
	const rect = (await viewport.boundingBox())!;
	const client = await page.context().newCDPSession(page);
	const first = { x: rect.x + 35, y: rect.y + 210, id: 1 };
	const second = { x: rect.x + 105, y: rect.y + 210, id: 2 };
	await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
	await client.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [first, second]
	});
	await client.send('Input.dispatchTouchEvent', {
		type: 'touchMove',
		touchPoints: [
			{ ...first, x: first.x - 15 },
			{ ...second, x: second.x + 55 }
		]
	});
	await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await expect.poll(async () => (await camera(page)).zoom).toBeGreaterThan(1);
	expect((await exported(page)).ui.positions).toEqual(fixture().ui.positions);
	await page.getByRole('button', { name: 'Pan right', exact: true }).click();
	await expect(viewport).not.toHaveClass(/panning/);
	await client.detach();
});

test('bounded document undo and redo restore edits, imports and layout without losing metadata', async ({
	page
}) => {
	await ready(page);
	await page.getByRole('button', { name: '+ Node', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue('New node');
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	expect((await exported(page)).graph).toEqual(fixture().graph);
	await page.getByRole('button', { name: 'Redo', exact: true }).click();
	expect((await exported(page)).graph.nodes).toHaveLength(3);
	expect((await exported(page)).metadata).toEqual({ provider: 'preserved' });
	await openServices(page);
	await page
		.locator('.service-navigator')
		.getByRole('button', { name: 'Alpha', exact: true })
		.click();
	const x = page.getByRole('spinbutton', { name: 'Node X position', exact: true });
	await x.fill('200');
	await x.press('Tab');
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	expect((await exported(page)).ui.positions.a).toEqual({ x: 100, y: 100 });
	await page.locator('.viewport').focus();
	await page.keyboard.press('Control+Shift+z');
	expect((await exported(page)).ui.positions.a).toEqual({ x: 200, y: 100 });
});

test('unsaved document edits warn before reload and explicit discard is recoverable', async ({
	page
}) => {
	await ready(page);
	await page.getByRole('button', { name: '+ Node', exact: true }).click();
	await expect(
		page.getByText('Unsaved changes — export a document to keep them.', { exact: true })
	).toBeVisible();
	const prompt = page.waitForEvent('dialog');
	const reload = page.reload();
	const dialog = await prompt;
	expect(dialog.type()).toBe('beforeunload');
	await dialog.accept();
	await reload;
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
});

test('desktop panels collapse without trapping focus and selection reopens the inspector', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await ready(page);
	const before = (await page.locator('.viewport').boundingBox())!.width;
	await page.getByRole('button', { name: 'Hide explorer', exact: true }).click();
	await expect(page.locator('.sidebar')).toBeHidden();
	await page.getByRole('button', { name: 'Hide inspector', exact: true }).click();
	await expect(page.locator('.inspector')).toBeHidden();
	expect((await page.locator('.viewport').boundingBox())!.width).toBeGreaterThan(before + 500);
	await page.getByRole('button', { name: 'Show explorer', exact: true }).click();
	await openServices(page);
	await page
		.locator('.service-navigator')
		.getByRole('button', { name: 'Alpha', exact: true })
		.click();
	await expect(page.locator('.inspector')).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue('Alpha');
});

test('applying a pasted complete document does not pretend it was saved', async ({ page }) => {
	await ready(page);
	await page.getByRole('tab', { name: 'JSON', exact: true }).click();
	await page.getByLabel('Input format', { exact: true }).selectOption('json');
	const input = page.getByRole('textbox', { name: 'Architecture graph JSON', exact: true });
	const source = { ...fixture(), title: 'Pasted but not saved' };
	await input.fill(JSON.stringify(source));
	await page.getByRole('button', { name: 'Apply JSON', exact: true }).click();
	await expect(
		page.getByText('Unsaved changes — export a document to keep them.', { exact: true })
	).toBeVisible();
	expect((await exported(page)).title).toBe('Pasted but not saved');
});

test('reduced-motion node dragging does not restart neighbor physics', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await ready(page);
	await page.getByRole('button', { name: 'Graph', exact: true }).click();
	const neighbor = await page.locator('.dot').nth(1).getAttribute('style');
	const node = (await page.locator('.dot-hit').first().boundingBox())!;
	await page.mouse.move(node.x + node.width / 2, node.y + node.height / 2);
	await page.mouse.down();
	await page.mouse.move(node.x + node.width / 2 + 30, node.y + node.height / 2 + 15);
	await page.mouse.up();
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	);
	await expect(page.locator('.dot').nth(1)).toHaveAttribute('style', neighbor!);
});

test('releasing an unarmed drag outside the canvas cannot move a node later', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await ready(page);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const source = fixture();
	source.ui.positions.a.x = -198;
	await page.locator('input[type="file"]').setInputFiles({
		name: 'edge.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(source))
	});
	await expect(page.getByRole('status')).toHaveText('Imported edge.json.');
	const before = await page.locator('.node').first().getAttribute('style');
	const rect = (await page.locator('.viewport').boundingBox())!;
	await page.mouse.move(rect.x + 2, rect.y + 120);
	await page.mouse.down();
	await page.mouse.move(rect.x - 1, rect.y + 120);
	await page.mouse.up();
	await page.mouse.move(rect.x + 80, rect.y + 125);
	await expect(page.locator('.node').first()).toHaveAttribute('style', before!);
	expect(errors).toEqual([]);
});

test('clicking a tiny overview preview opens a readable editable service', async ({ page }) => {
	await page.goto('/app');
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
	if (page.viewportSize()!.width <= 1024)
		await page.getByRole('button', { name: 'Canvas', exact: true }).click();
	await expect(page.locator('.viewport')).toHaveClass(/overview/);
	await page.locator('.viewport').scrollIntoViewIfNeeded();
	const card = (await page.locator('.node').first().boundingBox())!;
	await page.mouse.click(card.x + card.width / 2, card.y + card.height / 2);
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue('MANEF');
	await expect(page.locator('.viewport')).not.toHaveClass(/overview/);
	await expect(page.locator('.node-select').first()).toBeEnabled();
});

test('in-app navigation can cancel discarding unsaved editor work', async ({ page }) => {
	await ready(page);
	await page.getByRole('tab', { name: 'JSON', exact: true }).click();
	page.once('dialog', (dialog) => dialog.dismiss());
	await page.getByRole('link', { name: 'Converter guide', exact: true }).click();
	await expect(page).toHaveURL(/\/app$/);
	expect((await exported(page)).graph).toEqual(fixture().graph);
	await page.getByRole('button', { name: '+ Node', exact: true }).click();
	await page.getByRole('tab', { name: 'JSON', exact: true }).click();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('link', { name: 'Converter guide', exact: true }).click();
	await expect(page).toHaveURL(/\/guide\?section=converters$/);
});
